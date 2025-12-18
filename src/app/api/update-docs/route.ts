import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

/**
 * POST /api/update-docs
 * Use Claude to update project documentation based on accumulated session knowledge
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { project_id, doc_type, current_content, session_scrubbing_ids } = body;

    if (!project_id) {
      return NextResponse.json({ error: 'project_id required' }, { status: 400 });
    }

    console.log(`📝 Updating ${doc_type || 'all'} docs for project:`, project_id);

    // Get project info
    const { data: projectData } = await db
      .from('dev_projects')
      .select('*')
      .eq('id', project_id)
      .single();
    const project = projectData as Record<string, unknown> | null;

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Get recent session scrubbing data
    let query = db
      .from('dev_session_scrubbing')
      .select('extracted_data, created_at')
      .eq('project_id', project_id)
      .order('created_at', { ascending: false })
      .limit(10);

    if (session_scrubbing_ids?.length) {
      query = db
        .from('dev_session_scrubbing')
        .select('extracted_data, created_at')
        .in('id', session_scrubbing_ids);
    }

    const { data: scrubbingResultsData } = await query;
    const scrubbingResults = (scrubbingResultsData || []) as Array<{ extracted_data: Record<string, unknown>; created_at: string }>;

    if (!scrubbingResults.length) {
      return NextResponse.json({
        error: 'No session scrubbing data found for this project',
        suggestion: 'Run /api/scrub-session first to analyze your chat sessions'
      }, { status: 404 });
    }

    // Aggregate all session data
    const aggregatedData = aggregateSessionData(scrubbingResults);

    // Get existing project knowledge
    const { data: existingKnowledgeData } = await db
      .from('dev_project_knowledge')
      .select('*')
      .eq('project_id', project_id)
      .single();
    const existingKnowledge = existingKnowledgeData as Record<string, unknown> | null;

    // Build prompt based on doc type
    const prompt = buildDocUpdatePrompt(
      doc_type || 'all',
      project,
      aggregatedData,
      current_content,
      existingKnowledge
    );

    console.log('Sending to Claude for doc generation...');

    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 8000,
      messages: [{ role: 'user', content: prompt }]
    });

    const responseText = response.content[0].type === 'text' ? response.content[0].text : '';

    // Parse the generated docs
    let generatedDocs;
    try {
      const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/) || [null, responseText];
      const jsonText = jsonMatch[1] || responseText;
      generatedDocs = JSON.parse(jsonText);
    } catch {
      // If not JSON, assume it's raw markdown for single doc type
      generatedDocs = { [doc_type || 'content']: responseText };
    }

    // Update project knowledge
    const knowledgeUpdate = {
      project_id,
      accumulated_context: aggregatedData.combinedContext,
      key_decisions: aggregatedData.allDecisions,
      known_issues: aggregatedData.allBlockers,
      tech_notes: aggregatedData.allTechNotes,
      api_endpoints: aggregatedData.allEndpoints,
      generated_readme: generatedDocs.readme || existingKnowledge?.generated_readme,
      generated_todo: generatedDocs.todo || existingKnowledge?.generated_todo,
      generated_changelog: generatedDocs.changelog || existingKnowledge?.generated_changelog,
      last_updated_at: new Date().toISOString(),
      total_sessions_analyzed: scrubbingResults.length,
    };

    if (existingKnowledge) {
      await db
        .from('dev_project_knowledge')
        .update(knowledgeUpdate)
        .eq('id', existingKnowledge.id);
    } else {
      await db
        .from('dev_project_knowledge')
        .insert(knowledgeUpdate);
    }

    // Also save to project_docs table for version history
    if (generatedDocs.readme) {
      await saveDocVersion(project_id, 'readme', 'README.md', generatedDocs.readme);
    }
    if (generatedDocs.todo) {
      await saveDocVersion(project_id, 'todo', 'TODO.md', generatedDocs.todo);
    }
    if (generatedDocs.changelog) {
      await saveDocVersion(project_id, 'changelog', 'CHANGELOG.md', generatedDocs.changelog);
    }

    console.log('✅ Docs updated successfully');

    return NextResponse.json({
      success: true,
      project_id,
      generated_docs: generatedDocs,
      sessions_analyzed: scrubbingResults.length,
      message: 'Documentation updated successfully'
    });

  } catch (error) {
    console.error('Error updating docs:', error);
    return NextResponse.json({
      error: 'Failed to update documentation',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * Aggregate data from multiple session scrubbings
 */
function aggregateSessionData(scrubbingResults: Array<{ extracted_data: Record<string, unknown>; created_at: string }>) {
  const allDecisions: unknown[] = [];
  const allTodos: unknown[] = [];
  const allBlockers: unknown[] = [];
  const allTechNotes: unknown[] = [];
  const allEndpoints: unknown[] = [];
  const allFilesModified: unknown[] = [];
  const contextParts: string[] = [];

  for (const result of scrubbingResults) {
    const data = result.extracted_data as Record<string, unknown>;

    if (data.decisions_made) {
      allDecisions.push(...(data.decisions_made as unknown[]));
    }
    if (data.todos_generated) {
      allTodos.push(...(data.todos_generated as unknown[]));
    }
    if (data.blockers_encountered) {
      allBlockers.push(...(data.blockers_encountered as unknown[]));
    }
    if (data.technical_notes) {
      allTechNotes.push(...(data.technical_notes as unknown[]));
    }
    if (data.apis_endpoints_added) {
      allEndpoints.push(...(data.apis_endpoints_added as unknown[]));
    }
    if (data.files_modified) {
      allFilesModified.push(...(data.files_modified as unknown[]));
    }

    const context = data.context_for_next_session as Record<string, string> | undefined;
    if (context?.important_context) {
      contextParts.push(`[${result.created_at}] ${context.important_context}`);
    }
  }

  return {
    allDecisions,
    allTodos,
    allBlockers,
    allTechNotes,
    allEndpoints,
    allFilesModified,
    combinedContext: contextParts.join('\n\n'),
  };
}

/**
 * Build the prompt for doc generation
 */
function buildDocUpdatePrompt(
  docType: string,
  project: Record<string, unknown>,
  aggregatedData: ReturnType<typeof aggregateSessionData>,
  currentContent: string | undefined,
  existingKnowledge: Record<string, unknown> | null
): string {
  const baseContext = `
PROJECT: ${project.name}
DESCRIPTION: ${project.description || 'N/A'}
PORT: ${project.port_dev || 'N/A'}
PATH: ${project.server_path || 'N/A'}

ACCUMULATED KNOWLEDGE FROM ${aggregatedData.allDecisions.length} DECISIONS:
${JSON.stringify(aggregatedData.allDecisions.slice(0, 20), null, 2)}

TODOS (${aggregatedData.allTodos.length} items):
${JSON.stringify(aggregatedData.allTodos.slice(0, 30), null, 2)}

API ENDPOINTS:
${JSON.stringify(aggregatedData.allEndpoints, null, 2)}

FILES MODIFIED:
${JSON.stringify(aggregatedData.allFilesModified.slice(0, 30), null, 2)}

TECHNICAL NOTES:
${JSON.stringify(aggregatedData.allTechNotes.slice(0, 20), null, 2)}

CONTEXT FROM SESSIONS:
${aggregatedData.combinedContext}
`;

  if (docType === 'all') {
    return `${baseContext}

Based on this accumulated project knowledge, generate updated documentation.

Return ONLY valid JSON with this structure:
{
  "readme": "Full README.md content in markdown",
  "todo": "Full TODO.md content in markdown with checkboxes",
  "changelog": "CHANGELOG.md with recent changes"
}

${currentContent ? `CURRENT README TO UPDATE:\n${currentContent}` : 'Generate new documentation from scratch.'}

Make the documentation comprehensive, professional, and developer-friendly.`;
  }

  if (docType === 'readme') {
    return `${baseContext}

Generate a comprehensive README.md for this project.

${currentContent ? `CURRENT README:\n${currentContent}\n\nUpdate this readme with new information.` : 'Generate a new README from scratch.'}

Include: Overview, Features, Tech Stack, Setup, API Routes, Database Schema, Development Notes.
Return raw markdown (no JSON wrapper).`;
  }

  if (docType === 'todo') {
    return `${baseContext}

Generate a TODO.md file based on the accumulated tasks and decisions.

${currentContent ? `CURRENT TODO:\n${currentContent}` : ''}

Format with checkboxes, priorities, and categories.
Return raw markdown (no JSON wrapper).`;
  }

  return `${baseContext}

Generate ${docType} documentation for this project.
Return raw markdown.`;
}

/**
 * Save doc version to project_docs table
 */
async function saveDocVersion(projectId: string, docType: string, title: string, content: string) {
  try {
    await db.from('dev_project_docs').insert({
      project_id: projectId,
      doc_type: docType,
      title,
      content,
      ai_generated: true,
    });
  } catch (error) {
    console.error(`Failed to save ${docType} version:`, error);
  }
}

/**
 * GET /api/update-docs
 * Get generated docs for a project
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('project_id');
    const docType = searchParams.get('doc_type');

    if (!projectId) {
      return NextResponse.json({ error: 'project_id required' }, { status: 400 });
    }

    // Get project knowledge
    const { data: knowledge } = await db
      .from('dev_project_knowledge')
      .select('*')
      .eq('project_id', projectId)
      .single();

    if (!knowledge) {
      return NextResponse.json({
        error: 'No documentation found for this project',
        suggestion: 'Run POST /api/update-docs to generate docs'
      }, { status: 404 });
    }

    // Return specific doc or all
    if (docType) {
      const docKey = `generated_${docType}` as keyof typeof knowledge;
      return NextResponse.json({
        success: true,
        doc_type: docType,
        content: knowledge[docKey] || null,
        last_updated: knowledge.last_updated_at,
      });
    }

    return NextResponse.json({
      success: true,
      knowledge,
    });

  } catch (error) {
    return NextResponse.json({
      error: 'Failed to retrieve documentation',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
