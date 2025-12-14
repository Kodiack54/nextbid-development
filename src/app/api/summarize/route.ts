import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// OpenAI pricing (per 1M tokens)
const OPENAI_PRICING: Record<string, { input: number; output: number }> = {
  'gpt-4o': { input: 2.5, output: 10.0 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-4-turbo': { input: 10.0, output: 30.0 },
};

function calculateCost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = OPENAI_PRICING[model] || OPENAI_PRICING['gpt-4o-mini'];
  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;
  return inputCost + outputCost;
}

/**
 * POST /api/summarize
 * Generate a summary of a chat session using OpenAI
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { session_id, messages, model = 'gpt-4o-mini' } = body;

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
    }

    // If session_id provided, fetch messages from DB
    let chatMessages = messages;
    if (session_id && !messages) {
      const { data: dbMessages, error } = await supabase
        .from('dev_chat_messages')
        .select('role, content')
        .eq('session_id', session_id)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching messages:', error);
        return NextResponse.json({ error: 'Failed to fetch session messages' }, { status: 500 });
      }
      chatMessages = dbMessages;
    }

    if (!chatMessages || chatMessages.length === 0) {
      return NextResponse.json({ error: 'No messages to summarize' }, { status: 400 });
    }

    // Format messages for summary
    const conversationText = chatMessages
      .map((m: { role: string; content: string }) => `${m.role.toUpperCase()}: ${m.content}`)
      .join('\n\n');

    // Call OpenAI
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: `You are a technical session summarizer. Analyze this development conversation and provide:

1. **Summary** (2-3 sentences): What was accomplished in this session?
2. **Key Points** (bullet list): Main topics discussed
3. **Action Items** (bullet list): Things that need to be done
4. **Decisions Made** (bullet list): Any important decisions
5. **Files Changed** (list): Files that were modified or created
6. **Context for Next Session** (1 paragraph): What should the next AI assistant know to continue this work seamlessly?

Be concise but comprehensive. Focus on technical details that would help continuation.`,
          },
          {
            role: 'user',
            content: `Summarize this development session:\n\n${conversationText}`,
          },
        ],
        max_tokens: 2000,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenAI API error:', errorData);
      return NextResponse.json({ error: 'OpenAI API error', details: errorData }, { status: response.status });
    }

    const data = await response.json();
    const summary = data.choices[0]?.message?.content || '';
    const inputTokens = data.usage?.prompt_tokens || 0;
    const outputTokens = data.usage?.completion_tokens || 0;
    const cost = calculateCost(model, inputTokens, outputTokens);

    // Parse the summary into structured data
    const parsed = parseSummary(summary);

    // If session_id provided, save to database
    if (session_id) {
      // Update session with summary
      await supabase
        .from('dev_chat_sessions')
        .update({
          summary: parsed.summary,
          summary_generated_at: new Date().toISOString(),
          key_decisions: parsed.decisions,
          files_discussed: parsed.files,
          todos_generated: parsed.actionItems,
        })
        .eq('id', session_id);

      // Save detailed summary
      await supabase.from('dev_session_summaries').insert({
        session_id,
        summary: parsed.summary,
        key_points: parsed.keyPoints,
        action_items: parsed.actionItems,
        decisions_made: parsed.decisions,
        code_changes: parsed.files,
        context_for_next_session: parsed.contextForNext,
        generated_by: model,
        tokens_used: inputTokens + outputTokens,
        cost_usd: cost,
      });
    }

    return NextResponse.json({
      success: true,
      summary: parsed.summary,
      key_points: parsed.keyPoints,
      action_items: parsed.actionItems,
      decisions: parsed.decisions,
      files: parsed.files,
      context_for_next_session: parsed.contextForNext,
      raw: summary,
      usage: {
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cost_usd: Math.round(cost * 1000000) / 1000000,
      },
    });
  } catch (error) {
    console.error('Summarize API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * Parse the AI-generated summary into structured data
 */
function parseSummary(summary: string): {
  summary: string;
  keyPoints: string[];
  actionItems: string[];
  decisions: string[];
  files: string[];
  contextForNext: string;
} {
  const sections = {
    summary: '',
    keyPoints: [] as string[],
    actionItems: [] as string[],
    decisions: [] as string[],
    files: [] as string[],
    contextForNext: '',
  };

  // Extract Summary section
  const summaryMatch = summary.match(/\*\*Summary\*\*[:\s]*([\s\S]*?)(?=\*\*Key Points\*\*|\*\*Action Items\*\*|$)/i);
  if (summaryMatch) {
    sections.summary = summaryMatch[1].trim();
  }

  // Extract Key Points
  const keyPointsMatch = summary.match(/\*\*Key Points\*\*[:\s]*([\s\S]*?)(?=\*\*Action Items\*\*|\*\*Decisions\*\*|$)/i);
  if (keyPointsMatch) {
    sections.keyPoints = extractBulletPoints(keyPointsMatch[1]);
  }

  // Extract Action Items
  const actionItemsMatch = summary.match(/\*\*Action Items\*\*[:\s]*([\s\S]*?)(?=\*\*Decisions\*\*|\*\*Files\*\*|$)/i);
  if (actionItemsMatch) {
    sections.actionItems = extractBulletPoints(actionItemsMatch[1]);
  }

  // Extract Decisions
  const decisionsMatch = summary.match(/\*\*Decisions Made\*\*[:\s]*([\s\S]*?)(?=\*\*Files\*\*|\*\*Context\*\*|$)/i);
  if (decisionsMatch) {
    sections.decisions = extractBulletPoints(decisionsMatch[1]);
  }

  // Extract Files
  const filesMatch = summary.match(/\*\*Files Changed\*\*[:\s]*([\s\S]*?)(?=\*\*Context\*\*|$)/i);
  if (filesMatch) {
    sections.files = extractBulletPoints(filesMatch[1]);
  }

  // Extract Context for Next Session
  const contextMatch = summary.match(/\*\*Context for Next Session\*\*[:\s]*([\s\S]*?)$/i);
  if (contextMatch) {
    sections.contextForNext = contextMatch[1].trim();
  }

  // Fallback: if no structured data found, use the whole summary
  if (!sections.summary && !sections.keyPoints.length) {
    sections.summary = summary;
  }

  return sections;
}

function extractBulletPoints(text: string): string[] {
  const lines = text.split('\n');
  const points: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('-') || trimmed.startsWith('•') || trimmed.match(/^\d+\./)) {
      const point = trimmed.replace(/^[-•]\s*/, '').replace(/^\d+\.\s*/, '').trim();
      if (point) {
        points.push(point);
      }
    }
  }

  return points;
}
