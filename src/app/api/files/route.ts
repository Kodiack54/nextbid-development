import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const BUCKET_NAME = 'project-files';

/**
 * GET /api/files
 * List files for a project, optionally in a specific folder
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('project_id');
    const folder = searchParams.get('folder') || '';

    if (!projectId) {
      return NextResponse.json({ error: 'project_id is required' }, { status: 400 });
    }

    const path = folder ? `${projectId}/${folder}` : projectId;

    const { data: files, error } = await supabase.storage
      .from(BUCKET_NAME)
      .list(path, {
        sortBy: { column: 'name', order: 'asc' },
      });

    if (error) {
      console.error('Error listing files:', error);
      return NextResponse.json({ error: 'Failed to list files' }, { status: 500 });
    }

    // Get public URLs for each file
    const filesWithUrls = files?.map(file => {
      const filePath = folder ? `${projectId}/${folder}/${file.name}` : `${projectId}/${file.name}`;
      const { data: urlData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(filePath);

      return {
        ...file,
        path: filePath,
        url: urlData.publicUrl,
        isFolder: file.id === null, // Supabase returns null id for folders
      };
    }) || [];

    return NextResponse.json({
      success: true,
      files: filesWithUrls,
      currentPath: path,
    });
  } catch (error) {
    console.error('Error in files GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/files
 * Upload a file
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const projectId = formData.get('project_id') as string;
    const folder = formData.get('folder') as string || '';

    if (!file || !projectId) {
      return NextResponse.json({ error: 'file and project_id are required' }, { status: 400 });
    }

    const fileName = file.name;
    const filePath = folder ? `${projectId}/${folder}/${fileName}` : `${projectId}/${fileName}`;

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: true, // Overwrite if exists
      });

    if (error) {
      console.error('Error uploading file:', error);
      return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 });
    }

    // Get public URL
    const { data: urlData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(filePath);

    return NextResponse.json({
      success: true,
      file: {
        name: fileName,
        path: filePath,
        url: urlData.publicUrl,
        size: file.size,
        type: file.type,
      },
    });
  } catch (error) {
    console.error('Error in files POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/files
 * Delete a file or folder
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const path = searchParams.get('path');

    if (!path) {
      return NextResponse.json({ error: 'path is required' }, { status: 400 });
    }

    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([path]);

    if (error) {
      console.error('Error deleting file:', error);
      return NextResponse.json({ error: 'Failed to delete file' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in files DELETE:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
