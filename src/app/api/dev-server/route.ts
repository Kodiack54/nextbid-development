import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * GET /api/dev-server
 * Get status of all dev servers
 */
export async function GET(request: NextRequest) {
  try {
    const { data: projectsData, error } = await db
      .from('dev_projects')
      .select('id, name, slug, dev_server_status, dev_server_started_at, pm2_process_name, dev_server_error')
      .eq('is_active', true);
    const projects = (projectsData || []) as Array<Record<string, unknown>>;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Optionally sync with actual PM2 status
    const syncedProjects = await Promise.all(
      projects.map(async (project) => {
        if (project.pm2_process_name) {
          try {
            const { stdout } = await execAsync(`pm2 jlist`);
            const pm2List = JSON.parse(stdout);
            const pm2Process = pm2List.find((p: any) => p.name === project.pm2_process_name);

            if (pm2Process) {
              const actualStatus = pm2Process.pm2_env?.status === 'online' ? 'running' :
                                   pm2Process.pm2_env?.status === 'stopped' ? 'stopped' : 'error';

              // Update DB if status changed
              if (actualStatus !== project.dev_server_status) {
                await db
                  .from('dev_projects')
                  .update({ dev_server_status: actualStatus })
                  .eq('id', project.id);
                project.dev_server_status = actualStatus;
              }
            } else if (project.dev_server_status === 'running') {
              // Process not found but DB says running - mark as stopped
              await db
                .from('dev_projects')
                .update({ dev_server_status: 'stopped', pm2_process_name: null })
                .eq('id', project.id);
              project.dev_server_status = 'stopped';
            }
          } catch {
            // PM2 command failed - leave status as-is
          }
        }
        return project;
      })
    );

    return NextResponse.json({ success: true, projects: syncedProjects });
  } catch (error) {
    console.error('Error getting dev server status:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/dev-server
 * Start, stop, or restart a dev server
 * Body: { action: 'start' | 'stop' | 'restart', project_id: string, user_id: string, environment?: 'dev' | 'test' }
 */
export async function POST(request: NextRequest) {
  try {
    const { action, project_id, user_id, environment = 'dev' } = await request.json();

    if (!action || !project_id) {
      return NextResponse.json({ error: 'Missing action or project_id' }, { status: 400 });
    }

    // Get project
    const { data: projectData, error: projectError } = await db
      .from('dev_projects')
      .select('*')
      .eq('id', project_id)
      .single();
    const project = projectData as Record<string, unknown> | null;

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Determine path and port based on environment
    const serverPath = environment === 'test' ? (String(project.server_path_test || project.server_path)) : String(project.server_path);
    const port = environment === 'dev' ? Number(project.port_dev) : Number(project.port_test);
    const pm2Name = `dev-${project.slug}-${port}`;

    switch (action) {
      case 'start':
        return await startServer(project, serverPath, port, pm2Name, user_id);
      case 'stop':
        return await stopServer(project, pm2Name);
      case 'restart':
        return await restartServer(project, pm2Name);
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error in dev-server POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function startServer(project: any, serverPath: string, port: number, pm2Name: string, userId: string) {
  // Check if already running
  if (project.dev_server_status === 'running') {
    return NextResponse.json({ error: 'Server already running' }, { status: 400 });
  }

  // Check if port is in use
  try {
    const { stdout: portCheck } = await execAsync(`lsof -i :${port} -t`);
    if (portCheck.trim()) {
      return NextResponse.json({
        error: `Port ${port} is already in use by process ${portCheck.trim()}`
      }, { status: 400 });
    }
  } catch {
    // lsof returns error if port is free - that's good
  }

  // Update status to starting
  await db
    .from('dev_projects')
    .update({
      dev_server_status: 'starting',
      dev_server_error: null
    })
    .eq('id', project.id);

  try {
    // Check if package.json exists
    try {
      await execAsync(`test -f ${serverPath}/package.json`);
    } catch {
      throw new Error(`package.json not found at ${serverPath}`);
    }

    // Start with PM2
    // Using npm run dev with port argument (works for Next.js, Vite, etc.)
    const startCmd = `cd ${serverPath} && pm2 start npm --name "${pm2Name}" -- run dev -- --port ${port}`;

    console.log(`[DevServer] Starting: ${startCmd}`);
    await execAsync(startCmd);

    // Wait a moment for server to start
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Check if it actually started
    const { stdout } = await execAsync(`pm2 jlist`);
    const pm2List = JSON.parse(stdout);
    const pm2Process = pm2List.find((p: any) => p.name === pm2Name);

    if (!pm2Process || pm2Process.pm2_env?.status !== 'online') {
      throw new Error('Server failed to start - check logs');
    }

    // Update database
    await db
      .from('dev_projects')
      .update({
        dev_server_status: 'running',
        dev_server_started_at: new Date().toISOString(),
        dev_server_started_by: userId,
        pm2_process_name: pm2Name,
        dev_server_error: null
      })
      .eq('id', project.id);

    console.log(`[DevServer] Started ${pm2Name} on port ${port}`);

    return NextResponse.json({
      success: true,
      message: `Server started on port ${port}`,
      pm2_name: pm2Name,
      port
    });

  } catch (error: any) {
    console.error(`[DevServer] Start failed:`, error);

    // Update with error
    await db
      .from('dev_projects')
      .update({
        dev_server_status: 'error',
        dev_server_error: error.message
      })
      .eq('id', project.id);

    // Try to clean up failed process
    try {
      await execAsync(`pm2 delete "${pm2Name}"`);
    } catch {
      // Ignore cleanup errors
    }

    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function stopServer(project: any, pm2Name: string) {
  if (!project.pm2_process_name) {
    return NextResponse.json({ error: 'No server running' }, { status: 400 });
  }

  try {
    await execAsync(`pm2 stop "${project.pm2_process_name}"`);
    await execAsync(`pm2 delete "${project.pm2_process_name}"`);

    await db
      .from('dev_projects')
      .update({
        dev_server_status: 'stopped',
        pm2_process_name: null,
        dev_server_started_at: null,
        dev_server_started_by: null
      })
      .eq('id', project.id);

    console.log(`[DevServer] Stopped ${project.pm2_process_name}`);

    return NextResponse.json({ success: true, message: 'Server stopped' });

  } catch (error: any) {
    console.error(`[DevServer] Stop failed:`, error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function restartServer(project: any, pm2Name: string) {
  if (!project.pm2_process_name) {
    return NextResponse.json({ error: 'No server running to restart' }, { status: 400 });
  }

  try {
    await execAsync(`pm2 restart "${project.pm2_process_name}"`);

    console.log(`[DevServer] Restarted ${project.pm2_process_name}`);

    return NextResponse.json({ success: true, message: 'Server restarted' });

  } catch (error: any) {
    console.error(`[DevServer] Restart failed:`, error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
