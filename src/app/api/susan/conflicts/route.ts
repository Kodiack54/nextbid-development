import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

/**
 * GET /api/susan/conflicts
 * Get pending conflicts for user resolution
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'pending';
    const projectPath = searchParams.get('project_path');

    let query = supabase
      .from('dev_ai_conflicts')
      .select('*')
      .order('created_at', { ascending: false });

    if (status !== 'all') {
      query = query.eq('status', status);
    }

    if (projectPath) {
      query = query.eq('project_path', projectPath);
    }

    const { data: conflicts, error } = await query.limit(50);

    if (error) {
      console.error('Error fetching conflicts:', error);
      return NextResponse.json({ error: 'Failed to fetch conflicts' }, { status: 500 });
    }

    // Get pending count
    const { count: pendingCount } = await supabase
      .from('dev_ai_conflicts')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    return NextResponse.json({
      success: true,
      conflicts: conflicts || [],
      pendingCount: pendingCount || 0
    });
  } catch (error) {
    console.error('Error in conflicts GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/susan/conflicts
 * Resolve a conflict
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { conflict_id, resolution } = body;
    // resolution: 'keep_new' | 'keep_existing' | 'keep_both' | 'dismiss'

    if (!conflict_id || !resolution) {
      return NextResponse.json(
        { error: 'conflict_id and resolution are required' },
        { status: 400 }
      );
    }

    // Get the conflict
    const { data: conflict, error: fetchErr } = await supabase
      .from('dev_ai_conflicts')
      .select('*')
      .eq('id', conflict_id)
      .single();

    if (fetchErr || !conflict) {
      return NextResponse.json({ error: 'Conflict not found' }, { status: 404 });
    }

    // Apply resolution
    if (resolution === 'keep_new' || resolution === 'keep_both') {
      const newItem = conflict.new_item;
      const tableName = `dev_ai_${conflict.conflict_type}s`; // todos, knowledge, decisions

      // Build insert object based on conflict type
      let insertData: Record<string, unknown> = {
        project_path: conflict.project_path,
        title: newItem.title
      };

      if (conflict.conflict_type === 'todo') {
        insertData = {
          ...insertData,
          description: newItem.description,
          priority: newItem.priority || 'medium',
          status: 'pending'
        };
      } else if (conflict.conflict_type === 'knowledge') {
        insertData = {
          ...insertData,
          summary: newItem.content || newItem.summary,
          category: newItem.category || 'general',
          importance: 5
        };
      } else if (conflict.conflict_type === 'decision') {
        insertData = {
          ...insertData,
          decision: newItem.content || newItem.decision,
          rationale: newItem.rationale || ''
        };
      }

      const { error: insertErr } = await supabase
        .from(tableName)
        .insert(insertData);

      if (insertErr) {
        console.error('Error inserting resolved item:', insertErr);
        // Continue anyway - mark conflict as resolved
      }
    }

    // Mark conflict as resolved
    const { error: updateErr } = await supabase
      .from('dev_ai_conflicts')
      .update({
        status: 'resolved',
        resolution,
        resolved_at: new Date().toISOString()
      })
      .eq('id', conflict_id);

    if (updateErr) {
      return NextResponse.json({ error: 'Failed to update conflict' }, { status: 500 });
    }

    return NextResponse.json({ success: true, resolution });
  } catch (error) {
    console.error('Error in conflicts POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
