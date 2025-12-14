import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// Claude pricing (per 1M tokens)
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'claude-3-opus-20240229': { input: 15.0, output: 75.0 },
  'claude-3-sonnet-20240229': { input: 3.0, output: 15.0 },
  'claude-3-haiku-20240307': { input: 0.25, output: 1.25 },
  'claude-3-5-sonnet-20241022': { input: 3.0, output: 15.0 },
  'claude-sonnet-4-20250514': { input: 3.0, output: 15.0 },
};

function calculateCost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = MODEL_PRICING[model] || MODEL_PRICING['claude-3-5-sonnet-20241022'];
  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;
  return inputCost + outputCost;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * POST /api/chat
 * Streaming chat with Claude
 */
export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();

  try {
    const body = await request.json();
    const {
      messages,
      user_id,
      project_id,
      model = 'claude-sonnet-4-20250514',
      system_prompt,
    } = body;

    // Validate
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: 'messages array required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!user_id) {
      return new Response(JSON.stringify({ error: 'user_id required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey || apiKey === 'your-anthropic-api-key-here') {
      return new Response(JSON.stringify({ error: 'Anthropic API key not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Build system prompt
    const defaultSystemPrompt = `You are Claude, an AI coding assistant in the NextBid Development Environment.
You help developers with code review, debugging, refactoring, and writing new features.

When providing code solutions:
- Always wrap code in \`\`\`language blocks
- Be concise but thorough
- Explain your reasoning when helpful
- Ask for clarification if the request is ambiguous

Current context:
- Project: ${project_id ? 'Active project selected' : 'No project selected'}
- User is working in a web-based development environment`;

    const finalSystemPrompt = system_prompt || defaultSystemPrompt;

    // Start timing
    const startTime = Date.now();

    // Call Anthropic API with streaming
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        system: finalSystemPrompt,
        messages: messages.map((m: Message) => ({
          role: m.role,
          content: m.content,
        })),
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Anthropic API error:', errorData);
      return new Response(JSON.stringify({ error: 'Claude API error', details: errorData }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Stream the response
    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body?.getReader();
        if (!reader) {
          controller.close();
          return;
        }

        const decoder = new TextDecoder();
        let fullContent = '';
        let inputTokens = 0;
        let outputTokens = 0;

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') continue;

                try {
                  const parsed = JSON.parse(data);

                  if (parsed.type === 'content_block_delta') {
                    const text = parsed.delta?.text || '';
                    fullContent += text;
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'content', text })}\n\n`));
                  } else if (parsed.type === 'message_start') {
                    inputTokens = parsed.message?.usage?.input_tokens || 0;
                  } else if (parsed.type === 'message_delta') {
                    outputTokens = parsed.usage?.output_tokens || 0;
                  }
                } catch {
                  // Not JSON, skip
                }
              }
            }
          }

          // Calculate final stats
          const responseTime = Date.now() - startTime;
          const cost = calculateCost(model, inputTokens, outputTokens);

          // Log usage to database
          await supabase.from('dev_ai_usage').insert({
            user_id,
            project_id,
            model,
            input_tokens: inputTokens,
            output_tokens: outputTokens,
            cost_usd: cost,
            request_type: 'chat',
            prompt_preview: messages[messages.length - 1]?.content?.slice(0, 255),
            response_time_ms: responseTime,
          });

          // Send final stats
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: 'done',
                usage: {
                  input_tokens: inputTokens,
                  output_tokens: outputTokens,
                  cost_usd: Math.round(cost * 1000000) / 1000000,
                  response_time_ms: responseTime,
                },
              })}\n\n`
            )
          );

          controller.close();
        } catch (error) {
          console.error('Stream error:', error);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', error: 'Stream error' })}\n\n`));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Chat API error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
