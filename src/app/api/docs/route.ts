import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs/promises';
import * as path from 'path';

const PROJECTS_BASE_PATH = '/var/www/NextBid_Dev';
const DOCS_FOLDER = 'docs';

interface DocFile {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: DocFile[];
  modified?: string;
  size?: number;
}

function parseFrontMatter(content: string): { metadata: Record<string, string>; body: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) {
    return { metadata: {}, body: content };
  }

  const metadata: Record<string, string> = {};
  match[1].split('\n').forEach(line => {
    const [key, ...valueParts] = line.split(':');
    if (key && valueParts.length) {
      metadata[key.trim()] = valueParts.join(':').trim().replace(/^"|"$/g, '');
    }
  });

  return { metadata, body: match[2] };
}

async function buildDocTree(dirPath: string, basePath: string): Promise<DocFile[]> {
  const items: DocFile[] = [];

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      const relativePath = path.relative(basePath, fullPath).replace(/\\/g, '/');

      if (entry.isDirectory()) {
        const children = await buildDocTree(fullPath, basePath);
        if (children.length > 0) {
          items.push({
            name: entry.name,
            path: relativePath,
            type: 'folder',
            children,
          });
        }
      } else if (entry.name.endsWith('.md')) {
        const stats = await fs.stat(fullPath);
        items.push({
          name: entry.name.replace('.md', ''),
          path: relativePath,
          type: 'file',
          modified: stats.mtime.toISOString(),
          size: stats.size,
        });
      }
    }
  } catch (err) {
    // Directory doesn't exist yet
  }

  // Sort: folders first, then files alphabetically
  return items.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

/**
 * GET /api/docs
 * List all documents or get content of a specific document
 *
 * Query params:
 * - path: Get specific document content
 * - project_path: Override project path (optional)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const docPath = searchParams.get('path');
  const projectPath = searchParams.get('project_path') || path.join(PROJECTS_BASE_PATH, 'dev-studio-5000');
  const docsBasePath = path.join(projectPath, DOCS_FOLDER);

  try {
    if (docPath) {
      // Get specific document content
      const fullPath = path.join(docsBasePath, docPath);

      // Security check - prevent path traversal
      if (!path.normalize(fullPath).startsWith(path.normalize(docsBasePath))) {
        return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
      }

      const content = await fs.readFile(fullPath, 'utf-8');
      const { metadata, body } = parseFrontMatter(content);

      return NextResponse.json({
        success: true,
        path: docPath,
        content: body,
        metadata: {
          title: metadata.title || docPath.split('/').pop()?.replace('.md', ''),
          category: metadata.category || 'unknown',
          author: metadata.author || 'Unknown',
          version: metadata.version || '1.0.0',
          created_at: metadata.created_at || '',
          updated_at: metadata.updated_at || '',
        },
      });
    } else {
      // List all documents
      const docs = await buildDocTree(docsBasePath, docsBasePath);

      return NextResponse.json({
        success: true,
        docs,
        base_path: DOCS_FOLDER,
      });
    }
  } catch (error: any) {
    console.error('Docs API error:', error);
    if (error.code === 'ENOENT') {
      return NextResponse.json({
        success: true,
        docs: [],
        message: 'No docs folder found yet',
      });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
