/**
 * Terminal WebSocket Server
 * Runs alongside Next.js to provide interactive PTY sessions
 * Specifically designed to run Claude Code CLI
 */

const WebSocket = require('ws');
const { spawn } = require('child_process');
const os = require('os');

const PORT = process.env.TERMINAL_WS_PORT || 5001;

// Track active sessions
const sessions = new Map();

const wss = new WebSocket.Server({ port: PORT }, () => {
  console.log(`[Terminal Server] WebSocket server running on port ${PORT}`);
});

wss.on('connection', (ws, req) => {
  const sessionId = Date.now().toString(36) + Math.random().toString(36).substr(2);
  console.log(`[Terminal Server] New connection: ${sessionId}`);

  // Get project path from query string
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const projectPath = url.searchParams.get('path') || '/var/www/NextBid_Dev/dev-studio-5000';
  const mode = url.searchParams.get('mode') || 'claude'; // 'claude' or 'shell'

  let ptyProcess;

  try {
    // Use node-pty if available, otherwise fallback to child_process
    let pty;
    try {
      pty = require('node-pty');
    } catch (e) {
      console.log('[Terminal Server] node-pty not available, using child_process');
      pty = null;
    }

    if (pty) {
      // Full PTY support
      const shell = mode === 'claude' ? 'claude' : (os.platform() === 'win32' ? 'powershell.exe' : 'bash');
      const args = mode === 'claude' ? [] : [];

      ptyProcess = pty.spawn(shell, args, {
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

      ptyProcess.onData((data) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'output', data }));
        }
      });

      ptyProcess.onExit(({ exitCode }) => {
        console.log(`[Terminal Server] Process exited with code ${exitCode}`);
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'exit', code: exitCode }));
        }
      });

    } else {
      // Fallback without node-pty (limited functionality)
      const shell = mode === 'claude' ? 'claude' : (os.platform() === 'win32' ? 'cmd.exe' : 'bash');

      ptyProcess = spawn(shell, [], {
        cwd: projectPath,
        env: {
          ...process.env,
          TERM: 'xterm-256color',
        },
        shell: true,
      });

      ptyProcess.stdout.on('data', (data) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'output', data: data.toString() }));
        }
      });

      ptyProcess.stderr.on('data', (data) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'output', data: data.toString() }));
        }
      });

      ptyProcess.on('exit', (code) => {
        console.log(`[Terminal Server] Process exited with code ${code}`);
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'exit', code }));
        }
      });
    }

    sessions.set(sessionId, { ws, ptyProcess, projectPath });

    // Handle incoming messages
    ws.on('message', (message) => {
      try {
        const msg = JSON.parse(message.toString());

        switch (msg.type) {
          case 'input':
            if (ptyProcess.write) {
              ptyProcess.write(msg.data);
            } else if (ptyProcess.stdin) {
              ptyProcess.stdin.write(msg.data);
            }
            break;

          case 'resize':
            if (ptyProcess.resize) {
              ptyProcess.resize(msg.cols, msg.rows);
            }
            break;

          case 'ping':
            ws.send(JSON.stringify({ type: 'pong' }));
            break;
        }
      } catch (e) {
        console.error('[Terminal Server] Error handling message:', e);
      }
    });

    ws.on('close', () => {
      console.log(`[Terminal Server] Connection closed: ${sessionId}`);
      if (ptyProcess.kill) {
        ptyProcess.kill();
      } else if (ptyProcess.stdin) {
        ptyProcess.stdin.end();
      }
      sessions.delete(sessionId);
    });

    // Send welcome message
    ws.send(JSON.stringify({
      type: 'output',
      data: `\r\n\x1b[36m[Dev Studio Terminal]\x1b[0m Connected to ${projectPath}\r\n` +
            `\x1b[36m[Mode: ${mode}]\x1b[0m ${mode === 'claude' ? 'Starting Claude Code...' : 'Shell ready'}\r\n\r\n`
    }));

  } catch (e) {
    console.error('[Terminal Server] Failed to spawn process:', e);
    ws.send(JSON.stringify({
      type: 'error',
      message: `Failed to start terminal: ${e.message}`
    }));
    ws.close();
  }
});

wss.on('error', (error) => {
  console.error('[Terminal Server] Server error:', error);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[Terminal Server] Shutting down...');
  sessions.forEach(({ ptyProcess }) => {
    if (ptyProcess.kill) ptyProcess.kill();
  });
  wss.close();
  process.exit(0);
});

console.log(`[Terminal Server] Ready. Waiting for connections on ws://localhost:${PORT}`);
