import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * GET /api/project-paths
 * Get all paths for a project
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('project_id');

    if (!projectId) {
      return NextResponse.json({ error: 'project_id is required' }, { status: 400 });
    }

    const { data: paths, error } = await db
      .from('dev_project_paths')
      .select('*')
      .eq('project_id', projectId)
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Error fetching project paths:', error);
      return NextResponse.json({ error: 'Failed to fetch paths' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      paths: paths || [],
    });
  } catch (error) {
    console.error('Error in project-paths GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/project-paths
 * Add a new path to a project
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { project_id, path, label, description } = body;

    if (!project_id || !path || !label) {
      return NextResponse.json({ error: 'project_id, path, and label are required' }, { status: 400 });
    }

    const { data: newPath, error } = await db
      .from('dev_project_paths')
      .insert({
        project_id,
        path,
        label,
      })
      .select()
      .single();

    if (error) {
      console.error('Error inserting project path:', error);
      return NextResponse.json({ error: 'Failed to add path' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      path: newPath,
    });
  } catch (error) {
    console.error('Error in project-paths POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/project-paths
 * Remove a path from a project
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const { error } = await db
      .from('dev_project_paths')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting project path:', error);
      return NextResponse.json({ error: 'Failed to delete path' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in project-paths DELETE:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/project-paths
 * Update a path
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, label, sort_order } = body;

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const updateData: Record<string, any> = {};
    if (label !== undefined) updateData.label = label;
    if (sort_order !== undefined) updateData.sort_order = sort_order;

    const { data: updated, error } = await db
      .from('dev_project_paths')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating project path:', error);
      return NextResponse.json({ error: 'Failed to update path' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      path: updated,
    });
  } catch (error) {
    console.error('Error in project-paths PATCH:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
