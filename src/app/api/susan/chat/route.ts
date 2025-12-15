import { NextRequest, NextResponse } from 'next/server';

/**
 * Proxy to Susan's chat endpoint
 * Frontend calls /api/susan/chat -> server proxies to localhost:5403/api/chat
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const response = await fetch('http://localhost:5403/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Susan proxy error:', error.message);
    return NextResponse.json(
      { success: false, error: 'Failed to connect to Susan', reply: 'Sorry, I\'m having connection issues. Try again?' },
      { status: 500 }
    );
  }
}
