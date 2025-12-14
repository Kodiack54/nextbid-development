import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs/promises';
import * as path from 'path';

const PROJECTS_BASE_PATH = '/var/www/NextBid_Dev';
const DOCS_FOLDER = 'docs';

// Document categories and their folder structure
const CATEGORIES = {
  training: 'training',
  api: 'api-reference',
  guides: 'guides',
  architecture: 'architecture',
  changelog: 'changelog',
  notes: 'notes',
  meetings: 'meetings',
};

interface DocumentRequest {
  action: 'create' | 'update' | 'append';
  project_path?: string;
  title: string;
  category: string;
  content: string;
  section?: string; // For update action - which section to update
  author?: string;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function generateFrontMatter(title: string, category: string, author: string, version: string, isUpdate: boolean): string {
  const now = new Date().toISOString();
  return `---
title: "${title}"
category: "${category}"
author: "${author}"
version: "${version}"
created_at: "${isUpdate ? '' : now}"
updated_at: "${now}"
---

`;
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

function incrementVersion(version: string): string {
  const parts = version.split('.').map(Number);
  parts[parts.length - 1]++;
  return parts.join('.');
}

/**
 * POST /api/scribe
 * Scribe Worker - handles document creation and updates
 *
 * Actions:
 * - create: Create a new document
 * - update: Update a specific section of a document
 * - append: Add content to the end of a document
 */
export async function POST(request: NextRequest) {
  try {
    const body: DocumentRequest = await request.json();
    const { action, project_path, title, category, content, section, author = 'Chad' } = body;

    if (!title || !content) {
      return NextResponse.json({ error: 'Title and content are required' }, { status: 400 });
    }

    const projectPath = project_path || path.join(PROJECTS_BASE_PATH, 'dev-studio-5000');
    const categoryFolder = CATEGORIES[category as keyof typeof CATEGORIES] || 'notes';
    const docsPath = path.join(projectPath, DOCS_FOLDER, categoryFolder);
    const fileName = `${slugify(title)}.md`;
    const filePath = path.join(docsPath, fileName);

    // Ensure docs directory exists
    await fs.mkdir(docsPath, { recursive: true });

    let result: { path: string; action: string; words: number; version: string };

    switch (action) {
      case 'create': {
        // Check if file already exists
        try {
          await fs.access(filePath);
          return NextResponse.json({
            error: `Document "${title}" already exists. Use 'update' or 'append' action instead.`,
            existing_path: filePath
          }, { status: 409 });
        } catch {
          // File doesn't exist, good to create
        }

        const frontMatter = generateFrontMatter(title, category, author, '1.0.0', false);
        const fullContent = frontMatter + content;
        await fs.writeFile(filePath, fullContent, 'utf-8');

        result = {
          path: `${DOCS_FOLDER}/${categoryFolder}/${fileName}`,
          action: 'created',
          words: content.split(/\s+/).length,
          version: '1.0.0',
        };
        break;
      }

      case 'update': {
        let existingContent: string;
        try {
          existingContent = await fs.readFile(filePath, 'utf-8');
        } catch {
          return NextResponse.json({
            error: `Document "${title}" not found. Use 'create' action first.`
          }, { status: 404 });
        }

        const { metadata, body: existingBody } = parseFrontMatter(existingContent);
        const newVersion = incrementVersion(metadata.version || '1.0.0');

        let newBody: string;
        if (section) {
          // Update specific section (find by heading)
          const sectionRegex = new RegExp(`(## ${section}[\\s\\S]*?)(?=\\n## |$)`, 'i');
          if (sectionRegex.test(existingBody)) {
            newBody = existingBody.replace(sectionRegex, `## ${section}\n\n${content}\n\n`);
          } else {
            // Section not found, append as new section
            newBody = existingBody + `\n\n## ${section}\n\n${content}`;
          }
        } else {
          // Replace entire body
          newBody = content;
        }

        const newFrontMatter = generateFrontMatter(
          title,
          category,
          author,
          newVersion,
          true
        ).replace('created_at: ""', `created_at: "${metadata.created_at || new Date().toISOString()}"`);

        await fs.writeFile(filePath, newFrontMatter + newBody, 'utf-8');

        result = {
          path: `${DOCS_FOLDER}/${categoryFolder}/${fileName}`,
          action: section ? `updated section "${section}"` : 'updated',
          words: newBody.split(/\s+/).length,
          version: newVersion,
        };
        break;
      }

      case 'append': {
        let existingContent: string;
        try {
          existingContent = await fs.readFile(filePath, 'utf-8');
        } catch {
          return NextResponse.json({
            error: `Document "${title}" not found. Use 'create' action first.`
          }, { status: 404 });
        }

        const { metadata, body: existingBody } = parseFrontMatter(existingContent);
        const newVersion = incrementVersion(metadata.version || '1.0.0');
        const newBody = existingBody + '\n\n' + content;

        const newFrontMatter = generateFrontMatter(
          title,
          category,
          author,
          newVersion,
          true
        ).replace('created_at: ""', `created_at: "${metadata.created_at || new Date().toISOString()}"`);

        await fs.writeFile(filePath, newFrontMatter + newBody, 'utf-8');

        result = {
          path: `${DOCS_FOLDER}/${categoryFolder}/${fileName}`,
          action: 'appended',
          words: content.split(/\s+/).length,
          version: newVersion,
        };
        break;
      }

      default:
        return NextResponse.json({ error: 'Invalid action. Use: create, update, or append' }, { status: 400 });
    }

    // Return success with details for Chad to report back
    return NextResponse.json({
      success: true,
      message: `Document ${result.action} successfully`,
      ...result,
    });

  } catch (error: any) {
    console.error('Scribe error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
