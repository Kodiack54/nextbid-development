import { NextRequest, NextResponse } from 'next/server';

/**
 * Catchall proxy for Clair API
 * Routes all /api/clair/* requests to Clair at localhost:5406/api/*
 */

const CLAIR_URL = 'http://localhost:5406';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  // First segment is API endpoint, rest is project path that needs encoding
  const [endpoint, ...projectParts] = path;
  const projectPath = projectParts.length > 0
    ? '/' + encodeURIComponent('/' + projectParts.join('/'))
    : '';
  const apiPath = endpoint + projectPath;
  const url = new URL(request.url);
  const queryString = url.search;

  try {
    const response = await fetch(`${CLAIR_URL}/api/${apiPath}${queryString}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Clair proxy error:', error.message);
    return NextResponse.json(
      { success: false, error: 'Failed to connect to Clair' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const [endpoint, ...projectParts] = path;
  const projectPath = projectParts.length > 0
    ? '/' + encodeURIComponent('/' + projectParts.join('/'))
    : '';
  const apiPath = endpoint + projectPath;

  try {
    const body = await request.json();

    const response = await fetch(`${CLAIR_URL}/api/${apiPath}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Clair proxy error:', error.message);
    return NextResponse.json(
      { success: false, error: 'Failed to connect to Clair' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const [endpoint, ...projectParts] = path;
  const projectPath = projectParts.length > 0
    ? '/' + encodeURIComponent('/' + projectParts.join('/'))
    : '';
  const apiPath = endpoint + projectPath;

  try {
    const body = await request.json();

    const response = await fetch(`${CLAIR_URL}/api/${apiPath}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Clair proxy error:', error.message);
    return NextResponse.json(
      { success: false, error: 'Failed to connect to Clair' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const [endpoint, ...projectParts] = path;
  const projectPath = projectParts.length > 0
    ? '/' + encodeURIComponent('/' + projectParts.join('/'))
    : '';
  const apiPath = endpoint + projectPath;

  try {
    const response = await fetch(`${CLAIR_URL}/api/${apiPath}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    });

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Clair proxy error:', error.message);
    return NextResponse.json(
      { success: false, error: 'Failed to connect to Clair' },
      { status: 500 }
    );
  }
}
