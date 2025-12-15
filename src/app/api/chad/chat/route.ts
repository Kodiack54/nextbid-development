import { NextRequest, NextResponse } from 'next/server';

/**
 * Proxy to Chad's chat endpoint
 * Frontend calls /api/chad/chat -> server proxies to localhost:5401/api/chat
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const response = await fetch('http://localhost:5401/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Chad proxy error:', error.message);
    return NextResponse.json(
      { success: false, error: 'Failed to connect to Chad', reply: 'Sorry, I\'m having connection issues. Try again?' },
      { status: 500 }
    );
  }
}
