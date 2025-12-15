import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// Claude Haiku pricing (Chad uses Claude for chat)
const HAIKU_PRICING = { input: 0.25, output: 1.25 }; // per 1M tokens

/**
 * Proxy to Chad's chat endpoint
 * Frontend calls /api/chad/chat -> server proxies to localhost:5401/api/chat
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.json();

    const response = await fetch('http://localhost:5401/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    // Log usage for Chad (estimate tokens since we don't get exact count)
    const inputTokens = Math.ceil((body.message?.length || 0) / 4);
    const outputTokens = Math.ceil((data.reply?.length || 0) / 4);
    const costUsd = (inputTokens / 1_000_000) * HAIKU_PRICING.input +
                    (outputTokens / 1_000_000) * HAIKU_PRICING.output;

    await supabase.from('dev_ai_usage').insert({
      user_id: body.user_id || 'anonymous',
      project_id: body.project_id || null,
      model: 'claude-3-haiku',
      assistant_name: 'chad',
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost_usd: costUsd,
      request_type: 'chat',
      prompt_preview: body.message?.slice(0, 255),
      response_time_ms: Date.now() - startTime,
    });

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Chad proxy error:', error.message);
    return NextResponse.json(
      { success: false, error: 'Failed to connect to Chad', reply: 'Sorry, I\'m having connection issues. Try again?' },
      { status: 500 }
    );
  }
}
