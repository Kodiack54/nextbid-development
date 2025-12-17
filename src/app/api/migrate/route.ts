import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

/**
 * POST /api/migrate
 * Run database migrations
 */
export async function POST(request: NextRequest) {
  try {
    const { migration } = await request.json();

    if (migration === 'add_sort_order') {
      // Check if column exists by trying to select it
      const { data, error } = await supabase
        .from('dev_project_paths')
        .select('sort_order')
        .limit(1);

      if (error && error.message.includes('sort_order')) {
        // Column doesn't exist - we need to add it via Supabase Dashboard
        return NextResponse.json({
          success: false,
          message: 'Column sort_order does not exist. Please add it via Supabase Dashboard: ALTER TABLE dev_project_paths ADD COLUMN sort_order integer DEFAULT 0;'
        });
      }

      // Column exists or was created
      return NextResponse.json({
        success: true,
        message: 'Column sort_order exists'
      });
    }

    return NextResponse.json({ error: 'Unknown migration' }, { status: 400 });
  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json({ error: 'Migration failed' }, { status: 500 });
  }
}
