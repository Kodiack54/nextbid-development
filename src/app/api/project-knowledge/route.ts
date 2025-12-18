import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * GET /api/project-knowledge
 * Fetch knowledge items for a project (decisions, todos, blockers, tech_notes, etc.)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('project_id');
    let projectPath = searchParams.get('project_path');
    const type = searchParams.get('type');
    const limit = parseInt(searchParams.get('limit') || '50');

    // If project_id provided, look up the project_path
    if (projectId && !projectPath) {
      const { data: projectData } = await db
        .from('dev_projects')
        .select('server_path')
        .eq('id', projectId)
        .single();
      const project = projectData as Record<string, unknown> | null;

      if (project?.server_path) {
        projectPath = String(project.server_path);
      }
    }

    if (!projectPath) {
      return NextResponse.json({ error: 'project_id or project_path is required' }, { status: 400 });
    }

    let query = db
      .from('dev_ai_knowledge')
      .select('*')
      .eq('project_path', projectPath)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (type) {
      query = query.eq('category', type);
    }

    const { data: knowledge, error } = await query;

    if (error) {
      console.error('Error fetching project knowledge:', error);
      return NextResponse.json({ error: 'Failed to fetch knowledge' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      knowledge: knowledge || [],
    });
  } catch (error) {
    console.error('Error in project-knowledge GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/project-knowledge
 * Add a knowledge item to a project
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { project_id, project_path, category, title, summary, session_id } = body;

    // Resolve project_path from project_id if needed
    let resolvedPath = project_path;
    if (project_id && !resolvedPath) {
      const { data: projectData } = await db
        .from('dev_projects')
        .select('server_path')
        .eq('id', project_id)
        .single();
      const project = projectData as Record<string, unknown> | null;

      if (project?.server_path) {
        resolvedPath = String(project.server_path);
      }
    }

    if (!resolvedPath || !category || !title) {
      return NextResponse.json({ error: 'project_path (or project_id), category, and title are required' }, { status: 400 });
    }

    const { data: item, error } = await db
      .from('dev_ai_knowledge')
      .insert({
        project_path: resolvedPath,
        category,
        title,
        summary: summary || null,
        session_id: session_id || null,
        source: 'manual',
      })
      .select()
      .single();

    if (error) {
      console.error('Error inserting knowledge:', error);
      return NextResponse.json({ error: 'Failed to save knowledge' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      item,
    });
  } catch (error) {
    console.error('Error in project-knowledge POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/project-knowledge
 * Delete a knowledge item
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const { error } = await db
      .from('dev_ai_knowledge')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting knowledge:', error);
      return NextResponse.json({ error: 'Failed to delete knowledge' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in project-knowledge DELETE:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
