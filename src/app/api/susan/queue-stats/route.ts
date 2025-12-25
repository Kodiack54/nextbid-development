import { NextResponse } from 'next/server';

const SUSAN_URL = process.env.SUSAN_URL || 'http://localhost:5403';

export async function GET() {
  try {
    const res = await fetch(`${SUSAN_URL}/api/queue-stats`, { cache: 'no-store' });
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch queue stats' }, { status: 500 });
  }
}
