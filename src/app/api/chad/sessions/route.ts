import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

/**
 * GET /api/chad/sessions
 * Get Chad's session dumps from dev_ai_sessions
 * Shows pending dumps first, then recent processed ones
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status'); // pending_review, processed, all
    const limit = parseInt(searchParams.get('limit') || '50');

    let query = supabase
      .from('dev_ai_sessions')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(limit);

    // Filter by status if specified
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    const { data: sessions, error } = await query;

    if (error) {
      console.error('Error fetching Chad sessions:', error);
      return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 });
    }

    // Transform for UI
    const transformed = (sessions || []).map(s => ({
      id: s.id,
      title: s.source_name || s.project_path || 'Unknown Source',
      status: s.status,
      started_at: s.started_at,
      ended_at: s.ended_at,
      summary: s.summary,
      source_type: s.source_type,
      source_name: s.source_name,
      message_count: s.message_count,
      project_path: s.project_path,
      // Show if Susan has processed this
      processed_by_susan: s.status === 'processed',
      needs_review: s.status === 'pending_review'
    }));

    // Count pending
    const pendingCount = transformed.filter(s => s.needs_review).length;

    return NextResponse.json({
      success: true,
      sessions: transformed,
      pendingCount,
      total: transformed.length
    });
  } catch (error) {
    console.error('Error in chad sessions GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/chad/sessions
 * Mark a session as processed by Susan
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { session_id, status, summary, processed_by } = body;

    if (!session_id) {
      return NextResponse.json({ error: 'session_id is required' }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};

    if (status) {
      updates.status = status;
      if (status === 'processed') {
        updates.processed_at = new Date().toISOString();
        updates.processed_by = processed_by || 'susan';
      }
    }

    if (summary) {
      updates.summary = summary;
    }

    const { data: session, error } = await supabase
      .from('dev_ai_sessions')
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
      session
    });
  } catch (error) {
    console.error('Error in chad sessions PATCH:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
