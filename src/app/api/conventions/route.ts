import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const projectPath = searchParams.get('project_path');

  try {
    let query = db
      .from('dev_ai_conventions')
      .select('*')
      .order('category', { ascending: true });

    if (projectPath) {
      query = query.eq('project_path', projectPath);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({
      success: true,
      conventions: data || [],
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { project_path, category, title, description, examples } = body;

    const { data, error } = await db
      .from('dev_ai_conventions')
      .insert({
        project_path,
        category,
        title,
        description,
        examples,
      })
      .select('*');

    if (error) throw error;

    return NextResponse.json({ success: true, convention: Array.isArray(data) ? data[0] : data });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
