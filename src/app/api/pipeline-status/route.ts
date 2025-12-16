import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

/**
 * GET /api/pipeline-status
 * Shows the current state of the Chad → Susan pipeline
 */
export async function GET() {
  try {
    // Get counts from all tables
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
      supabase.from('dev_ai_sessions').select('id', { count: 'exact', head: true }),
      supabase.from('dev_ai_messages').select('id', { count: 'exact', head: true }),
      supabase.from('dev_ai_todos').select('id', { count: 'exact', head: true }),
      supabase.from('dev_ai_knowledge').select('id', { count: 'exact', head: true }),
      supabase.from('dev_ai_code_changes').select('id', { count: 'exact', head: true }).catch(() => ({ count: 0 })),
      supabase.from('dev_ai_structure_items').select('id', { count: 'exact', head: true }).catch(() => ({ count: 0 })),
      supabase.from('dev_ai_decisions').select('id', { count: 'exact', head: true }).catch(() => ({ count: 0 })),
      supabase.from('dev_ai_sessions').select('id', { count: 'exact', head: true }).is('last_cataloged_at', null),
      supabase.from('dev_ai_sessions').select('id', { count: 'exact', head: true }).not('last_cataloged_at', 'is', null),
    ]);

    // Get recent activity
    const { data: recentKnowledge } = await supabase
      .from('dev_ai_knowledge')
      .select('title, category, created_at')
      .order('created_at', { ascending: false })
      .limit(5);

    const { data: recentTodos } = await supabase
      .from('dev_ai_todos')
      .select('title, status, created_at')
      .order('created_at', { ascending: false })
      .limit(5);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),

      // Raw counts
      counts: {
        sessions: sessions.count || 0,
        messages: messages.count || 0,
        todos: todos.count || 0,
        knowledge: knowledge.count || 0,
        codeChanges: codeChanges.count || 0,
        structureItems: structureItems.count || 0,
        decisions: decisions.count || 0,
      },

      // Pipeline status
      pipeline: {
        pending: pendingSessions.count || 0,
        cataloged: catalogedSessions.count || 0,
        progress: catalogedSessions.count && sessions.count
          ? Math.round((catalogedSessions.count / sessions.count) * 100)
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
