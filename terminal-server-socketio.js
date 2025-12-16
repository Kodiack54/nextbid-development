/**
 * Terminal Socket.IO Server - Port 5400
 * Uses Socket.IO with HTTP polling fallback
 */

const { Server } = require('socket.io');
const http = require('http');
const pty = require('node-pty');

const PORT = process.env.TERMINAL_WS_PORT || 5400;
const sessions = new Map();

// Create HTTP server
const httpServer = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Terminal Server OK');
});

// Create Socket.IO server with CORS and polling enabled
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  // Enable both WebSocket and polling
  transports: ['polling', 'websocket'],
  // Polling settings
  pingTimeout: 60000,
  pingInterval: 25000,
});

io.on('connection', (socket) => {
  const sessionId = Date.now().toString(36) + Math.random().toString(36).substr(2);
  console.log(`[Terminal Server] New connection: ${sessionId} via ${socket.conn.transport.name}`);

  // Log transport upgrades
  socket.conn.on('upgrade', (transport) => {
    console.log(`[Terminal Server] ${sessionId} upgraded to ${transport.name}`);
  });

  // Get project path from query
  const projectPath = socket.handshake.query.path || '/var/www/NextBid_Dev';

  // Spawn bash shell
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
  sessions.set(sessionId, { socket, ptyProcess, projectPath });

  // Send output to client
  ptyProcess.onData((data) => {
    console.log(`[Terminal Server] Sending output: ${data.length} bytes`);
    socket.emit('output', data);
  });

  // Handle exit
  ptyProcess.onExit(({ exitCode }) => {
    console.log(`[Terminal Server] Process exited: ${exitCode}`);
    socket.emit('exit', exitCode);
  });

  // Handle input from client
  socket.on('input', (data) => {
    console.log(`[Terminal Server] Received input: ${data.slice(0, 50)}`);
    ptyProcess.write(data);
  });

  // Handle resize
  socket.on('resize', ({ cols, rows }) => {
    if (cols && rows) {
      console.log(`[Terminal Server] Resize: ${cols}x${rows}`);
      ptyProcess.resize(cols, rows);
    }
  });

  // Clean up on disconnect
  socket.on('disconnect', (reason) => {
    console.log(`[Terminal Server] Disconnected: ${sessionId} (${reason})`);
    ptyProcess.kill();
    sessions.delete(sessionId);
  });

  // Welcome message
  console.log(`[Terminal Server] Sending welcome message...`);
  socket.emit('output', `\r\n\x1b[36m[Dev Studio Terminal]\x1b[0m Connected to ${projectPath}\r\n\x1b[33mType 'claude' to start Claude Code\x1b[0m\r\n\r\n`);
});

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`[Terminal Server] Socket.IO running on 0.0.0.0:${PORT}`);
  console.log(`[Terminal Server] Transports: polling, websocket`);
});

process.on('SIGTERM', () => {
  console.log('[Terminal Server] Shutting down...');
  sessions.forEach(({ ptyProcess }) => ptyProcess.kill());
  io.close();
  httpServer.close();
  process.exit(0);
});
