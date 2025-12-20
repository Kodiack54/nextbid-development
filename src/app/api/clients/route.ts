import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const { data: clients, error } = await db
      .from('dev_clients')
      .select('id, slug, name, description, primary_color, is_active')
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) throw error;

    return NextResponse.json({ success: true, clients: clients || [] });
  } catch (error) {
    console.error('Error fetching clients:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch clients' },
      { status: 500 }
    );
  }
}
