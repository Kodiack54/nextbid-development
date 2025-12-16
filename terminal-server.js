/**
 * Terminal WebSocket Server - Port 5400
 * Claude Code Terminal for Dev Studio
 */

const WebSocket = require('ws');
const pty = require('node-pty');

const PORT = process.env.TERMINAL_WS_PORT || 5400;
const sessions = new Map();

const wss = new WebSocket.Server({ host: '0.0.0.0', port: PORT }, () => {
  console.log(`[Terminal Server] Running on 0.0.0.0:${PORT}`);
});

wss.on('connection', (ws, req) => {
  const sessionId = Date.now().toString(36) + Math.random().toString(36).substr(2);
  console.log(`[Terminal Server] New connection: ${sessionId}`);

  const url = new URL(req.url, `http://localhost:${PORT}`);
  const projectPath = url.searchParams.get('path') || '/var/www/NextBid_Dev';

  // Spawn bash shell - user can run 'claude' from there
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

  console.log(`[Terminal Server] Spawned bash in ${projectPath}`);

  // Add per-connection error handler
  ws.on('error', (err) => {
    console.error(`[Terminal Server] Connection error for ${sessionId}:`, err.message);
  });

  // Send output to client
  ptyProcess.onData((data) => {
    console.log(`[Terminal Server] Sending output: ${data.length} bytes`);
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'output', data }), (err) => {
        if (err) {
          console.error(`[Terminal Server] Send failed:`, err.message);
        }
      });
    } else {
      console.log(`[Terminal Server] WebSocket not open, state: ${ws.readyState}`);
    }
  });

  // Handle exit
  ptyProcess.onExit(({ exitCode }) => {
    console.log(`[Terminal Server] Process exited: ${exitCode}`);
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'exit', code: exitCode }), (err) => {
        if (err) console.error(`[Terminal Server] Exit send failed:`, err.message);
      });
    }
  });

  sessions.set(sessionId, { ws, ptyProcess, projectPath });

  // Handle input from client
  ws.on('message', (message) => {
    try {
      const msg = JSON.parse(message.toString());
      console.log(`[Terminal Server] Received: ${msg.type}`, msg.type === 'input' ? msg.data.slice(0, 50) : '');

      if (msg.type === 'input') {
        ptyProcess.write(msg.data);
      } else if (msg.type === 'resize' && msg.cols && msg.rows) {
        ptyProcess.resize(msg.cols, msg.rows);
      }
    } catch (e) {
      console.error('[Terminal Server] Message error:', e.message);
    }
  });

  // Clean up on disconnect
  ws.on('close', () => {
    console.log(`[Terminal Server] Disconnected: ${sessionId}`);
    ptyProcess.kill();
    sessions.delete(sessionId);
  });

  // Welcome message
  console.log(`[Terminal Server] Sending welcome message...`);
  ws.send(JSON.stringify({
    type: 'output',
    data: `\r\n\x1b[36m[Dev Studio Terminal]\x1b[0m Connected to ${projectPath}\r\n\x1b[33mType 'claude' to start Claude Code\x1b[0m\r\n\r\n`
  }), (err) => {
    if (err) {
      console.error(`[Terminal Server] Welcome send failed:`, err.message);
    } else {
      console.log(`[Terminal Server] Welcome message sent successfully`);
    }
  });

  // Debug: Send ping every 5 seconds to test if data can reach browser
  const pingInterval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      const pingMsg = JSON.stringify({ type: 'ping', timestamp: Date.now() });
      console.log(`[Terminal Server] Sending ping: ${pingMsg}`);
      ws.send(pingMsg, (err) => {
        if (err) console.error(`[Terminal Server] Ping failed:`, err.message);
      });
    } else {
      clearInterval(pingInterval);
    }
  }, 5000);

  // Clear ping on disconnect
  ws.on('close', () => clearInterval(pingInterval));
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
