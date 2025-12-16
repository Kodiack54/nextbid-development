import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

/**
 * GET /api/project-knowledge
 * Fetch knowledge items for a project (decisions, todos, blockers, tech_notes, etc.)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('project_id');
    const type = searchParams.get('type');
    const limit = parseInt(searchParams.get('limit') || '50');

    if (!projectId) {
      return NextResponse.json({ error: 'project_id is required' }, { status: 400 });
    }

    let query = supabase
      .from('dev_ai_knowledge')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (type) {
      query = query.eq('knowledge_type', type);
    }

    const { data: knowledge, error } = await query;

    if (error) {
      console.error('Error fetching project knowledge:', error);
      return NextResponse.json({ error: 'Failed to fetch knowledge' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      knowledge: knowledge || [],
    });
  } catch (error) {
    console.error('Error in project-knowledge GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/project-knowledge
 * Add a knowledge item to a project
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { project_id, knowledge_type, content, session_id, metadata } = body;

    if (!project_id || !knowledge_type || !content) {
      return NextResponse.json({ error: 'project_id, knowledge_type, and content are required' }, { status: 400 });
    }

    const { data: item, error } = await supabase
      .from('dev_ai_knowledge')
      .insert({
        project_id,
        knowledge_type,
        content,
        session_id,
        metadata: metadata || {},
      })
      .select()
      .single();

    if (error) {
      console.error('Error inserting knowledge:', error);
      return NextResponse.json({ error: 'Failed to save knowledge' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      item,
    });
  } catch (error) {
    console.error('Error in project-knowledge POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/project-knowledge
 * Delete a knowledge item
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('dev_ai_knowledge')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting knowledge:', error);
      return NextResponse.json({ error: 'Failed to delete knowledge' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in project-knowledge DELETE:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
