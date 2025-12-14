import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// Known prefixes to scan for - add more as needed
const KNOWN_PREFIXES = [
  'dev',
  'nextbid',
  'lowvoltage',
  'nextbidder',
  'nextsource',
  'nexttask',
  'nexttech'
];

// Friendly names for auto-discovered prefixes
const PREFIX_NAMES: Record<string, string> = {
  'dev': 'Gateway / Dev Studio',
  'nextbid': 'NextBid Portal',
  'lowvoltage': 'LowVoltage Bidding',
  'nextbidder': 'NextBidder',
  'nextsource': 'NextSource',
  'nexttask': 'NextTask',
  'nexttech': 'NextTech'
};

/**
 * POST /api/refresh-schema
 * Refresh database schema for all prefixes (auto-detect)
 */
export async function POST() {
  try {
    console.log('Refreshing database schema for all prefixes...');

    const allSchemas: Record<string, {
      prefix: string;
      name: string;
      schema: Record<string, { columns: string[]; types: Record<string, string> }>;
      tableCount: number;
    }> = {};

    // Scan each known prefix
    for (const prefix of KNOWN_PREFIXES) {
      console.log('Scanning prefix:', prefix + '_');

      // Try RPC first
      let columns: any[] | null = null;

      try {
        const result = await supabase.rpc('get_columns_for_prefix', { prefix });
        if (result.data && result.data.length > 0) {
          columns = result.data;
        }
      } catch (e) {
        // RPC might not exist, continue
      }

      // If no columns found, skip this prefix
      if (!columns || columns.length === 0) {
        console.log('No tables found for prefix:', prefix + '_');
        continue;
      }

      // Build schema for this prefix
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
      console.log('Found', tableCount, 'tables for', prefix + '_');

      allSchemas[prefix] = {
        prefix,
        name: PREFIX_NAMES[prefix] || prefix + ' tables',
        schema,
        tableCount
      };
    }

    // Get existing projects
    const { data: existingProjects } = await supabase
      .from('dev_projects')
      .select('id, name, table_prefix, is_active');

    const updatedProjects: string[] = [];
    const createdProjects: string[] = [];

    // Update or create project for each discovered prefix
    for (const [prefix, data] of Object.entries(allSchemas)) {
      const existingProject = existingProjects?.find(p => p.table_prefix === prefix);

      if (existingProject) {
        // Update existing project
        const { error } = await supabase
          .from('dev_projects')
          .update({ database_schema: data.schema })
          .eq('id', existingProject.id);

        if (!error) {
          updatedProjects.push(existingProject.name);
        }
      } else {
        // Create new project entry for this prefix
        const { error } = await supabase
          .from('dev_projects')
          .insert({
            name: data.name,
            slug: prefix,
            table_prefix: prefix,
            database_schema: data.schema,
            is_active: true,
            droplet_name: 'Database Schema',
            droplet_ip: '-',
            server_path: '-',
            port_dev: 0,
            port_test: 0,
            port_prod: 0,
            sort_order: 100
          });

        if (!error) {
          createdProjects.push(data.name);
        } else {
          console.error('Failed to create project for ' + prefix + ':', error);
        }
      }
    }

    const totalTables = Object.values(allSchemas).reduce((sum, s) => sum + s.tableCount, 0);

    return NextResponse.json({
      success: true,
      message: 'Schema refreshed for all prefixes',
      prefixes_found: Object.keys(allSchemas).length,
      total_tables: totalTables,
      schemas: Object.entries(allSchemas).map(([prefix, data]) => ({
        prefix: prefix + '_',
        name: data.name,
        tables: data.tableCount
      })),
      updated_projects: updatedProjects,
      created_projects: createdProjects
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
