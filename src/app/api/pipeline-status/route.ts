import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * GET /api/pipeline-status
 * Shows the current state of the Chad → Susan pipeline
 */
export async function GET() {
  try {
    // Get counts from all tables
    // Helper to safely get count
    const getCount = async (table: string, filter?: { column: string; op: 'is' | 'not'; value: null }) => {
      try {
        let query = db.from(table).select('id', { count: 'exact', head: true });
        if (filter) {
          if (filter.op === 'is') {
            query = query.is(filter.column, filter.value);
          } else {
            query = query.not(filter.column, 'is', filter.value);
          }
        }
        const result = await query;
        return result.count || 0;
      } catch {
        return 0;
      }
    };

    const [
      sessions,
      messages,
      todos,
      knowledge,
      codeChanges,
      structureItems,
      decisions,
      pendingSessions,
      catalogedSessions
    ] = await Promise.all([
      getCount('dev_ai_sessions'),
      getCount('dev_ai_messages'),
      getCount('dev_ai_todos'),
      getCount('dev_ai_knowledge'),
      getCount('dev_ai_code_changes'),
      getCount('dev_ai_structure_items'),
      getCount('dev_ai_decisions'),
      getCount('dev_ai_sessions', { column: 'last_cataloged_at', op: 'is', value: null }),
      getCount('dev_ai_sessions', { column: 'last_cataloged_at', op: 'not', value: null }),
    ]);

    // Get recent activity
    const { data: recentKnowledge } = await db
      .from('dev_ai_knowledge')
      .select('title, category, created_at')
      .order('created_at', { ascending: false })
      .limit(5);

    const { data: recentTodos } = await db
      .from('dev_ai_todos')
      .select('title, status, created_at')
      .order('created_at', { ascending: false })
      .limit(5);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),

      // Raw counts
      counts: {
        sessions,
        messages,
        todos,
        knowledge,
        codeChanges,
        structureItems,
        decisions,
      },

      // Pipeline status
      pipeline: {
        pending: pendingSessions,
        cataloged: catalogedSessions,
        progress: catalogedSessions && sessions
          ? Math.round((catalogedSessions / sessions) * 100)
          : 0,
      },

      // Recent activity
      recent: {
        knowledge: recentKnowledge || [],
        todos: recentTodos || [],
      },
    });
  } catch (error: any) {
    console.error('Pipeline status error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
