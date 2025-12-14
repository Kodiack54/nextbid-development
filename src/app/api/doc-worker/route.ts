import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs/promises';
import * as path from 'path';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const PROJECTS_BASE_PATH = '/var/www/NextBid_Dev';

interface ExtractedInfo {
  decisions: string[];
  todos: string[];
  code_discussed: string[];
  questions_answered: string[];
  key_topics: string[];
  summary: string;
}

/**
 * Background Documentation Worker
 * Runs every 5 minutes to:
 * 1. Read recent conversation sessions
 * 2. Extract decisions, todos, code changes
 * 3. Update project documentation automatically
 * 4. Maintain running todo list
 */

async function extractInfoFromMessages(messages: any[]): Promise<ExtractedInfo> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('No API key');

  // Build conversation text
  const conversationText = messages
    .map(m => `${m.role.toUpperCase()}: ${m.content}`)
    .join('\n\n');

  if (conversationText.length < 100) {
    return {
      decisions: [],
      todos: [],
      code_discussed: [],
      questions_answered: [],
      key_topics: [],
      summary: 'Not enough content to summarize',
    };
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: `Analyze this development conversation and extract key information. Return ONLY valid JSON.

CONVERSATION:
${conversationText.slice(0, 15000)}

Return this exact JSON structure:
{
  "decisions": ["list of decisions made"],
  "todos": ["action items and tasks to do"],
  "code_discussed": ["files, functions, or code topics discussed"],
  "questions_answered": ["questions that were resolved"],
  "key_topics": ["main topics covered"],
  "summary": "2-3 sentence summary of what was accomplished"
}

If a category has nothing, use empty array []. Return ONLY the JSON, no other text.`
      }],
    }),
  });

  if (!response.ok) {
    console.error('Claude API error:', await response.text());
    return {
      decisions: [],
      todos: [],
      code_discussed: [],
      questions_answered: [],
      key_topics: [],
      summary: 'Failed to analyze conversation',
    };
  }

  const data = await response.json();
  const text = data.content?.[0]?.text || '{}';

  try {
    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.error('Failed to parse extraction:', e);
  }

  return {
    decisions: [],
    todos: [],
    code_discussed: [],
    questions_answered: [],
    key_topics: [],
    summary: text.slice(0, 200),
  };
}

async function updateProjectKnowledge(projectId: string, projectPath: string, info: ExtractedInfo) {
  const docsPath = path.join(projectPath, 'docs');

  // Update running log
  const today = new Date().toISOString().split('T')[0];
  const logPath = path.join(docsPath, 'changelog', `${today}-log.md`);

  try {
    await fs.mkdir(path.join(docsPath, 'changelog'), { recursive: true });

    let existingLog = '';
    try {
      existingLog = await fs.readFile(logPath, 'utf-8');
    } catch {
      existingLog = `---
title: "Development Log - ${today}"
category: "changelog"
author: "Doc Worker"
version: "1.0.0"
created_at: "${new Date().toISOString()}"
updated_at: "${new Date().toISOString()}"
---

# Development Log - ${today}

`;
    }

    const timestamp = new Date().toLocaleTimeString();
    const newEntry = `
## ${timestamp}

${info.summary}

${info.decisions.length ? '**Decisions:**\n' + info.decisions.map(d => `- ${d}`).join('\n') : ''}

${info.todos.length ? '**Action Items:**\n' + info.todos.map(t => `- [ ] ${t}`).join('\n') : ''}

${info.code_discussed.length ? '**Code Discussed:**\n' + info.code_discussed.map(c => `- \`${c}\``).join('\n') : ''}

---
`;

    // Update the updated_at in front matter
    const updatedLog = existingLog.replace(
      /updated_at: "[^"]*"/,
      `updated_at: "${new Date().toISOString()}"`
    ) + newEntry;

    await fs.writeFile(logPath, updatedLog);
    console.log('[DocWorker] Updated daily log:', logPath);
  } catch (e) {
    console.error('[DocWorker] Failed to update log:', e);
  }

  // Update running TODO list
  if (info.todos.length > 0) {
    const todoPath = path.join(docsPath, 'notes', 'running-todos.md');

    try {
      await fs.mkdir(path.join(docsPath, 'notes'), { recursive: true });

      let existingTodos = '';
      try {
        existingTodos = await fs.readFile(todoPath, 'utf-8');
      } catch {
        existingTodos = `---
title: "Running TODO List"
category: "notes"
author: "Doc Worker"
version: "1.0.0"
created_at: "${new Date().toISOString()}"
updated_at: "${new Date().toISOString()}"
---

# Running TODO List

Items extracted from development conversations.

`;
      }

      const newTodos = info.todos.map(t => `- [ ] ${t} *(added ${new Date().toLocaleDateString()})*`).join('\n');

      // Increment version
      const versionMatch = existingTodos.match(/version: "(\d+)\.(\d+)\.(\d+)"/);
      let newVersion = '1.0.1';
      if (versionMatch) {
        const patch = parseInt(versionMatch[3]) + 1;
        newVersion = `${versionMatch[1]}.${versionMatch[2]}.${patch}`;
      }

      const updatedTodos = existingTodos
        .replace(/version: "[^"]*"/, `version: "${newVersion}"`)
        .replace(/updated_at: "[^"]*"/, `updated_at: "${new Date().toISOString()}"`)
        + '\n' + newTodos + '\n';

      await fs.writeFile(todoPath, updatedTodos);
      console.log('[DocWorker] Updated TODO list with', info.todos.length, 'items');
    } catch (e) {
      console.error('[DocWorker] Failed to update TODOs:', e);
    }
  }
}

async function markSessionProcessed(sessionId: string) {
  try {
    const { error } = await supabase
      .from('dev_chat_sessions')
      .update({
        doc_worker_processed: true,
        doc_worker_processed_at: new Date().toISOString()
      })
      .eq('id', sessionId);

    if (error && error.message.includes('does not exist')) {
      console.log('[DocWorker] Note: doc_worker_processed column not yet added to database');
    }
  } catch (e) {
    // Column might not exist yet - that's OK
    console.log('[DocWorker] Could not mark session processed (column may not exist yet)');
  }
}

export async function POST(request: NextRequest) {
  console.log('[DocWorker] Starting background documentation run...');

  try {
    const body = await request.json().catch(() => ({}));
    const forceAll = body.force_all || false;

    // Get recent sessions that haven't been processed
    let sessions: any[] = [];
    let sessionsError: any = null;

    // First try with the doc_worker_processed filter (if column exists)
    if (!forceAll) {
      const result = await supabase
        .from('dev_chat_sessions')
        .select('id, project_id, user_id, started_at')
        .or('doc_worker_processed.is.null,doc_worker_processed.eq.false')
        .order('started_at', { ascending: false })
        .limit(10);

      if (result.error && result.error.message.includes('does not exist')) {
        // Column doesn't exist yet - just get recent sessions
        console.log('[DocWorker] Note: doc_worker_processed column not yet added, processing recent sessions');
        const fallback = await supabase
          .from('dev_chat_sessions')
          .select('id, project_id, user_id, started_at')
          .order('started_at', { ascending: false })
          .limit(5); // Smaller limit when we can't track processed status

        sessions = fallback.data || [];
        sessionsError = fallback.error;
      } else {
        sessions = result.data || [];
        sessionsError = result.error;
      }
    } else {
      const result = await supabase
        .from('dev_chat_sessions')
        .select('id, project_id, user_id, started_at')
        .order('started_at', { ascending: false })
        .limit(10);

      sessions = result.data || [];
      sessionsError = result.error;
    }

    if (sessionsError) {
      console.error('[DocWorker] Error fetching sessions:', sessionsError);
      return NextResponse.json({ error: sessionsError.message }, { status: 500 });
    }

    if (!sessions || sessions.length === 0) {
      console.log('[DocWorker] No new sessions to process');
      return NextResponse.json({
        success: true,
        message: 'No new sessions to process',
        processed: 0
      });
    }

    console.log('[DocWorker] Found', sessions.length, 'sessions to process');

    let processed = 0;
    const results: any[] = [];

    for (const session of sessions) {
      try {
        // Get messages for this session
        const { data: messages, error: msgError } = await supabase
          .from('dev_chat_messages')
          .select('role, content, created_at')
          .eq('session_id', session.id)
          .order('created_at', { ascending: true });

        if (msgError || !messages || messages.length < 2) {
          console.log('[DocWorker] Skipping session', session.id, '- not enough messages');
          await markSessionProcessed(session.id);
          continue;
        }

        // Get project info
        const { data: project } = await supabase
          .from('dev_projects')
          .select('server_path, name, slug')
          .eq('id', session.project_id)
          .single();

        const projectPath = project?.server_path || path.join(PROJECTS_BASE_PATH, 'dev-studio-5000');

        // Extract information from conversation
        console.log('[DocWorker] Analyzing session', session.id, 'with', messages.length, 'messages');
        const extracted = await extractInfoFromMessages(messages);

        // Update project documentation
        await updateProjectKnowledge(session.project_id, projectPath, extracted);

        // Mark session as processed
        await markSessionProcessed(session.id);

        processed++;
        results.push({
          session_id: session.id,
          project: project?.name || 'unknown',
          extracted: {
            decisions: extracted.decisions.length,
            todos: extracted.todos.length,
            topics: extracted.key_topics.length,
          },
        });

        // Small delay to avoid rate limits
        await new Promise(r => setTimeout(r, 1000));

      } catch (e: any) {
        console.error('[DocWorker] Error processing session', session.id, ':', e.message);
      }
    }

    console.log('[DocWorker] Completed. Processed', processed, 'sessions');

    return NextResponse.json({
      success: true,
      processed,
      results,
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('[DocWorker] Fatal error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET endpoint to check worker status
export async function GET() {
  // Check last run time from a status record or just return current state
  const { data: recentSessions } = await supabase
    .from('dev_chat_sessions')
    .select('id, doc_worker_processed, doc_worker_processed_at')
    .order('doc_worker_processed_at', { ascending: false })
    .limit(5);

  return NextResponse.json({
    status: 'ready',
    recent_processed: recentSessions || [],
    message: 'POST to trigger documentation worker',
  });
}
