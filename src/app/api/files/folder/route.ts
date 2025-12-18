import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

// Base directory for project files (on server filesystem)
const STORAGE_BASE = process.env.STORAGE_PATH || '/var/www/NextBid_Dev/storage';

/**
 * POST /api/files/folder
 * Create a new folder
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
    const fullPath = path.join(STORAGE_BASE, basePath, folder_name);

    // Create folder recursively
    await fs.mkdir(fullPath, { recursive: true });

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
