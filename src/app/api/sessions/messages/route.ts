import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * GET /api/sessions/messages
 * Get all messages for a session
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('session_id');

    if (!sessionId) {
      return NextResponse.json({ error: 'session_id is required' }, { status: 400 });
    }

    const { data: messages, error } = await db
      .from('dev_chat_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching messages:', error);
      return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      messages: messages || [],
    });
  } catch (error) {
    console.error('Error in messages GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/sessions/messages
 * Add a message to a session
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      session_id,
      role,
      content,
      input_tokens = 0,
      output_tokens = 0,
      cost_usd = 0,
      model,
      code_blocks,
    } = body;

    if (!session_id || !role || !content) {
      return NextResponse.json(
        { error: 'session_id, role, and content are required' },
        { status: 400 }
      );
    }

    const { data: message, error } = await db
      .from('dev_chat_messages')
      .insert({
        session_id,
        role,
        content,
        input_tokens,
        output_tokens,
        cost_usd,
        model,
        code_blocks,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating message:', error);
      return NextResponse.json({ error: 'Failed to create message' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message,
    });
  } catch (error) {
    console.error('Error in messages POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
