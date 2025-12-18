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

    // Get all projects with their paths for mapping
    const { data: projectsData } = await db
      .from('dev_projects')
      .select('id, name, slug, server_path')
      .eq('is_active', true);
    const projects = (projectsData || []) as Array<Record<string, unknown>>;

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

    for (const project of projects) {
      if (project.server_path) {
        summaries[String(project.id)] = await getProjectSummary(String(project.server_path));
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

// Helper to count rows
async function countRows(table: string, filters: Array<{ column: string; value: unknown }>): Promise<number> {
  try {
    let whereClause = '';
    const conditions: string[] = [];
    const values: unknown[] = [];

    filters.forEach((filter, i) => {
      conditions.push(`${filter.column} = $${i + 1}`);
      values.push(filter.value);
    });

    if (conditions.length > 0) {
      whereClause = ` WHERE ${conditions.join(' AND ')}`;
    }

    const result = await db.query<{ count: string }>(`SELECT COUNT(*) as count FROM ${table}${whereClause}`, values);
    const rows = result.data as Array<{ count: string }> | null;
    return rows && rows[0] ? parseInt(rows[0].count, 10) : 0;
  } catch {
    return 0;
  }
}

async function getProjectSummary(projectPath: string): Promise<ProjectSummary> {
  // Get counts using raw queries
  const [
    pendingSessions,
    processedSessions,
    pendingTodos,
    completedTodos,
    knowledgeCount,
    bugsCount,
    codeChangesCount,
  ] = await Promise.all([
    // Pending sessions
    countRows('dev_ai_sessions', [
      { column: 'status', value: 'pending_review' },
      { column: 'project_path', value: projectPath },
    ]),

    // Processed sessions
    countRows('dev_ai_sessions', [
      { column: 'status', value: 'processed' },
      { column: 'project_path', value: projectPath },
    ]),

    // Pending todos
    countRows('dev_ai_todos', [
      { column: 'project_path', value: projectPath },
      { column: 'status', value: 'pending' },
    ]),

    // Completed todos
    countRows('dev_ai_todos', [
      { column: 'project_path', value: projectPath },
      { column: 'status', value: 'completed' },
    ]),

    // Knowledge items
    countRows('dev_ai_knowledge', [
      { column: 'project_path', value: projectPath },
    ]),

    // Bugs
    countRows('dev_ai_bugs', [
      { column: 'project_path', value: projectPath },
    ]),

    // Code changes
    countRows('dev_ai_code_changes', [
      { column: 'project_path', value: projectPath },
    ]),
  ]);

  // Get last activity
  const { data: lastSessionData } = await db
    .from('dev_ai_sessions')
    .select('started_at')
    .eq('project_path', projectPath)
    .order('started_at', { ascending: false })
    .limit(1);
  const lastSession = (lastSessionData || []) as Array<Record<string, unknown>>;

  return {
    project_id: '',
    project_path: projectPath,
    sessions: {
      pending: pendingSessions,
      processed: processedSessions,
      total: pendingSessions + processedSessions
    },
    todos: {
      pending: pendingTodos,
      completed: completedTodos,
      total: pendingTodos + completedTodos
    },
    knowledge: knowledgeCount,
    bugs: bugsCount,
    code_changes: codeChangesCount,
    last_activity: lastSession[0]?.started_at ? String(lastSession[0].started_at) : null
  };
}
