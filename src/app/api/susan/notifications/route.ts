import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

/**
 * GET /api/susan/notifications
 * Get Susan's notifications for the user
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'unread';
    const limit = parseInt(searchParams.get('limit') || '20');

    let query = supabase
      .from('dev_ai_notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (status !== 'all') {
      query = query.eq('status', status);
    }

    const { data: notifications, error } = await query;

    if (error) {
      console.error('Error fetching notifications:', error);
      return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 });
    }

    // Get unread count
    const { count: unreadCount } = await supabase
      .from('dev_ai_notifications')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'unread');

    return NextResponse.json({
      success: true,
      notifications: notifications || [],
      unreadCount: unreadCount || 0
    });
  } catch (error) {
    console.error('Error in notifications GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/susan/notifications
 * Mark notifications as read
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { notification_id, mark_all } = body;

    if (mark_all) {
      const { error } = await supabase
        .from('dev_ai_notifications')
        .update({ status: 'read', read_at: new Date().toISOString() })
        .eq('status', 'unread');

      if (error) throw error;
    } else if (notification_id) {
      const { error } = await supabase
        .from('dev_ai_notifications')
        .update({ status: 'read', read_at: new Date().toISOString() })
        .eq('id', notification_id);

      if (error) throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in notifications PATCH:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
