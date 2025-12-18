import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

// Base directory for project files (on server filesystem)
const STORAGE_BASE = process.env.STORAGE_PATH || '/var/www/NextBid_Dev/storage';
const PUBLIC_URL_BASE = process.env.STORAGE_URL || '/api/files/serve';

interface FileInfo {
  name: string;
  path: string;
  url: string;
  isFolder: boolean;
  size?: number;
  modified?: string;
}

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

    const relativePath = folder ? `${projectId}/${folder}` : projectId;
    const fullPath = path.join(STORAGE_BASE, relativePath);

    // Check if directory exists
    try {
      await fs.access(fullPath);
    } catch {
      // Directory doesn't exist, create it and return empty list
      await fs.mkdir(fullPath, { recursive: true });
      return NextResponse.json({
        success: true,
        files: [],
        currentPath: relativePath,
      });
    }

    const entries = await fs.readdir(fullPath, { withFileTypes: true });
    const files: FileInfo[] = [];

    for (const entry of entries) {
      const entryPath = path.join(fullPath, entry.name);
      const entryRelativePath = folder ? `${projectId}/${folder}/${entry.name}` : `${projectId}/${entry.name}`;

      let size: number | undefined;
      let modified: string | undefined;

      if (!entry.isDirectory()) {
        const stats = await fs.stat(entryPath);
        size = stats.size;
        modified = stats.mtime.toISOString();
      }

      files.push({
        name: entry.name,
        path: entryRelativePath,
        url: `${PUBLIC_URL_BASE}?path=${encodeURIComponent(entryRelativePath)}`,
        isFolder: entry.isDirectory(),
        size,
        modified,
      });
    }

    // Sort: folders first, then alphabetically
    files.sort((a, b) => {
      if (a.isFolder && !b.isFolder) return -1;
      if (!a.isFolder && b.isFolder) return 1;
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json({
      success: true,
      files,
      currentPath: relativePath,
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
    const relativePath = folder ? `${projectId}/${folder}` : projectId;
    const fullDir = path.join(STORAGE_BASE, relativePath);
    const fullPath = path.join(fullDir, fileName);
    const fileRelativePath = `${relativePath}/${fileName}`;

    // Ensure directory exists
    await fs.mkdir(fullDir, { recursive: true });

    // Convert file to buffer and write
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    await fs.writeFile(fullPath, buffer);

    return NextResponse.json({
      success: true,
      file: {
        name: fileName,
        path: fileRelativePath,
        url: `${PUBLIC_URL_BASE}?path=${encodeURIComponent(fileRelativePath)}`,
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
    const filePath = searchParams.get('path');

    if (!filePath) {
      return NextResponse.json({ error: 'path is required' }, { status: 400 });
    }

    const fullPath = path.join(STORAGE_BASE, filePath);

    // Check what type of entry it is
    const stats = await fs.stat(fullPath);

    if (stats.isDirectory()) {
      await fs.rm(fullPath, { recursive: true });
    } else {
      await fs.unlink(fullPath);
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }
    console.error('Error in files DELETE:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
