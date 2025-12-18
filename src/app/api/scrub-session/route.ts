import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

// Extraction prompt for session scrubbing
const SESSION_SCRUB_PROMPT = `You are an expert development session analyzer. Analyze this coding conversation and extract ALL relevant information for project continuity.

Return ONLY valid JSON (no markdown) with this EXACT structure:

{
  "session_summary": {
    "title": "Brief descriptive title for this session",
    "duration_estimate": "e.g., 2 hours",
    "primary_focus": "What was the main goal",
    "outcome": "COMPLETED" or "IN_PROGRESS" or "BLOCKED" or "NEEDS_FOLLOWUP",
    "confidence_score": 0-100
  },

  "work_completed": [
    {
      "description": "What was done",
      "type": "feature" or "bugfix" or "refactor" or "documentation" or "infrastructure" or "research",
      "files_affected": ["file1.ts", "file2.tsx"],
      "lines_changed_estimate": 0,
      "status": "completed" or "partial" or "reverted"
    }
  ],

  "decisions_made": [
    {
      "decision": "What was decided",
      "rationale": "Why this choice was made",
      "alternatives_considered": ["alt 1", "alt 2"],
      "impact": "high" or "medium" or "low"
    }
  ],

  "todos_generated": [
    {
      "task": "What needs to be done",
      "priority": "critical" or "high" or "medium" or "low",
      "estimated_effort": "small" or "medium" or "large",
      "depends_on": ["other task if any"],
      "assigned_to": null
    }
  ],

  "blockers_encountered": [
    {
      "blocker": "What blocked progress",
      "resolution": "How it was resolved" or null,
      "workaround": "Temporary fix if any",
      "needs_followup": true or false
    }
  ],

  "technical_notes": [
    {
      "topic": "Topic name",
      "note": "Technical detail worth remembering",
      "code_snippet": "relevant code if any",
      "file_context": "file path if relevant"
    }
  ],

  "files_modified": [
    {
      "path": "full/path/to/file.ts",
      "action": "created" or "modified" or "deleted",
      "description": "What changed",
      "breaking_change": false
    }
  ],

  "apis_endpoints_added": [
    {
      "endpoint": "/api/something",
      "method": "GET" or "POST" or "PATCH" or "DELETE",
      "purpose": "What it does",
      "requires_auth": true or false
    }
  ],

  "database_changes": [
    {
      "table": "table_name",
      "action": "created" or "modified" or "migration",
      "description": "What changed",
      "sql_file": "path if applicable"
    }
  ],

  "context_for_next_session": {
    "current_state": "Where the project stands now",
    "immediate_next_steps": ["step 1", "step 2"],
    "important_context": "Things the next developer/AI needs to know",
    "open_questions": ["question 1"],
    "warnings": ["watch out for..."]
  },

  "readme_updates": {
    "should_update": true or false,
    "sections_to_update": ["Features", "API Routes", "Setup"],
    "new_content": "Suggested additions to README"
  },

  "todo_updates": {
    "items_completed": ["task that was done"],
    "items_to_add": ["new task discovered"],
    "items_to_remove": ["obsolete task"]
  },

  "project_metadata": {
    "project_name": "inferred from conversation",
    "tech_stack": ["Next.js", "Supabase", etc],
    "port": 0,
    "last_known_status": "running" or "error" or "not_started"
  }
}

Extract EVERY relevant detail. Be thorough - this data will be used to continue work in future sessions without any context loss.`;

/**
 * POST /api/scrub-session
 * Scrub a chat session and extract structured data using Claude
 */
export async function POST(request: NextRequest) {
  try {
    console.log('\n=== SESSION SCRUBBING STARTED ===');

    const body = await request.json();
    const { session_id, messages, user_id, project_id } = body;

    if (!session_id && !messages) {
      return NextResponse.json({ error: 'session_id or messages required' }, { status: 400 });
    }

    // If session_id provided, fetch messages from DB
    let chatMessages = messages;
    if (session_id && !messages) {
      const { data: dbMessages, error } = await db
        .from('dev_chat_messages')
        .select('role, content, created_at')
        .eq('session_id', session_id)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching messages:', error);
        return NextResponse.json({ error: 'Failed to fetch session messages' }, { status: 500 });
      }
      chatMessages = dbMessages;
    }

    if (!chatMessages || chatMessages.length === 0) {
      return NextResponse.json({ error: 'No messages to scrub' }, { status: 400 });
    }

    console.log(`Processing ${chatMessages.length} messages...`);

    // Format conversation for Claude
    const conversationText = chatMessages
      .map((m: { role: string; content: string }) => `${m.role.toUpperCase()}: ${m.content}`)
      .join('\n\n---\n\n');

    // Update session status to processing
    if (session_id) {
      await db
        .from('dev_chat_sessions')
        .update({
          status: 'processing',
        })
        .eq('id', session_id);
    }

    console.log('Sending to Claude AI for scrubbing...');

    // Call Claude with retry logic
    let attempts = 0;
    let response;

    while (attempts < 3) {
      try {
        response = await anthropic.messages.create({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 8000,
          messages: [
            {
              role: 'user',
              content: `${SESSION_SCRUB_PROMPT}\n\n---\n\nCONVERSATION TO ANALYZE:\n\n${conversationText}`
            }
          ]
        });

        console.log('✅ Claude response received');
        break;

      } catch (apiError: unknown) {
        attempts++;
        const error = apiError as { status?: number; message?: string };

        if (error.status === 429) {
          console.log(`⏳ Rate limit hit. Waiting 30 seconds... (Attempt ${attempts}/3)`);
          if (attempts < 3) {
            await new Promise(resolve => setTimeout(resolve, 30000));
            continue;
          }
        }
        throw apiError;
      }
    }

    if (!response) {
      throw new Error('Failed to get response from Claude after 3 attempts');
    }

    const responseText = response.content[0].type === 'text' ? response.content[0].text : '';

    // Parse the JSON response
    let extractedData;
    try {
      const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/) || [null, responseText];
      const jsonText = jsonMatch[1] || responseText;
      extractedData = JSON.parse(jsonText);
      console.log('✅ Parsed JSON successfully');
    } catch (parseError) {
      console.error('Parse error:', parseError);
      // Try to salvage what we can
      extractedData = {
        session_summary: {
          title: 'Session Analysis',
          outcome: 'COMPLETED',
          confidence_score: 50
        },
        context_for_next_session: {
          current_state: responseText.substring(0, 500),
          immediate_next_steps: [],
          important_context: 'Raw response - parsing failed',
          open_questions: [],
          warnings: ['JSON parsing failed - raw text stored']
        },
        raw_response: responseText
      };
    }

    // Calculate token usage and cost
    const inputTokens = response.usage?.input_tokens || 0;
    const outputTokens = response.usage?.output_tokens || 0;
    // Claude Sonnet pricing: $3/1M input, $15/1M output
    const costUsd = (inputTokens / 1_000_000) * 3 + (outputTokens / 1_000_000) * 15;

    // Save to database
    console.log('Saving scrubbed data to database...');

    if (session_id) {
      // Update session with extracted data
      await db
        .from('dev_chat_sessions')
        .update({
          status: 'ended',
          ended_at: new Date().toISOString(),
          summary: extractedData.session_summary?.title || 'Session completed',
          summary_generated_at: new Date().toISOString(),
          key_decisions: extractedData.decisions_made || [],
          files_discussed: extractedData.files_modified?.map((f: { path: string }) => f.path) || [],
          todos_generated: extractedData.todos_generated || [],
        })
        .eq('id', session_id);

      // Save detailed scrubbing results
      await db.from('dev_session_summaries').insert({
        session_id,
        summary: extractedData.session_summary?.title || 'Session completed',
        key_points: extractedData.work_completed?.map((w: { description: string }) => w.description) || [],
        action_items: extractedData.todos_generated?.map((t: { task: string }) => t.task) || [],
        decisions_made: extractedData.decisions_made || [],
        code_changes: extractedData.files_modified || [],
        context_for_next_session: extractedData.context_for_next_session?.important_context || '',
        generated_by: 'claude-sonnet-4',
        tokens_used: inputTokens + outputTokens,
        cost_usd: costUsd,
      });
    }

    // Store full extracted data in a dedicated table for querying
    const { data: scrubbingRecord, error: insertError } = await db
      .from('dev_session_scrubbing')
      .insert({
        session_id,
        user_id,
        project_id,
        extracted_data: extractedData,
        scrubbing_status: 'completed',
        tokens_used: inputTokens + outputTokens,
        cost_usd: costUsd,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error saving scrubbing record:', insertError);
      // Continue anyway - we still have the data
    }

    console.log('✅ SUCCESS! Session scrubbed:', session_id || 'ad-hoc');

    return NextResponse.json({
      success: true,
      session_id,
      scrubbing_id: scrubbingRecord?.id,
      extracted_data: extractedData,
      usage: {
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cost_usd: Math.round(costUsd * 1000000) / 1000000,
      },
      message: 'Session scrubbed successfully'
    });

  } catch (error) {
    console.error('ERROR:', error);

    return NextResponse.json({
      error: 'Failed to scrub session',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * GET /api/scrub-session
 * Get scrubbing results for a session
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('session_id');
    const projectId = searchParams.get('project_id');
    const limit = parseInt(searchParams.get('limit') || '10');

    let query = db
      .from('dev_session_scrubbing')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (sessionId) {
      query = query.eq('session_id', sessionId);
    }

    if (projectId) {
      query = query.eq('project_id', projectId);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      scrubbing_results: data || [],
    });

  } catch (error) {
    return NextResponse.json({
      error: 'Failed to retrieve scrubbing results',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
