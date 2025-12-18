import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST() {
  console.log('[Migration] Adding doc_worker columns to dev_chat_sessions...');

  try {
    // Supabase REST API doesn't support ALTER TABLE directly
    // We need to use a different approach - create the columns by doing an insert/update pattern
    // or the user needs to run this SQL in the dashboard:

    // First, check if columns exist by trying to select them
    const { error: checkError } = await db
      .from('dev_chat_sessions')
      .select('doc_worker_processed')
      .limit(1);

    if (checkError && checkError.message.includes('does not exist')) {
      // Columns don't exist - user needs to add them via Supabase Dashboard
      return NextResponse.json({
        success: false,
        message: 'Columns do not exist. Please run this SQL in Supabase Dashboard:',
        sql: `
ALTER TABLE dev_chat_sessions
ADD COLUMN IF NOT EXISTS doc_worker_processed BOOLEAN DEFAULT FALSE;

ALTER TABLE dev_chat_sessions
ADD COLUMN IF NOT EXISTS doc_worker_processed_at TIMESTAMPTZ;
        `.trim(),
        dashboard_url: 'https://db.com/dashboard/project/sgfrqmkimrwmqqnafisw/sql/new'
      });
    }

    // Columns exist
    return NextResponse.json({
      success: true,
      message: 'Columns already exist! Doc worker is ready to use.'
    });

  } catch (error: any) {
    console.error('[Migration] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'POST to this endpoint to check/create doc worker columns',
    required_sql: `
ALTER TABLE dev_chat_sessions
ADD COLUMN IF NOT EXISTS doc_worker_processed BOOLEAN DEFAULT FALSE;

ALTER TABLE dev_chat_sessions
ADD COLUMN IF NOT EXISTS doc_worker_processed_at TIMESTAMPTZ;
    `.trim()
  });
}
