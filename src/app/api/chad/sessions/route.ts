import { NextRequest, NextResponse } from 'next/server';

const CHAD_URL = process.env.CHAD_URL || 'http://localhost:5401';

/**
 * GET /api/chad/sessions
 * Proxy to Chad's /api/sessions endpoint
 * Gets all sessions Chad has recorded
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit') || '50';

    // Proxy to Chad's actual sessions endpoint
    const response = await fetch(`${CHAD_URL}/api/sessions?limit=${limit}`, {
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      console.error('Chad sessions error:', response.status);
      return NextResponse.json({ error: 'Failed to fetch from Chad' }, { status: 500 });
    }

    const sessions = await response.json();

    // Transform for UI - Chad returns array directly
    const transformed = (Array.isArray(sessions) ? sessions : []).map((s: any) => ({
      id: s.id,
      title: s.project_path?.split('/').pop() || 'Unknown',
      status: s.status,
      started_at: s.started_at,
      ended_at: s.ended_at,
      summary: s.summary,
      source_type: s.source_type || 'terminal',
      source_name: s.source_name || s.project_path,
      message_count: s.message_count,
      project_path: s.project_path,
      // Show if Susan has processed this
      processed_by_susan: s.status === 'processed' || s.status === 'cataloged',
      needs_review: s.status === 'active' || s.status === 'pending_review'
    }));

    // Count pending (active sessions need review)
    const pendingCount = transformed.filter((s: any) => s.needs_review).length;

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
 * Update a session (mark as processed, add summary, etc.)
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { session_id, status, summary } = body;

    if (!session_id) {
      return NextResponse.json({ error: 'session_id is required' }, { status: 400 });
    }

    // Proxy to Chad's session update endpoint
    const response = await fetch(`${CHAD_URL}/api/sessions/${session_id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, summary })
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to update session' }, { status: 500 });
    }

    const result = await response.json();
    return NextResponse.json({ success: true, session: result });
  } catch (error) {
    console.error('Error in chad sessions PATCH:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
