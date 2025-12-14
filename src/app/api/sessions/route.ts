import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

/**
 * GET /api/sessions
 * List sessions for a user, optionally filtered by project
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');
    const projectId = searchParams.get('project_id');
    const status = searchParams.get('status'); // active, ended, archived
    const limit = parseInt(searchParams.get('limit') || '20');

    let query = supabase
      .from('dev_chat_sessions')
      .select(`
        *,
        dev_users(name, email),
        dev_projects(name, slug)
      `)
      .order('started_at', { ascending: false })
      .limit(limit);

    if (userId) {
      query = query.eq('user_id', userId);
    }

    if (projectId) {
      query = query.eq('project_id', projectId);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data: sessions, error } = await query;

    if (error) {
      console.error('Error fetching sessions:', error);
      return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      sessions: sessions || [],
    });
  } catch (error) {
    console.error('Error in sessions GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/sessions
 * Create a new chat session
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_id, project_id, title } = body;

    if (!user_id) {
      return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
    }

    // End any active sessions for this user first
    await supabase
      .from('dev_chat_sessions')
      .update({ status: 'ended', ended_at: new Date().toISOString() })
      .eq('user_id', user_id)
      .eq('status', 'active');

    // Create new session
    const { data: session, error } = await supabase
      .from('dev_chat_sessions')
      .insert({
        user_id,
        project_id,
        title: title || `Session ${new Date().toLocaleDateString()}`,
        status: 'active',
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating session:', error);
      return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      session,
    });
  } catch (error) {
    console.error('Error in sessions POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/sessions
 * Update a session (end it, update title, etc.)
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { session_id, status, title, summary } = body;

    if (!session_id) {
      return NextResponse.json({ error: 'session_id is required' }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};

    if (status) {
      updates.status = status;
      if (status === 'ended') {
        updates.ended_at = new Date().toISOString();
      }
    }

    if (title) {
      updates.title = title;
    }

    if (summary) {
      updates.summary = summary;
      updates.summary_generated_at = new Date().toISOString();
    }

    const { data: session, error } = await supabase
      .from('dev_chat_sessions')
      .update(updates)
      .eq('id', session_id)
      .select()
      .single();

    if (error) {
      console.error('Error updating session:', error);
      return NextResponse.json({ error: 'Failed to update session' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      session,
    });
  } catch (error) {
    console.error('Error in sessions PATCH:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
