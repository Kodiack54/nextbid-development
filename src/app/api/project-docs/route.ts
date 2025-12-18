import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * GET /api/project-docs
 * Fetch generated docs for a project (README, TODO, CODEBASE, etc.)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('project_id');
    const docType = searchParams.get('doc_type');

    if (!projectId) {
      return NextResponse.json({ error: 'project_id is required' }, { status: 400 });
    }

    let query = db
      .from('dev_project_docs')
      .select('*')
      .eq('project_id', projectId)
      .order('updated_at', { ascending: false });

    if (docType) {
      query = query.eq('doc_type', docType);
    }

    const { data: docs, error } = await query;

    if (error) {
      console.error('Error fetching project docs:', error);
      return NextResponse.json({ error: 'Failed to fetch docs' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      docs: docs || [],
    });
  } catch (error) {
    console.error('Error in project-docs GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/project-docs
 * Create or update a project doc
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { project_id, doc_type, content, generated_by } = body;

    if (!project_id || !doc_type || !content) {
      return NextResponse.json({ error: 'project_id, doc_type, and content are required' }, { status: 400 });
    }

    // Check if doc exists first
    const { data: existingData } = await db
      .from('dev_project_docs')
      .select('id')
      .eq('project_id', project_id)
      .eq('doc_type', doc_type)
      .single();
    const existing = existingData as Record<string, unknown> | null;

    let doc;
    let error;

    if (existing) {
      // Update existing doc
      const result = await db
        .from('dev_project_docs')
        .update({
          content,
          updated_at: new Date().toISOString(),
          ai_generated: generated_by === 'cataloger',
        })
        .eq('id', existing.id as string)
        .select()
        .single();
      doc = result.data;
      error = result.error;
    } else {
      // Insert new doc
      const result = await db
        .from('dev_project_docs')
        .insert({
          project_id,
          doc_type,
          title: `${doc_type}.md`,
          content,
          ai_generated: generated_by === 'cataloger',
        })
        .select()
        .single();
      doc = result.data;
      error = result.error;
    }

    if (error) {
      console.error('Error upserting project doc:', error);
      return NextResponse.json({ error: 'Failed to save doc' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      doc,
    });
  } catch (error) {
    console.error('Error in project-docs POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
