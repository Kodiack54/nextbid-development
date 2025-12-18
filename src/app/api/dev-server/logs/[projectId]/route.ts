import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * GET /api/dev-server/logs/[projectId]
 * Get PM2 logs for a project's dev server
 * Query params: lines (default 100)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const lines = parseInt(searchParams.get('lines') || '100', 10);

    // Get project
    const { data: projectData, error } = await db
      .from('dev_projects')
      .select('pm2_process_name, name, slug')
      .eq('id', projectId)
      .single();
    const project = projectData as Record<string, unknown> | null;

    if (error || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (!project.pm2_process_name) {
      return NextResponse.json({
        success: true,
        logs: `No server running for ${String(project.name)}\n\nClick "Start Dev Server" to begin.`,
        process_name: null
      });
    }

    const pm2Name = String(project.pm2_process_name);
    try {
      // Get logs from PM2 (--nostream prevents tailing)
      const { stdout, stderr } = await execAsync(
        `pm2 logs "${pm2Name}" --lines ${lines} --nostream 2>&1`,
        { maxBuffer: 1024 * 1024 * 5 } // 5MB buffer
      );

      const logs = stdout || stderr || 'No logs available';

      return NextResponse.json({
        success: true,
        logs,
        process_name: pm2Name
      });

    } catch (cmdError: unknown) {
      const errMsg = cmdError instanceof Error ? cmdError.message : 'Unknown error';
      // PM2 logs command failed - might be process doesn't exist
      return NextResponse.json({
        success: true,
        logs: `Unable to fetch logs: ${errMsg}\n\nThe server may have stopped.`,
        process_name: pm2Name
      });
    }

  } catch (error) {
    console.error('Error getting logs:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
