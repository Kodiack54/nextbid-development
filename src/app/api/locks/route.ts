import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

/**
 * GET /api/locks
 * List all active locks
 */
export async function GET(request: NextRequest) {
  try {
    const { data: locks, error } = await supabase
      .from('dev_active_locks')
      .select('*');

    if (error) {
      console.error('Error fetching locks:', error);
      return NextResponse.json({ error: 'Failed to fetch locks' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      locks: locks || [],
    });
  } catch (error) {
    console.error('Error in locks GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/locks
 * Lock a project
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { project_id, user_id, branch, purpose, environment } = body;

    if (!project_id || !user_id) {
      return NextResponse.json(
        { error: 'project_id and user_id are required' },
        { status: 400 }
      );
    }

    const { data: existingLock } = await supabase
      .from('dev_project_locks')
      .select('*, dev_users(name)')
      .eq('project_id', project_id)
      .eq('is_active', true)
      .single();

    if (existingLock) {
      return NextResponse.json(
        {
          error: 'Project is already locked',
          locked_by: existingLock.dev_users?.name || 'Unknown',
          locked_at: existingLock.locked_at,
        },
        { status: 409 }
      );
    }

    const { data: lock, error } = await supabase
      .from('dev_project_locks')
      .insert({
        project_id,
        locked_by: user_id,
        branch: branch || 'dev',
        purpose: purpose || 'Development',
        environment: environment || 'dev',
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating lock:', error);
      return NextResponse.json({ error: 'Failed to lock project' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      lock,
      message: 'Project locked successfully',
    });
  } catch (error) {
    console.error('Error in locks POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/locks
 * Unlock a project (requires patch notes)
 */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      project_id,
      user_id,
      patch_notes,
      changes_summary,
      commit_hash,
      change_type,
    } = body;

    if (!project_id || !user_id || !patch_notes) {
      return NextResponse.json(
        { error: 'project_id, user_id, and patch_notes are required' },
        { status: 400 }
      );
    }

    const { data: currentLock } = await supabase
      .from('dev_project_locks')
      .select('*')
      .eq('project_id', project_id)
      .eq('is_active', true)
      .single();

    if (!currentLock) {
      return NextResponse.json(
        { error: 'Project is not locked' },
        { status: 404 }
      );
    }

    const lockedAt = new Date(currentLock.locked_at);
    const now = new Date();
    const lockDurationMinutes = Math.round((now.getTime() - lockedAt.getTime()) / 60000);

    const { error: updateError } = await supabase
      .from('dev_project_locks')
      .update({ is_active: false })
      .eq('id', currentLock.id);

    if (updateError) {
      console.error('Error updating lock:', updateError);
      return NextResponse.json({ error: 'Failed to unlock project' }, { status: 500 });
    }

    const { data: history, error: historyError } = await supabase
      .from('dev_project_unlock_history')
      .insert({
        project_id,
        lock_id: currentLock.id,
        unlocked_by: user_id,
        patch_notes,
        changes_summary,
        commit_hash,
        change_type: change_type || 'feature',
        lock_duration_minutes: lockDurationMinutes,
      })
      .select()
      .single();

    if (historyError) {
      console.error('Error creating unlock history:', historyError);
    }

    return NextResponse.json({
      success: true,
      message: 'Project unlocked successfully',
      history,
      duration_minutes: lockDurationMinutes,
    });
  } catch (error) {
    console.error('Error in locks DELETE:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
