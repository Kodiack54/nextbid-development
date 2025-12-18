import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

interface ProjectSummary {
  project_id: string;
  project_path: string;
  sessions: {
    pending: number;
    processed: number;
    total: number;
  };
  todos: {
    pending: number;
    completed: number;
    total: number;
  };
  knowledge: number;
  bugs: number;
  code_changes: number;
  last_activity: string | null;
}

/**
 * GET /api/projects/summary
 * Get at-a-glance stats for all projects or a specific project
 *
 * Query params:
 *   project_path - Filter by specific project path
 *   project_id - Filter by project ID (looks up server_path from dev_projects)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    let projectPath = searchParams.get('project_path');
    const projectId = searchParams.get('project_id');

    // If project_id provided, look up the server_path
    if (projectId && !projectPath) {
      const { data: project } = await db
        .from('dev_projects')
        .select('server_path')
        .eq('id', projectId)
        .single();

      if (project?.server_path) {
        projectPath = project.server_path;
      }
    }

    // Get all projects with their paths for mapping
    const { data: projects } = await db
      .from('dev_projects')
      .select('id, name, slug, server_path')
      .eq('is_active', true);

    const projectPaths = projects?.map(p => p.server_path).filter(Boolean) || [];

    // If specific project requested
    if (projectPath) {
      const summary = await getProjectSummary(projectPath);
      return NextResponse.json({
        success: true,
        summary
      });
    }

    // Get summaries for all projects
    const summaries: Record<string, ProjectSummary> = {};

    for (const project of projects || []) {
      if (project.server_path) {
        summaries[project.id] = await getProjectSummary(project.server_path);
      }
    }

    return NextResponse.json({
      success: true,
      summaries
    });
  } catch (error) {
    console.error('Error in projects summary GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function getProjectSummary(projectPath: string): Promise<ProjectSummary> {
  // Get session counts
  const [
    { count: pendingSessions },
    { count: processedSessions },
    { count: pendingTodos },
    { count: completedTodos },
    { count: knowledgeCount },
    { count: bugsCount },
    { count: codeChangesCount },
    { data: lastSession }
  ] = await Promise.all([
    // Pending sessions
    db
      .from('dev_ai_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending_review')
      .or(`project_path.eq.${projectPath},project_path.ilike.%${projectPath.split('/').pop()}%`),

    // Processed sessions
    db
      .from('dev_ai_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'processed')
      .or(`project_path.eq.${projectPath},project_path.ilike.%${projectPath.split('/').pop()}%`),

    // Pending todos
    db
      .from('dev_ai_todos')
      .select('*', { count: 'exact', head: true })
      .eq('project_path', projectPath)
      .eq('status', 'pending'),

    // Completed todos
    db
      .from('dev_ai_todos')
      .select('*', { count: 'exact', head: true })
      .eq('project_path', projectPath)
      .eq('status', 'completed'),

    // Knowledge items
    db
      .from('dev_ai_knowledge')
      .select('*', { count: 'exact', head: true })
      .eq('project_path', projectPath),

    // Bugs
    db
      .from('dev_ai_bugs')
      .select('*', { count: 'exact', head: true })
      .eq('project_path', projectPath),

    // Code changes
    db
      .from('dev_ai_code_changes')
      .select('*', { count: 'exact', head: true })
      .eq('project_path', projectPath),

    // Last activity
    db
      .from('dev_ai_sessions')
      .select('started_at')
      .or(`project_path.eq.${projectPath},project_path.ilike.%${projectPath.split('/').pop()}%`)
      .order('started_at', { ascending: false })
      .limit(1)
  ]);

  return {
    project_id: '',
    project_path: projectPath,
    sessions: {
      pending: pendingSessions || 0,
      processed: processedSessions || 0,
      total: (pendingSessions || 0) + (processedSessions || 0)
    },
    todos: {
      pending: pendingTodos || 0,
      completed: completedTodos || 0,
      total: (pendingTodos || 0) + (completedTodos || 0)
    },
    knowledge: knowledgeCount || 0,
    bugs: bugsCount || 0,
    code_changes: codeChangesCount || 0,
    last_activity: lastSession?.[0]?.started_at || null
  };
}
