import { NextRequest, NextResponse } from 'next/server';

/**
 * Catchall proxy for Susan API
 * Routes all /api/susan/* requests to Susan at localhost:5403/api/*
 */

const SUSAN_URL = 'http://localhost:5403';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const apiPath = path.join('/');
  const url = new URL(request.url);
  const queryString = url.search;

  try {
    const response = await fetch(`${SUSAN_URL}/api/${apiPath}${queryString}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Susan proxy error:', error.message);
    return NextResponse.json(
      { success: false, error: 'Failed to connect to Susan' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const apiPath = path.join('/');

  try {
    const body = await request.json();

    const response = await fetch(`${SUSAN_URL}/api/${apiPath}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Susan proxy error:', error.message);
    return NextResponse.json(
      { success: false, error: 'Failed to connect to Susan' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const apiPath = path.join('/');

  try {
    const body = await request.json();

    const response = await fetch(`${SUSAN_URL}/api/${apiPath}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Susan proxy error:', error.message);
    return NextResponse.json(
      { success: false, error: 'Failed to connect to Susan' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const apiPath = path.join('/');

  try {
    const response = await fetch(`${SUSAN_URL}/api/${apiPath}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    });

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Susan proxy error:', error.message);
    return NextResponse.json(
      { success: false, error: 'Failed to connect to Susan' },
      { status: 500 }
    );
  }
}
