import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

const CHAD_URL = process.env.CHAD_URL || 'http://localhost:5401';

/**
 * DocWorker - Triggers Chad's cataloger to process sessions
 *
 * Flow:
 * 1. Chad dumps sessions to dev_ai_sessions every 30 min
 * 2. Chad's cataloger extracts knowledge using Claude Haiku
 * 3. Chad sends extracted data to Susan's /api/catalog
 * 4. Susan stores todos, knowledge, code changes, etc.
 * 5. Data appears in the UI's Knowledge, Todos, etc. tabs
 *
 * This worker just triggers Chad's cataloger on demand.
 * Chad already runs the cataloger every 30 min automatically.
 */

export async function POST(request: NextRequest) {
  console.log('[DocWorker] Triggering Chad cataloger...');

  try {
    const body = await request.json().catch(() => ({}));
    const sessionId = body.session_id;

    let result;

    if (sessionId) {
      // Catalog a specific session
      console.log('[DocWorker] Cataloging specific session:', sessionId);
      const response = await fetch(`${CHAD_URL}/api/catalog/session/${sessionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[DocWorker] Chad catalog session error:', errorText);
        return NextResponse.json({ error: errorText }, { status: 500 });
      }

      result = await response.json();
    } else {
      // Trigger full catalog cycle
      console.log('[DocWorker] Triggering full catalog cycle...');
      const response = await fetch(`${CHAD_URL}/api/catalog/trigger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[DocWorker] Chad catalog trigger error:', errorText);
        return NextResponse.json({ error: errorText }, { status: 500 });
      }

      result = await response.json();
    }

    console.log('[DocWorker] Chad cataloger result:', result);

    return NextResponse.json({
      success: true,
      message: sessionId ? 'Session cataloged' : 'Catalog cycle triggered',
      result,
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('[DocWorker] Error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET endpoint to check worker status and recent activity
export async function GET() {
  try {
    // Check Chad's health
    let chadStatus = 'unknown';
    try {
      const chadHealth = await fetch(`${CHAD_URL}/health`);
      if (chadHealth.ok) {
        const health = await chadHealth.json();
        chadStatus = health.status || 'ok';
      }
    } catch {
      chadStatus = 'unreachable';
    }

    // Get counts of processed vs unprocessed sessions
    const { data: statsData } = await db
      .from('dev_ai_sessions')
      .select('last_cataloged_at, status')
      .limit(100);
    const stats = (statsData || []) as Array<Record<string, unknown>>;

    const cataloged = stats.filter(s => s.last_cataloged_at !== null).length || 0;
    const pending = stats.filter(s => s.last_cataloged_at === null && s.status === 'completed').length || 0;
    const active = stats.filter(s => s.status === 'active').length || 0;

    // Get recent cataloged sessions
    const { data: recent } = await db
      .from('dev_ai_sessions')
      .select('id, project_path, started_at, last_cataloged_at')
      .not('last_cataloged_at', 'is', null)
      .order('last_cataloged_at', { ascending: false })
      .limit(5);

    return NextResponse.json({
      status: 'ready',
      chad_status: chadStatus,
      stats: { cataloged, pending, active },
      recent_cataloged: recent || [],
      message: 'POST to trigger Chad cataloger (extracts knowledge → sends to Susan)',
      endpoints: {
        trigger_all: 'POST /api/doc-worker',
        trigger_session: 'POST /api/doc-worker with { session_id: "..." }',
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
