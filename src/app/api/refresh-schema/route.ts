import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

/**
 * POST /api/refresh-schema
 * Refresh database schema for all projects
 */
export async function POST() {
  try {
    console.log('🔄 Refreshing database schema...');

    // First, try using RPC function
    let columns: any[] | null = null;
    let rpcError: any = null;

    try {
      const result = await supabase.rpc('get_columns_for_prefix', {
        prefix: 'dev'
      });
      columns = result.data;
      rpcError = result.error;
    } catch (e) {
      rpcError = e;
    }

    // If RPC failed, try direct query as fallback
    if (rpcError || !columns || columns.length === 0) {
      console.log('RPC failed or empty, trying direct query...');
      console.log('RPC error:', rpcError?.message || 'No data returned');

      // Direct query to information_schema
      const { data: directColumns, error: directError } = await supabase
        .from('information_schema.columns')
        .select('table_name, column_name, data_type, is_nullable')
        .eq('table_schema', 'public')
        .like('table_name', 'dev_%');

      if (!directError && directColumns && directColumns.length > 0) {
        columns = directColumns;
        console.log(`Direct query found ${columns.length} columns`);
      }
    }

    // If still no data, return with debug info
    if (!columns || columns.length === 0) {
      // Check if dev_projects table exists at minimum
      const { data: projectsCheck, error: checkError } = await supabase
        .from('dev_projects')
        .select('id, name, table_prefix, is_active')
        .limit(5);

      return NextResponse.json({
        success: false,
        error: 'No dev_ tables found',
        message: 'Could not find any tables with dev_ prefix',
        debug: {
          rpc_error: rpcError?.message || null,
          projects_found: projectsCheck?.length || 0,
          projects: projectsCheck || [],
          hint: 'Make sure the get_columns_for_prefix SQL function was created in Supabase'
        }
      }, { status: 200 }); // Return 200 so we can see debug info
    }

    // Build schema object from columns
    const schema: Record<string, { columns: string[]; types: Record<string, string> }> = {};

    for (const col of columns) {
      const tableName = col.table_name;
      if (!schema[tableName]) {
        schema[tableName] = { columns: [], types: {} };
      }
      schema[tableName].columns.push(col.column_name);
      schema[tableName].types[col.column_name] = col.data_type;
    }

    const tableCount = Object.keys(schema).length;
    console.log(`Found ${tableCount} tables:`, Object.keys(schema));

    // Get all active projects
    const { data: allProjects, error: projError } = await supabase
      .from('dev_projects')
      .select('id, name, table_prefix, is_active')
      .eq('is_active', true);

    if (projError) {
      console.error('Error fetching projects:', projError);
    }

    let updatedProjects: string[] = [];

    // Update the first project that has table_prefix = 'dev'
    const projectWithDevPrefix = allProjects?.find(p => p.table_prefix === 'dev');

    if (projectWithDevPrefix) {
      const { error: updateError } = await supabase
        .from('dev_projects')
        .update({ database_schema: schema })
        .eq('id', projectWithDevPrefix.id);

      if (!updateError) {
        updatedProjects.push(projectWithDevPrefix.name || projectWithDevPrefix.id);
        console.log(`Updated project ${projectWithDevPrefix.id} with schema`);
      }
    } else if (allProjects && allProjects.length > 0) {
      // No project with dev prefix, update the first active project
      const firstProject = allProjects[0];
      const { error: updateError } = await supabase
        .from('dev_projects')
        .update({
          database_schema: schema,
          table_prefix: 'dev'
        })
        .eq('id', firstProject.id);

      if (!updateError) {
        updatedProjects.push(firstProject.name || firstProject.id);
        console.log(`Updated project ${firstProject.id} with schema and set prefix to 'dev'`);
      }
    } else {
      console.log('No active projects found to update');
    }

    return NextResponse.json({
      success: true,
      message: 'Schema refreshed',
      dev_tables_found: tableCount,
      tables: Object.keys(schema),
      updated_projects: updatedProjects,
      debug: {
        total_columns: columns.length,
        active_projects: allProjects?.length || 0
      }
    });

  } catch (error) {
    console.error('Schema refresh error:', error);
    return NextResponse.json({
      error: 'Failed to refresh schema',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * Refresh schema by scanning tables with known prefixes
 */
async function refreshByPrefix() {
  // Get all projects
  const { data: projects } = await supabase
    .from('dev_projects')
    .select('id, name, table_prefix');

  if (!projects?.length) {
    return NextResponse.json({
      success: true,
      message: 'No projects to refresh',
      projects_updated: 0
    });
  }

  let updated = 0;

  for (const project of projects) {
    if (!project.table_prefix) continue;

    // Get tables for this prefix
    const { data: columns } = await supabase
      .rpc('get_columns_for_prefix', { prefix: project.table_prefix });

    if (columns) {
      // Build schema object
      const schema: Record<string, { columns: string[]; types: Record<string, string> }> = {};

      for (const col of columns) {
        if (!schema[col.table_name]) {
          schema[col.table_name] = { columns: [], types: {} };
        }
        schema[col.table_name].columns.push(col.column_name);
        schema[col.table_name].types[col.column_name] = col.data_type;
      }

      // Update project
      await supabase
        .from('dev_projects')
        .update({ database_schema: schema })
        .eq('id', project.id);

      updated++;
    }
  }

  // Also get all dev_ tables for the main schema view
  const { data: devTables } = await supabase
    .rpc('get_columns_for_prefix', { prefix: 'dev' });

  const allDevSchema: Record<string, { columns: string[]; types: Record<string, string> }> = {};

  if (devTables) {
    for (const col of devTables) {
      if (!allDevSchema[col.table_name]) {
        allDevSchema[col.table_name] = { columns: [], types: {} };
      }
      allDevSchema[col.table_name].columns.push(col.column_name);
      allDevSchema[col.table_name].types[col.column_name] = col.data_type;
    }
  }

  return NextResponse.json({
    success: true,
    message: `Schema refreshed for ${updated} projects`,
    projects_updated: updated,
    dev_tables_found: Object.keys(allDevSchema).length,
    tables: Object.keys(allDevSchema)
  });
}

/**
 * GET /api/refresh-schema
 * Get current schema info
 */
export async function GET() {
  const { data: projects } = await supabase
    .from('dev_projects')
    .select('id, name, table_prefix, database_schema');

  const summary = projects?.map(p => ({
    name: p.name,
    prefix: p.table_prefix,
    table_count: p.database_schema ? Object.keys(p.database_schema).length : 0
  }));

  return NextResponse.json({
    success: true,
    projects: summary
  });
}
