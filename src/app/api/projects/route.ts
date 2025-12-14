import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

/**
 * GET /api/projects
 * List all projects with their current lock status
 */
export async function GET(request: NextRequest) {
  try {
    // Get all active projects
    const { data: projects, error: projectsError } = await supabase
      .from('dev_projects')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (projectsError) {
      console.error('Error fetching projects:', projectsError);
      return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 });
    }

    // Get active locks
    const { data: locks, error: locksError } = await supabase
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

    const { data: existing } = await supabase
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

    const { data: maxSort } = await supabase
      .from('dev_projects')
      .select('sort_order')
      .order('sort_order', { ascending: false })
      .limit(1)
      .single();

    const sort_order = (maxSort?.sort_order || 0) + 1;

    const { data: project, error } = await supabase
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
