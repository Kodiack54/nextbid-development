import { NextRequest, NextResponse } from 'next/server';

/**
 * Health Check API - Proxy to check AI worker health endpoints
 * GET /api/health-check?port=5403
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const port = searchParams.get('port');

  if (!port) {
    return NextResponse.json({ error: 'Port required' }, { status: 400 });
  }

  // Validate port is one of our AI workers
  const validPorts = ['5403', '5405', '5406', '5407', '5408'];
  if (!validPorts.includes(port)) {
    return NextResponse.json({ error: 'Invalid port' }, { status: 400 });
  }

  try {
    // In development, workers are on localhost
    // In production (server), they're on the same host
    const baseUrl = process.env.NODE_ENV === 'production'
      ? `http://localhost:${port}`
      : `http://localhost:${port}`;

    const response = await fetch(`${baseUrl}/health`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      // 5 second timeout
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return NextResponse.json({
        status: 'degraded',
        httpStatus: response.status,
      });
    }

    const data = await response.json();
    return NextResponse.json({
      status: 'online',
      ...data,
    });
  } catch (error) {
    // Worker not responding
    return NextResponse.json({
      status: 'offline',
      error: error instanceof Error ? error.message : 'Connection failed',
    });
  }
}
