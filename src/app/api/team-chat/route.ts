import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// Use dev_chat_messages table for team chat in dev environment
const CHANNEL_NAME = 'dev-environment';

/**
 * GET /api/team-chat
 * Get recent team chat messages
 */
export async function GET() {
  try {
    // First, ensure the dev-environment channel exists
    const { data: channel } = await supabase
      .from('dev_chat_channels')
      .select('id')
      .eq('name', CHANNEL_NAME)
      .single();

    if (!channel) {
      // Create the channel if it doesn't exist
      const { data: newChannel } = await supabase
        .from('dev_chat_channels')
        .insert({
          name: CHANNEL_NAME,
          type: 'channel',
          description: 'Dev Environment team chat',
          is_private: false
        })
        .select('id')
        .single();

      if (!newChannel) {
        return NextResponse.json({ success: true, messages: [] });
      }
    }

    const channelId = channel?.id;

    // Get recent messages
    const { data: messages, error } = await supabase
      .from('dev_chat_messages')
      .select('id, user_name, content, created_at')
      .eq('channel_id', channelId)
      .order('created_at', { ascending: true })
      .limit(50);

    if (error) {
      console.error('Error fetching messages:', error);
      return NextResponse.json({ success: true, messages: [] });
    }

    return NextResponse.json({
      success: true,
      messages: messages || []
    });
  } catch (error) {
    console.error('Error in team-chat GET:', error);
    return NextResponse.json({ success: true, messages: [] });
  }
}

/**
 * POST /api/team-chat
 * Send a new team chat message
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_id, user_name, content } = body;

    if (!content?.trim()) {
      return NextResponse.json({ error: 'Message content required' }, { status: 400 });
    }

    // Get or create channel
    let { data: channel } = await supabase
      .from('dev_chat_channels')
      .select('id')
      .eq('name', CHANNEL_NAME)
      .single();

    if (!channel) {
      const { data: newChannel } = await supabase
        .from('dev_chat_channels')
        .insert({
          name: CHANNEL_NAME,
          type: 'channel',
          description: 'Dev Environment team chat',
          is_private: false
        })
        .select('id')
        .single();

      channel = newChannel;
    }

    if (!channel) {
      return NextResponse.json({ error: 'Failed to create channel' }, { status: 500 });
    }

    // Insert message
    const { data: message, error } = await supabase
      .from('dev_chat_messages')
      .insert({
        channel_id: channel.id,
        user_id: user_id,
        user_name: user_name,
        content: content.trim()
      })
      .select()
      .single();

    if (error) {
      console.error('Error sending message:', error);
      return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message
    });
  } catch (error) {
    console.error('Error in team-chat POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
