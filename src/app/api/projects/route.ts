import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * GET /api/projects
 * List all projects with their current lock status
 */
export async function GET(request: NextRequest) {
  try {
    // Get all active projects
    const { data: projects, error: projectsError } = await db
      .from('dev_projects')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (projectsError) {
      console.error('Error fetching projects:', projectsError);
      return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 });
    }

    // Get active locks
    const { data: locks, error: locksError } = await db
      .from('dev_active_locks')
      .select('*');

    if (locksError) {
      console.error('Error fetching locks:', locksError);
    }

    // Create a map of project_id -> lock info
    const lockMap = new Map();
    if (locks) {
      locks.forEach(lock => {
        lockMap.set(lock.project_id, lock);
      });
    }

    // Merge lock info into projects
    const projectsWithLocks = projects?.map(project => ({
      ...project,
      lock: lockMap.get(project.id) || null,
      is_locked: lockMap.has(project.id),
    }));

    return NextResponse.json({
      success: true,
      projects: projectsWithLocks || [],
    });
  } catch (error) {
    console.error('Error in projects GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/projects
 * Create a new project
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      name,
      slug,
      description,
      git_repo,
      droplet_name,
      droplet_ip,
      server_path,
      port_dev,
      port_test,
      port_prod,
      created_by,
    } = body;

    if (!name || !slug) {
      return NextResponse.json(
        { error: 'Name and slug are required' },
        { status: 400 }
      );
    }

    const { data: existing } = await db
      .from('dev_projects')
      .select('id')
      .eq('slug', slug)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'A project with this slug already exists' },
        { status: 409 }
      );
    }

    const { data: maxSort } = await db
      .from('dev_projects')
      .select('sort_order')
      .order('sort_order', { ascending: false })
      .limit(1)
      .single();

    const sort_order = (maxSort?.sort_order || 0) + 1;

    const { data: project, error } = await db
      .from('dev_projects')
      .insert({
        name,
        slug,
        description,
        git_repo,
        droplet_name,
        droplet_ip,
        server_path,
        port_dev,
        port_test,
        port_prod,
        created_by,
        sort_order,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating project:', error);
      return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      project,
    });
  } catch (error) {
    console.error('Error in projects POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/projects
 * Update an existing project
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    delete updates.created_at;
    delete updates.lock;
    delete updates.is_locked;

    const { data: project, error } = await db
      .from('dev_projects')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating project:', error);
      return NextResponse.json({ error: 'Failed to update project' }, { status: 500 });
    }

    return NextResponse.json({ success: true, project });
  } catch (error) {
    console.error('Error in projects PATCH:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/projects
 * Soft delete a project
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    const { error } = await db
      .from('dev_projects')
      .update({ is_active: false })
      .eq('id', id);

    if (error) {
      console.error('Error deleting project:', error);
      return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in projects DELETE:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
