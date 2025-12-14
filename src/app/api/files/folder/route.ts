import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const BUCKET_NAME = 'project-files';

/**
 * POST /api/files/folder
 * Create a new folder (by uploading a .keep file)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { project_id, folder_path, folder_name } = body;

    if (!project_id || !folder_name) {
      return NextResponse.json({ error: 'project_id and folder_name are required' }, { status: 400 });
    }

    // Build full path
    const basePath = folder_path ? `${project_id}/${folder_path}` : project_id;
    const fullPath = `${basePath}/${folder_name}/.keep`;

    // Create folder by uploading an empty .keep file
    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(fullPath, new Uint8Array(0), {
        contentType: 'text/plain',
      });

    if (error) {
      console.error('Error creating folder:', error);
      return NextResponse.json({ error: 'Failed to create folder' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      folder: {
        name: folder_name,
        path: `${basePath}/${folder_name}`,
      },
    });
  } catch (error) {
    console.error('Error in folder POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
