import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

// Track last processed timestamp per project
const WORKER_STATE_KEY = 'cataloger_worker_state';

/**
 * POST /api/worker-cataloger
 * Background worker that continuously catalogs session data
 * Should be called every 30-60 seconds by a cron or interval
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  console.log('\n=== CATALOGER WORKER STARTED ===');

  try {
    // Get worker state (last processed times per project)
    const { data: workerStateData } = await db
      .from('dev_worker_state')
      .select('*')
      .eq('worker_key', WORKER_STATE_KEY)
      .single();
    const workerState = workerStateData as Record<string, unknown> | null;

    const lastProcessed: Record<string, string> = (workerState?.state as Record<string, string>) || {};

    // Get all active sessions with new messages
    const { data: activeSessionsData } = await db
      .from('dev_chat_sessions')
      .select('id, project_id, user_id')
      .eq('status', 'active');
    const activeSessions = (activeSessionsData || []) as Array<Record<string, unknown>>;

    if (!activeSessions.length) {
      return NextResponse.json({
        success: true,
        message: 'No active sessions to process',
        duration_ms: Date.now() - startTime
      });
    }

    const results: Array<{
      project_id: string;
      messages_processed: number;
      docs_updated: string[];
      tickets_created: number;
      alerts_created: number;
    }> = [];

    // Process each active session
    for (const session of activeSessions) {
      const projectId = String(session.project_id || '');
      if (!projectId) continue;

      const lastTime = lastProcessed[projectId] || '1970-01-01T00:00:00Z';

      // Get new messages since last processing
      const sessionId = String(session.id || '');
      const { data: newMessagesData } = await db
        .from('dev_chat_messages')
        .select('role, content, created_at')
        .eq('session_id', sessionId)
        .gt('created_at', lastTime)
        .order('created_at', { ascending: true });
      const newMessages = (newMessagesData || []) as Array<{ role: string; content: string; created_at: string }>;

      if (!newMessages.length) continue;

      console.log(`Processing ${newMessages.length} new messages for project ${projectId}`);

      // Get project info
      const { data: projectData } = await db
        .from('dev_projects')
        .select('*')
        .eq('id', projectId)
        .single();
      const project = projectData as Record<string, unknown> | null;

      if (!project) continue;

      // Get existing project knowledge
      const { data: existingKnowledgeData } = await db
        .from('dev_project_knowledge')
        .select('*')
        .eq('project_id', projectId)
        .single();
      const existingKnowledge = existingKnowledgeData as Record<string, unknown> | null;

      // Incremental scrub - just the new messages
      const scrubbedData = await scrubMessages(newMessages, project, existingKnowledge);

      if (scrubbedData) {
        // Merge with existing knowledge
        const updatedKnowledge = mergeKnowledge(existingKnowledge, scrubbedData);

        // Update project knowledge
        const userId = String(session.user_id || '');
        await upsertProjectKnowledge(projectId, updatedKnowledge, sessionId);

        // Update project docs (README, TODO, CODEBASE)
        const docsUpdated = await updateProjectDocs(project, updatedKnowledge);

        // Create tickets for critical/high priority items
        const ticketsCreated = await createTicketsFromFindings(
          project,
          scrubbedData,
          userId
        );

        // Check for inconsistencies and create alerts
        const alertsCreated = await checkAndCreateAlerts(
          project,
          scrubbedData,
          existingKnowledge
        );

        results.push({
          project_id: projectId,
          messages_processed: newMessages.length,
          docs_updated: docsUpdated,
          tickets_created: ticketsCreated,
          alerts_created: alertsCreated
        });

        // Update last processed time for this project
        lastProcessed[projectId] = newMessages[newMessages.length - 1].created_at;
      }
    }

    // Save worker state using raw SQL upsert
    await db.query(
      `INSERT INTO dev_worker_state (worker_key, state, last_run_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (worker_key) DO UPDATE SET
         state = EXCLUDED.state,
         last_run_at = EXCLUDED.last_run_at`,
      [WORKER_STATE_KEY, JSON.stringify(lastProcessed), new Date().toISOString()]
    );

    console.log(`=== CATALOGER WORKER COMPLETED in ${Date.now() - startTime}ms ===\n`);

    return NextResponse.json({
      success: true,
      results,
      duration_ms: Date.now() - startTime
    });

  } catch (error) {
    console.error('Cataloger worker error:', error);
    return NextResponse.json({
      error: 'Worker failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * Extract file URLs from message content
 */
function extractAttachments(content: string): Array<{ name: string; url: string }> {
  const attachmentRegex = /\[Attached: ([^\]]+)\]\(([^)]+)\)/g;
  const attachments: Array<{ name: string; url: string }> = [];
  let match;
  while ((match = attachmentRegex.exec(content)) !== null) {
    attachments.push({ name: match[1], url: match[2] });
  }
  return attachments;
}

/**
 * Fetch content of text-based attachments
 */
async function fetchAttachmentContent(url: string, name: string): Promise<string | null> {
  const textExtensions = ['md', 'txt', 'json', 'js', 'ts', 'tsx', 'jsx', 'css', 'html', 'sql', 'yaml', 'yml', 'csv'];
  const ext = name.split('.').pop()?.toLowerCase() || '';

  if (!textExtensions.includes(ext)) {
    return `[Binary file: ${name}]`;
  }

  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const text = await response.text();
    // Limit size to avoid token overflow
    return text.length > 5000 ? text.slice(0, 5000) + '\n... (truncated)' : text;
  } catch {
    return null;
  }
}

/**
 * Scrub messages incrementally using Claude
 */
async function scrubMessages(
  messages: Array<{ role: string; content: string; created_at: string }>,
  project: Record<string, unknown>,
  existingKnowledge: Record<string, unknown> | null
) {
  // Build conversation text and collect attachments
  let attachmentContents: string[] = [];

  for (const m of messages) {
    const attachments = extractAttachments(m.content);
    for (const att of attachments) {
      const content = await fetchAttachmentContent(att.url, att.name);
      if (content) {
        attachmentContents.push(`\n--- ATTACHED FILE: ${att.name} ---\n${content}\n--- END FILE ---\n`);
      }
    }
  }

  const conversationText = messages
    .map(m => `${m.role.toUpperCase()}: ${m.content}`)
    .join('\n\n---\n\n');

  const attachmentsText = attachmentContents.length > 0
    ? `\n\nATTACHED FILES CONTENT:\n${attachmentContents.join('\n')}`
    : '';

  const existingContext = String(existingKnowledge?.accumulated_context || '');
  const existingDecisions = JSON.stringify(existingKnowledge?.key_decisions || []);
  const existingTodos = JSON.stringify(existingKnowledge?.todos || existingKnowledge?.known_issues || []);

  const prompt = `You are a development session analyzer. Extract information from this INCREMENTAL conversation snippet.

PROJECT CONTEXT:
- Name: ${project.name}
- Path: ${project.server_path}
- Current knowledge: ${existingKnowledge ? 'Has existing context' : 'Fresh project'}

EXISTING CONTEXT SUMMARY:
${existingContext ? existingContext.slice(-2000) : 'None yet'}

EXISTING DECISIONS (check for contradictions):
${existingDecisions}

EXISTING TODOS (don't duplicate):
${existingTodos}

CONVERSATION SNIPPET:
${conversationText}
${attachmentsText}

IMPORTANT: Check if ANY information in the new messages or attached files CONTRADICTS existing knowledge. This includes:
- Different technical decisions than previously made
- Conflicting requirements or specifications
- Changed priorities or approaches
- File content that disagrees with previous discussions

Return ONLY valid JSON (no markdown):
{
  "new_decisions": [{"decision": "...", "rationale": "...", "impact": "high|medium|low"}],
  "new_todos": [{"task": "...", "priority": "critical|high|medium|low", "status": "pending"}],
  "completed_todos": ["task description that was completed..."],
  "files_mentioned": [{"path": "...", "action": "created|modified|discussed"}],
  "code_snippets": [{"file": "...", "description": "...", "language": "..."}],
  "blockers_found": [{"issue": "...", "resolved": true|false, "solution": "..."}],
  "tech_notes": [{"topic": "...", "note": "..."}],
  "contradictions": [{"existing": "what was previously stated/decided", "new": "what the new info says", "severity": "critical|warning|info", "recommendation": "how to resolve"}],
  "context_update": "Brief summary of what happened in this snippet",
  "from_attachments": [{"filename": "...", "key_info": "important info extracted from this file"}]
}

Be thorough about detecting contradictions - if a new document says something different from what was discussed before, flag it!
Only include NEW information not already in existing knowledge. Return empty arrays if nothing new.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }]
    });

    const responseText = response.content[0].type === 'text' ? response.content[0].text : '';

    try {
      const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/) || [null, responseText];
      return JSON.parse(jsonMatch[1] || responseText);
    } catch {
      console.error('Failed to parse scrub response');
      return null;
    }
  } catch (error) {
    console.error('Scrub API error:', error);
    return null;
  }
}

/**
 * Merge new scrubbed data with existing knowledge
 */
function mergeKnowledge(
  existing: Record<string, unknown> | null,
  newData: Record<string, unknown>
): Record<string, unknown> {
  // Mark completed todos
  const completedTasks = new Set((newData.completed_todos as string[]) || []);

  let existingTodos = ((existing?.todos as Array<{ task: string; status: string }>) || []).map(todo => {
    // Check if this todo was completed
    if (completedTasks.has(todo.task)) {
      return { ...todo, status: 'completed', completed_at: new Date().toISOString() };
    }
    return todo;
  });

  const merged = {
    accumulated_context: [
      existing?.accumulated_context || '',
      newData.context_update || ''
    ].filter(Boolean).join('\n\n'),

    key_decisions: [
      ...((existing?.key_decisions as unknown[]) || []),
      ...((newData.new_decisions as unknown[]) || [])
    ],

    known_issues: [
      ...((existing?.known_issues as unknown[]) || []),
      ...((newData.blockers_found as unknown[]) || [])
    ],

    tech_notes: [
      ...((existing?.tech_notes as unknown[]) || []),
      ...((newData.tech_notes as unknown[]) || [])
    ],

    todos: [
      ...existingTodos,
      ...((newData.new_todos as unknown[]) || [])
    ],

    files_touched: [
      ...((existing?.files_touched as unknown[]) || []),
      ...((newData.files_mentioned as unknown[]) || [])
    ],

    code_snippets: [
      ...((existing?.code_snippets as unknown[]) || []),
      ...((newData.code_snippets as unknown[]) || [])
    ],

    // Track contradictions - these are important!
    contradictions: [
      ...((existing?.contradictions as unknown[]) || []),
      ...((newData.contradictions as unknown[]) || []).map((c: unknown) => ({
        ...(c as Record<string, unknown>),
        detected_at: new Date().toISOString()
      }))
    ],

    // Track info from attachments
    attachment_insights: [
      ...((existing?.attachment_insights as unknown[]) || []),
      ...((newData.from_attachments as unknown[]) || []).map((a: unknown) => ({
        ...(a as Record<string, unknown>),
        added_at: new Date().toISOString()
      }))
    ]
  };

  // Deduplicate todos by task name
  const seenTodos = new Set();
  merged.todos = (merged.todos as Array<{ task: string }>).filter(todo => {
    if (seenTodos.has(todo.task)) return false;
    seenTodos.add(todo.task);
    return true;
  });

  return merged;
}

/**
 * Upsert project knowledge
 */
async function upsertProjectKnowledge(
  projectId: string,
  knowledge: Record<string, unknown>,
  sessionId: string
) {
  const { data: existingData } = await db
    .from('dev_project_knowledge')
    .select('id')
    .eq('project_id', projectId)
    .single();
  const existing = existingData as Record<string, unknown> | null;

  const record = {
    project_id: projectId,
    accumulated_context: knowledge.accumulated_context,
    key_decisions: knowledge.key_decisions,
    known_issues: knowledge.known_issues,
    tech_notes: knowledge.tech_notes,
    last_updated_at: new Date().toISOString(),
    last_session_id: sessionId
  };

  if (existing) {
    await db
      .from('dev_project_knowledge')
      .update(record)
      .eq('id', existing.id as string);
  } else {
    await db
      .from('dev_project_knowledge')
      .insert(record);
  }
}

/**
 * Update project documentation files (README, TODO, CODEBASE)
 */
async function updateProjectDocs(
  project: Record<string, unknown>,
  knowledge: Record<string, unknown>
): Promise<string[]> {
  const updated: string[] = [];
  const projectId = project.id as string;

  // Generate/update README
  if (knowledge.accumulated_context || knowledge.key_decisions) {
    const readme = generateReadme(project, knowledge);
    await saveProjectDoc(projectId, 'readme', 'README.md', readme);
    updated.push('README.md');
  }

  // Generate/update TODO
  if ((knowledge.todos as unknown[])?.length > 0) {
    const todo = generateTodo(knowledge);
    await saveProjectDoc(projectId, 'todo', 'TODO.md', todo);
    updated.push('TODO.md');
  }

  // Generate/update CODEBASE
  if ((knowledge.files_touched as unknown[])?.length > 0 || (knowledge.tech_notes as unknown[])?.length > 0) {
    const codebase = generateCodebase(project, knowledge);
    await saveProjectDoc(projectId, 'codebase', 'CODEBASE.md', codebase);
    updated.push('CODEBASE.md');
  }

  return updated;
}

/**
 * Save doc to database with version tracking
 */
async function saveProjectDoc(projectId: string, docType: string, title: string, content: string) {
  // Get current version
  const { data: currentData } = await db
    .from('dev_project_docs')
    .select('id, version')
    .eq('project_id', projectId)
    .eq('doc_type', docType)
    .order('version', { ascending: false })
    .limit(1)
    .single();
  const current = currentData as Record<string, unknown> | null;

  const newVersion = ((current?.version as number) || 0) + 1;

  await db.from('dev_project_docs').insert({
    project_id: projectId,
    doc_type: docType,
    title,
    content,
    version: newVersion,
    previous_version_id: (current?.id as string) || null,
    ai_generated: true
  });
}

/**
 * Generate README content
 */
function generateReadme(project: Record<string, unknown>, knowledge: Record<string, unknown>): string {
  const decisions = (knowledge.key_decisions as Array<{ decision: string; rationale?: string }>) || [];

  return `# ${project.name}

${project.description || 'No description available.'}

## Overview

${knowledge.accumulated_context || 'Project documentation will be updated as development progresses.'}

## Key Decisions

${decisions.length > 0
  ? decisions.slice(-10).map(d => `- **${d.decision}**${d.rationale ? `: ${d.rationale}` : ''}`).join('\n')
  : 'No major decisions documented yet.'}

## Technical Stack

- **Server:** ${project.droplet_name || 'Unknown'}
- **Path:** ${project.server_path || 'Unknown'}
- **Dev Port:** ${project.port_dev || 'N/A'}
- **Test Port:** ${project.port_test || 'N/A'}
- **Prod Port:** ${project.port_prod || 'N/A'}

---
*Auto-generated by NextBid Dev Environment*
*Last updated: ${new Date().toISOString()}*
`;
}

/**
 * Generate TODO content
 */
function generateTodo(knowledge: Record<string, unknown>): string {
  const todos = (knowledge.todos as Array<{ task: string; priority?: string; status?: string }>) || [];
  const blockers = (knowledge.known_issues as Array<{ issue: string; resolved?: boolean }>) || [];

  const critical = todos.filter(t => t.priority === 'critical');
  const high = todos.filter(t => t.priority === 'high');
  const medium = todos.filter(t => t.priority === 'medium');
  const low = todos.filter(t => t.priority === 'low' || !t.priority);

  return `# TODO

## Critical Priority
${critical.length > 0 ? critical.map(t => `- [ ] ${t.task}`).join('\n') : '_None_'}

## High Priority
${high.length > 0 ? high.map(t => `- [ ] ${t.task}`).join('\n') : '_None_'}

## Medium Priority
${medium.length > 0 ? medium.map(t => `- [ ] ${t.task}`).join('\n') : '_None_'}

## Low Priority
${low.length > 0 ? low.map(t => `- [ ] ${t.task}`).join('\n') : '_None_'}

## Known Issues / Blockers
${blockers.length > 0
  ? blockers.map(b => `- ${b.resolved ? '[RESOLVED]' : '[OPEN]'} ${b.issue}`).join('\n')
  : '_No known issues_'}

---
*Auto-generated by NextBid Dev Environment*
*Last updated: ${new Date().toISOString()}*
`;
}

/**
 * Generate CODEBASE content
 */
function generateCodebase(project: Record<string, unknown>, knowledge: Record<string, unknown>): string {
  const files = (knowledge.files_touched as Array<{ path: string; action?: string; description?: string }>) || [];
  const techNotes = (knowledge.tech_notes as Array<{ topic: string; note: string }>) || [];
  const snippets = (knowledge.code_snippets as Array<{ file: string; description: string; language?: string }>) || [];

  // Group files by directory
  const filesByDir: Record<string, typeof files> = {};
  files.forEach(f => {
    const dir = f.path.split('/').slice(0, -1).join('/') || 'root';
    if (!filesByDir[dir]) filesByDir[dir] = [];
    filesByDir[dir].push(f);
  });

  return `# ${project.name} - Codebase Documentation

## Project Structure

${Object.entries(filesByDir).map(([dir, dirFiles]) => `
### ${dir}/
${dirFiles.map(f => `- \`${f.path.split('/').pop()}\` - ${f.description || f.action || 'Modified'}`).join('\n')}
`).join('\n')}

## Technical Notes

${techNotes.length > 0
  ? techNotes.map(n => `### ${n.topic}\n${n.note}`).join('\n\n')
  : '_Technical notes will be added as development progresses._'}

## Code References

${snippets.length > 0
  ? snippets.map(s => `- **${s.file}**: ${s.description}`).join('\n')
  : '_No code snippets documented yet._'}

## Server Information

| Property | Value |
|----------|-------|
| Droplet | ${project.droplet_name || 'Unknown'} |
| IP | ${project.droplet_ip || 'Unknown'} |
| Path | ${project.server_path || 'Unknown'} |

---
*Auto-generated by NextBid Dev Environment*
*Last updated: ${new Date().toISOString()}*
`;
}

/**
 * Create tickets from critical/high findings
 * Uses existing dev_system_tickets table
 */
async function createTicketsFromFindings(
  project: Record<string, unknown>,
  scrubbedData: Record<string, unknown>,
  userId: string
): Promise<number> {
  let ticketsCreated = 0;
  const projectSlug = project.slug || project.name;

  // Get user info for reporter
  const { data: userData } = await db
    .from('dev_users')
    .select('name')
    .eq('id', userId)
    .single();
  const user = userData as Record<string, unknown> | null;

  const reporterName = (user?.name as string) || 'Cataloger Worker';

  // Create tickets for critical/high priority todos
  const todos = (scrubbedData.new_todos as Array<{
    task: string;
    priority: string;
    status?: string;
  }>) || [];

  for (const todo of todos) {
    if (todo.priority === 'critical' || todo.priority === 'high') {
      // Check if similar ticket exists
      const { data: existing } = await db
        .from('dev_system_tickets')
        .select('id')
        .eq('project', projectSlug)
        .ilike('title', `%${todo.task.substring(0, 50)}%`)
        .in('status', ['open', 'in_progress'])
        .limit(1)
        .single();

      if (!existing) {
        await db.from('dev_system_tickets').insert({
          title: todo.task,
          description: `Auto-generated from dev session.\n\nPriority: ${todo.priority}`,
          status: 'open',
          priority: todo.priority === 'critical' ? 'critical' : 'high',
          type: 'task',
          project: projectSlug,
          reporter_name: reporterName,
          labels: ['auto-generated', 'cataloger']
        });
        ticketsCreated++;
      }
    }
  }

  // Create tickets for unresolved blockers
  const blockers = (scrubbedData.blockers_found as Array<{
    issue: string;
    resolved: boolean;
    solution?: string;
  }>) || [];

  for (const blocker of blockers) {
    if (!blocker.resolved) {
      const { data: existing } = await db
        .from('dev_system_tickets')
        .select('id')
        .eq('project', projectSlug)
        .ilike('title', `%${blocker.issue.substring(0, 50)}%`)
        .in('status', ['open', 'in_progress'])
        .limit(1)
        .single();

      if (!existing) {
        await db.from('dev_system_tickets').insert({
          title: `BLOCKER: ${blocker.issue}`,
          description: `Auto-generated blocker from dev session.\n\n${blocker.solution ? `Potential solution: ${blocker.solution}` : 'No solution identified yet.'}`,
          status: 'open',
          priority: 'critical',
          type: 'bug',
          project: projectSlug,
          reporter_name: reporterName,
          labels: ['auto-generated', 'blocker', 'cataloger']
        });
        ticketsCreated++;
      }
    }
  }

  return ticketsCreated;
}

/**
 * Check for inconsistencies and create alerts
 * Uses dev_incidents table for serious issues
 */
async function checkAndCreateAlerts(
  project: Record<string, unknown>,
  scrubbedData: Record<string, unknown>,
  existingKnowledge: Record<string, unknown> | null
): Promise<number> {
  let alertsCreated = 0;
  const projectId = project.id as string;

  // Check for conflicting decisions
  const newDecisions = (scrubbedData.new_decisions as Array<{
    decision: string;
    rationale?: string;
    impact?: string;
  }>) || [];

  const existingDecisions = (existingKnowledge?.key_decisions as Array<{
    decision: string;
    rationale?: string;
  }>) || [];

  for (const newDec of newDecisions) {
    // Look for potential conflicts (simplified check)
    const potentialConflict = existingDecisions.find(existing => {
      const newLower = newDec.decision.toLowerCase();
      const existLower = existing.decision.toLowerCase();
      // Check if decisions mention same topic but might conflict
      return (
        (newLower.includes('not') && !existLower.includes('not') ||
         !newLower.includes('not') && existLower.includes('not')) &&
        newLower.split(' ').some(word =>
          word.length > 4 && existLower.includes(word)
        )
      );
    });

    if (potentialConflict && newDec.impact === 'high') {
      // Create an incident for high-impact conflicting decisions
      await db.from('dev_incidents').insert({
        project_id: projectId,
        title: `Potential Decision Conflict`,
        description: `New decision may conflict with existing:\n\nNEW: ${newDec.decision}\n\nEXISTING: ${potentialConflict.decision}`,
        severity: 'warning',
        status: 'open',
        source: 'cataloger_worker'
      });
      alertsCreated++;
    }
  }

  // Check for stale documentation (if context update mentions major changes)
  const contextUpdate = scrubbedData.context_update as string;
  if (contextUpdate && (
    contextUpdate.toLowerCase().includes('major change') ||
    contextUpdate.toLowerCase().includes('breaking change') ||
    contextUpdate.toLowerCase().includes('architecture change')
  )) {
    await db.from('dev_incidents').insert({
      project_id: projectId,
      title: `Documentation May Be Stale`,
      description: `Major changes detected that may require documentation update:\n\n${contextUpdate}`,
      severity: 'info',
      status: 'open',
      source: 'cataloger_worker'
    });
    alertsCreated++;
  }

  return alertsCreated;
}

/**
 * GET /api/worker-cataloger
 * Check worker status and last run info
 */
export async function GET() {
  const { data: workerStateData } = await db
    .from('dev_worker_state')
    .select('*')
    .eq('worker_key', WORKER_STATE_KEY)
    .single();
  const workerState = workerStateData as Record<string, unknown> | null;
  const stateObj = (workerState?.state as Record<string, unknown>) || {};

  return NextResponse.json({
    success: true,
    worker_key: WORKER_STATE_KEY,
    last_run_at: workerState?.last_run_at || null,
    projects_tracked: Object.keys(stateObj).length,
    state: stateObj
  });
}
