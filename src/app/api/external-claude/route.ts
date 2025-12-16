import { NextRequest, NextResponse } from 'next/server';

// Simple in-memory store for external Claude connection status
// In production, you'd use Redis or a database
let externalClaudeStatus = {
  connected: false,
  lastSeen: null as string | null,
  connectedAt: null as string | null,
};

// GET - Check current connection status
export async function GET() {
  // Consider disconnected if not seen in last 30 seconds
  if (externalClaudeStatus.lastSeen) {
    const lastSeenDate = new Date(externalClaudeStatus.lastSeen);
    const now = new Date();
    const diffSeconds = (now.getTime() - lastSeenDate.getTime()) / 1000;

    if (diffSeconds > 30) {
      externalClaudeStatus.connected = false;
    }
  }

  return NextResponse.json({
    connected: externalClaudeStatus.connected,
    lastSeen: externalClaudeStatus.lastSeen,
    connectedAt: externalClaudeStatus.connectedAt,
  });
}

// POST - Update connection status (called by MCP server)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { connected } = body;

    const now = new Date().toISOString();

    if (connected) {
      externalClaudeStatus = {
        connected: true,
        lastSeen: now,
        connectedAt: externalClaudeStatus.connectedAt || now,
      };
    } else {
      externalClaudeStatus = {
        connected: false,
        lastSeen: now,
        connectedAt: null,
      };
    }

    return NextResponse.json({
      success: true,
      status: externalClaudeStatus,
    });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}

// PUT - Heartbeat to keep connection alive
export async function PUT() {
  if (externalClaudeStatus.connected) {
    externalClaudeStatus.lastSeen = new Date().toISOString();
  }

  return NextResponse.json({
    success: true,
    connected: externalClaudeStatus.connected,
  });
}
