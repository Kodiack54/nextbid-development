/**
 * Terminal WebSocket Server - Port 5400
 * Claude Code Terminal for Dev Studio
 * Supports: user terminals, claude mode, monitor mode, broadcast mode
 */

const WebSocket = require('ws');
const pty = require('node-pty');

const PORT = process.env.TERMINAL_WS_PORT || 5400;
const sessions = new Map();
const monitors = new Set();

const wss = new WebSocket.Server({
  host: '0.0.0.0',
  port: PORT,
  perMessageDeflate: false,
}, () => {
  console.log(`[Terminal Server] Running on 0.0.0.0:${PORT}`);
});

// Broadcast to all monitors
function broadcastToMonitors(data, sourceSession) {
  const payload = JSON.stringify({
    type: 'monitor_output',
    session: sourceSession,
    data: data,
    ts: new Date().toISOString()
  });
  monitors.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  });
}

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const mode = url.searchParams.get('mode') || 'user';
  const projectPath = url.searchParams.get('path') || '/var/www/NextBid_Dev/dev-studio-5000';
  const sessionId = Date.now().toString(36) + Math.random().toString(36).substr(2);
  const source = url.searchParams.get('source') || 'unknown';

  console.log(`[Terminal Server] Connection: ${sessionId} mode=${mode}`);

  // Monitor mode - read-only viewer
  if (mode === 'monitor') {
    monitors.add(ws);
    ws.send(JSON.stringify({
      type: 'monitor_connected',
      activeSessions: sessions.size,
      message: 'Connected as monitor'
    }));

    ws.on('close', () => {
      monitors.delete(ws);
      console.log(`[Terminal Server] Monitor disconnected`);
    });
    return;
  }

  // Broadcast mode - for external Claude to send messages to monitors
  if (mode === 'broadcast') {
    console.log(`[Terminal Server] Broadcast client connected: ${source}`);
    
    ws.on('message', (message) => {
      try {
        const msg = JSON.parse(message.toString());
        const label = msg.label || '🤖 External Claude';
        const content = msg.content || msg.data || message.toString();
        
        // Broadcast to all monitors
        broadcastToMonitors(`\x1b[35m[${label}]\x1b[0m ${content}\n`, `broadcast-${source}`);
        
        // Send ack
        ws.send(JSON.stringify({ type: 'ack', received: true }));
      } catch (e) {
        broadcastToMonitors(`\x1b[35m[External]\x1b[0m ${message.toString()}\n`, 'broadcast');
      }
    });

    ws.on('close', () => {
      console.log(`[Terminal Server] Broadcast client disconnected: ${source}`);
    });
    return;
  }

  // User or Claude mode - spawn terminal
  const ptyProcess = pty.spawn('bash', ['--login'], {
    name: 'xterm-256color',
    cols: 120,
    rows: 30,
    cwd: projectPath,
    env: {
      ...process.env,
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor',
    },
  });

  const sessionLabel = mode === 'claude' ? '🤖 External Claude' : '👤 User';
  console.log(`[Terminal Server] Spawned ${sessionLabel} terminal in ${projectPath}`);

  ws.on('error', (err) => {
    console.error(`[Terminal Server] Error ${sessionId}:`, err.message);
  });

  // Send output to client AND monitors
  ptyProcess.onData((data) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'output', data }));
    }
    // Broadcast to monitors with session label
    broadcastToMonitors(`[${sessionLabel}] ${data}`, sessionId);
  });

  ptyProcess.onExit(({ exitCode }) => {
    console.log(`[Terminal Server] Process exited: ${exitCode}`);
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'exit', code: exitCode }));
    }
    broadcastToMonitors(`[${sessionLabel}] Session ended (exit ${exitCode})\n`, sessionId);
  });

  sessions.set(sessionId, { ws, ptyProcess, projectPath, mode });

  // Notify monitors of new session
  monitors.forEach(m => {
    if (m.readyState === WebSocket.OPEN) {
      m.send(JSON.stringify({
        type: 'session_started',
        session: sessionId,
        mode: mode,
        activeSessions: sessions.size
      }));
    }
  });

  ws.on('message', (message) => {
    try {
      const msg = JSON.parse(message.toString());
      if (msg.type === 'input') {
        ptyProcess.write(msg.data);
        // Echo input to monitors
        broadcastToMonitors(`[${sessionLabel} input] ${msg.data}`, sessionId);
      } else if (msg.type === 'resize' && msg.cols && msg.rows) {
        ptyProcess.resize(msg.cols, msg.rows);
      }
    } catch (e) {
      console.error('[Terminal Server] Message error:', e.message);
    }
  });

  ws.on('close', () => {
    console.log(`[Terminal Server] Disconnected: ${sessionId}`);
    ptyProcess.kill();
    sessions.delete(sessionId);
    // Notify monitors
    monitors.forEach(m => {
      if (m.readyState === WebSocket.OPEN) {
        m.send(JSON.stringify({
          type: 'session_ended',
          session: sessionId,
          activeSessions: sessions.size
        }));
      }
    });
  });

  // Welcome message
  const welcomeMsg = mode === 'claude'
    ? `\r\n\x1b[34m[External Claude Connected]\x1b[0m ${projectPath}\r\n`
    : `\r\n\x1b[32m[Your Terminal]\x1b[0m Connected to ${projectPath}\r\nType 'claude' to start Claude Code\r\n\r\n`;
  
  ws.send(JSON.stringify({ type: 'output', data: welcomeMsg }));
  broadcastToMonitors(welcomeMsg, sessionId);
});

wss.on('error', (error) => {
  console.error('[Terminal Server] Error:', error);
});

process.on('SIGTERM', () => {
  console.log('[Terminal Server] Shutting down...');
  sessions.forEach(({ ptyProcess }) => ptyProcess.kill());
  wss.close();
  process.exit(0);
});
