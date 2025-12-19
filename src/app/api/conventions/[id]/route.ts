import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { category, title, description, examples } = body;

    const { data, error } = await db
      .from('dev_ai_conventions')
      .update({
        category,
        title,
        description,
        examples,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*');

    if (error) throw error;

    if (!data || (Array.isArray(data) && data.length === 0)) {
      return NextResponse.json({ error: 'Convention not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, convention: Array.isArray(data) ? data[0] : data });
  } catch (error: any) {
    console.error('Error updating convention:', error);
    return NextResponse.json({ error: 'Failed to update convention' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { data, error } = await db
      .from('dev_ai_conventions')
      .delete()
      .eq('id', id)
      .select('id');

    if (error) throw error;

    if (!data || (Array.isArray(data) && data.length === 0)) {
      return NextResponse.json({ error: 'Convention not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting convention:', error);
    return NextResponse.json({ error: 'Failed to delete convention' }, { status: 500 });
  }
}
