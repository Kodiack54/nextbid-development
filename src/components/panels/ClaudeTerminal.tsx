'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Power, PowerOff, FolderOpen, Brain } from 'lucide-react';
import type { Terminal } from '@xterm/xterm';
import type { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

export interface ChatLogMessage {
  id: string;
  source: 'claude' | 'chad';
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

// Simple message format for AI Team Chat
export interface ConversationMessage {
  id: string;
  user_id: string;
  user_name: string;
  content: string;
  created_at: string;
}

// Susan's startup context - full memory briefing
interface SusanContext {
  greeting: string | null;
  lastSession: {
    id: string;
    projectPath: string;
    startedAt: string;
    endedAt: string;
    summary: string | null;
  } | null;
  recentMessages: Array<{ role: string; content: string; created_at: string }>;
  relevantKnowledge: Array<{ category: string; title: string; summary: string }>;
  todos: Array<{ id: string; title: string; description: string; priority: string; status: string }>;
  projectInfo: { name: string; path: string; databases: string[] } | null;
  ports: Array<{ port: number; service: string; description: string }>;
  schemas: Array<{ table_name: string; prefix: string; description: string }>;
  fileStructure: { directories: Array<{ path: string; description: string }>; keyFiles: Array<{ path: string; description: string }> } | null;
}

interface ClaudeTerminalProps {
  projectPath?: string;
  wsUrl?: string;
  onMessage?: (message: ChatLogMessage) => void;
  // Expose send function for external use (AI Team Chat)
  sendRef?: React.MutableRefObject<((message: string) => void) | null>;
  // Expose connect function for external use (click to connect)
  connectRef?: React.MutableRefObject<(() => void) | null>;
  // Callback for conversation messages (cleaner format for chat display)
  onConversationMessage?: (message: ConversationMessage) => void;
  // Callback for connection state changes
  onConnectionChange?: (connected: boolean) => void;
}

// AI Team worker URLs (Development droplet)
const DEV_DROPLET = '161.35.229.220';
const CHAD_WS_URL = `ws://${DEV_DROPLET}:5401/ws`; // WebSocket path for Chad
const SUSAN_URL = `http://${DEV_DROPLET}:5403`;

// Build context prompt to send to Claude on startup
// Susan builds the full greeting on server-side, we just use it
function buildContextPrompt(context: SusanContext): string {
  // Susan already built a comprehensive greeting with:
  // - Project info, ports, todos, schemas, files, knowledge, recent conversation
  if (context.greeting) {
    return context.greeting;
  }

  // Fallback if no greeting from Susan
  return "Susan couldn't load your memory. Starting fresh - what would you like to work on?";
}

export function ClaudeTerminal({
  projectPath = '/var/www/NextBid_Dev/dev-studio-5000',
  wsUrl,
  onMessage,
  sendRef,
  connectRef,
  onConversationMessage,
  onConnectionChange,
}: ClaudeTerminalProps) {
  const wsRef = useRef<WebSocket | null>(null);
  const chadWsRef = useRef<WebSocket | null>(null);
  const terminalRef = useRef<HTMLDivElement>(null);
  const messageBufferRef = useRef<string>('');
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const contextSentRef = useRef(false);

  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [memoryStatus, setMemoryStatus] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle');
  const [susanContext, setSusanContext] = useState<SusanContext | null>(null);
  const susanContextRef = useRef<SusanContext | null>(null); // Ref for WebSocket closure access

  // Response buffering for better message parsing
  const responseBufferRef = useRef<string>('');
  const lastMessageTimeRef = useRef<number>(0);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSentMessageRef = useRef<string>('');

  // Expose send function via ref for external use (AI Team Chat)
  const sendMessage = useCallback((message: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      // Send text
      wsRef.current.send(JSON.stringify({ type: 'input', data: message }));
      // Then send Enter after a short delay
      setTimeout(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'input', data: '\r' }));
        }
      }, 50);

      // Add user message to conversation
      if (onConversationMessage) {
        onConversationMessage({
          id: `user-${Date.now()}`,
          user_id: 'me',
          user_name: 'You',
          content: message,
          created_at: new Date().toISOString(),
        });
      }
    }
  }, [onConversationMessage]);

  // Expose send function via ref
  useEffect(() => {
    if (sendRef) {
      sendRef.current = connected ? sendMessage : null;
    }
  }, [sendRef, sendMessage, connected]);


  // Notify parent of connection changes
  useEffect(() => {
    onConnectionChange?.(connected);
  }, [connected, onConnectionChange]);

  // Initialize xterm.js - dynamically import to avoid SSR issues
  useEffect(() => {
    if (!terminalRef.current || xtermRef.current) return;

    // Dynamic import for client-side only
    const initTerminal = async () => {
      const { Terminal } = await import('@xterm/xterm');
      const { FitAddon } = await import('@xterm/addon-fit');

      const term = new Terminal({
        theme: {
          background: '#1a1b26',
          foreground: '#c0caf5',
          cursor: '#c0caf5',
          cursorAccent: '#1a1b26',
          black: '#15161e',
          red: '#f7768e',
          green: '#9ece6a',
          yellow: '#e0af68',
          blue: '#7aa2f7',
          magenta: '#bb9af7',
          cyan: '#7dcfff',
          white: '#a9b1d6',
          brightBlack: '#414868',
          brightRed: '#f7768e',
          brightGreen: '#9ece6a',
          brightYellow: '#e0af68',
          brightBlue: '#7aa2f7',
          brightMagenta: '#bb9af7',
          brightCyan: '#7dcfff',
          brightWhite: '#c0caf5',
        },
        fontFamily: 'JetBrains Mono, Menlo, Monaco, Consolas, monospace',
        fontSize: 13,
        lineHeight: 1.2,
        cursorBlink: true,
        cursorStyle: 'block',
        scrollback: 5000,
        convertEol: true,
      });

      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);

      if (terminalRef.current) {
        term.open(terminalRef.current);
        fitAddon.fit();

        // Welcome message
        term.writeln('\x1b[36m═══════════════════════════════════════════\x1b[0m');
        term.writeln('\x1b[36m   👨‍💻 Claude - Lead Programmer (5400)      \x1b[0m');
        term.writeln('\x1b[36m═══════════════════════════════════════════\x1b[0m');
        term.writeln('');
        term.writeln('\x1b[33mClick "Connect" to summon your Lead Programmer\x1b[0m');
        term.writeln('\x1b[90mUses your $200/mo subscription - no API costs\x1b[0m');
        term.writeln('');

        xtermRef.current = term;
        fitAddonRef.current = fitAddon;
      }
    };

    initTerminal();

    // Handle resize - both window and container
    const handleResize = () => {
      if (fitAddonRef.current) {
        setTimeout(() => fitAddonRef.current?.fit(), 100);
      }
    };
    window.addEventListener('resize', handleResize);

    // ResizeObserver for container size changes
    const resizeObserver = new ResizeObserver(handleResize);
    if (terminalRef.current) {
      resizeObserver.observe(terminalRef.current);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
      if (xtermRef.current) {
        xtermRef.current.dispose();
        xtermRef.current = null;
      }
      fitAddonRef.current = null;
    };
  }, []);

  // Fetch context from Susan before connecting
  const fetchSusanContext = useCallback(async () => {
    setMemoryStatus('loading');
    try {
      const response = await fetch(
        `${SUSAN_URL}/api/context?project=${encodeURIComponent(projectPath)}`
      );
      if (response.ok) {
        const context = await response.json();
        setSusanContext(context);
        susanContextRef.current = context; // Store in ref for WebSocket closure
        setMemoryStatus('loaded');
        return context;
      }
    } catch (err) {
      console.log('[ClaudeTerminal] Susan not available:', err);
    }
    setMemoryStatus('error');
    return null;
  }, [projectPath]);

  // Track Chad session ID for logging
  const chadSessionIdRef = useRef<string | null>(null);

  // Connect to Chad for transcription
  const connectToChad = useCallback(() => {
    try {
      // Chad expects: /ws?project=<path>&userId=<id>
      const chadWs = new WebSocket(`${CHAD_WS_URL}?project=${encodeURIComponent(projectPath)}&userId=michael`);

      chadWs.onopen = () => {
        console.log('[ClaudeTerminal] Connected to Chad for transcription');
        // Request a session start
        chadWs.send(JSON.stringify({ type: 'session_start', payload: {} }));
      };

      chadWs.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'session_started' || msg.type === 'session_created') {
            chadSessionIdRef.current = msg.sessionId;
            console.log('[ClaudeTerminal] Chad session started:', msg.sessionId);
          }
        } catch (err) {
          console.log('[ClaudeTerminal] Chad message parse error:', err);
        }
      };

      chadWs.onerror = (err) => console.log('[ClaudeTerminal] Chad WebSocket error:', err);
      chadWs.onclose = () => {
        console.log('[ClaudeTerminal] Chad disconnected');
        chadSessionIdRef.current = null;
      };

      chadWsRef.current = chadWs;
    } catch (err) {
      console.log('[ClaudeTerminal] Could not connect to Chad:', err);
    }
  }, [projectPath]);

  // Send output to Chad for transcription
  const sendToChad = useCallback((data: string) => {
    if (chadWsRef.current?.readyState === WebSocket.OPEN) {
      // Chad expects: { type: 'terminal_output', payload: { sessionId, data } }
      chadWsRef.current.send(JSON.stringify({
        type: 'terminal_output',
        payload: {
          sessionId: chadSessionIdRef.current,
          data
        }
      }));
    }
  }, []);

  const connect = useCallback(async () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    setConnecting(true);
    contextSentRef.current = false;

    // 1. Fetch context from Susan (parallel with terminal connect)
    const contextPromise = fetchSusanContext();

    // 2. Connect to Chad for transcription
    connectToChad();

    // 3. Connect to Claude terminal
    const wsEndpoint = wsUrl || `ws://${DEV_DROPLET}:5400`;
    const fullUrl = `${wsEndpoint}?path=${encodeURIComponent(projectPath)}&mode=claude`;

    const ws = new WebSocket(fullUrl);

    ws.onopen = async () => {
      setConnected(true);
      setConnecting(false);

      if (xtermRef.current) {
        xtermRef.current.writeln('\x1b[32m[Connected]\x1b[0m');
        xtermRef.current.writeln('');
        xtermRef.current.writeln('\x1b[36m☕ Hold please... your master coder will be right with you.\x1b[0m');
        xtermRef.current.writeln('\x1b[90m   Starting Claude Code...\x1b[0m');

        // Check if Susan has context - show detailed loading status
        const context = await contextPromise;
        if (context) {
          xtermRef.current.writeln('\x1b[35m   📚 Susan is loading your memory...\x1b[0m');
          if (context.todos?.length > 0) {
            xtermRef.current.writeln(`\x1b[90m      ✓ ${context.todos.length} pending todos\x1b[0m`);
          }
          if (context.ports?.length > 0) {
            xtermRef.current.writeln(`\x1b[90m      ✓ ${context.ports.length} port assignments\x1b[0m`);
          }
          if (context.schemas?.length > 0) {
            xtermRef.current.writeln(`\x1b[90m      ✓ ${context.schemas.length} database tables\x1b[0m`);
          }
          if (context.lastSession) {
            xtermRef.current.writeln(`\x1b[90m      ✓ Previous session found\x1b[0m`);
          }
          xtermRef.current.writeln('\x1b[35m   📚 Memory loaded! Will brief Claude when ready...\x1b[0m');
        } else {
          xtermRef.current.writeln('\x1b[33m   ⚠️ Susan unavailable - starting without memory\x1b[0m');
        }
        xtermRef.current.writeln('');
      }

      // Send terminal size
      if (fitAddonRef.current && xtermRef.current) {
        ws.send(JSON.stringify({
          type: 'resize',
          cols: xtermRef.current.cols,
          rows: xtermRef.current.rows
        }));
      }

      // Auto-start Claude after 2 seconds
      setTimeout(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'input', data: 'claude\r' }));
        }
      }, 2000);

      inputRef.current?.focus();
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'output' && xtermRef.current) {
          // Write directly to xterm - it handles all escape codes natively!
          xtermRef.current.write(msg.data);

          // Forward to Chad for transcription
          sendToChad(msg.data);

          // Parse output for chat log - look for Claude responses
          // Comprehensive ANSI cleaning
          const cleanData = msg.data
            .replace(/\x1b\[[0-9;]*[A-Za-z]/g, '')  // ESC [ ... letter (cursor, colors, etc)
            .replace(/\[([0-9;]*[A-Za-z])/g, '')    // Visible codes without ESC prefix
            .replace(/\x1b\[\?[0-9;]*[a-zA-Z]/g, '') // Cursor visibility/mode sequences
            .replace(/\x1b\][^\x07]*\x07/g, '')      // OSC sequences (title bar, etc)
            .replace(/\x1b/g, '')                    // Any remaining escape chars
            .replace(/\r(?!\n)/g, '')                // Carriage returns (keep newlines)
            .replace(/[─━═\-_]{10,}/g, '')           // Long separator lines
            .replace(/\n{3,}/g, '\n\n')              // Collapse multiple blank lines
            .trim();

          // Detect when Claude is ready and send Susan's memory briefing
          // Look for Claude's ready prompts: >, ❯, "What would you like", "How can I help"
          const currentContext = susanContextRef.current; // Use ref to access latest context
          if (!contextSentRef.current && currentContext?.greeting) {
            const isClaudeReady = cleanData.includes('>') ||
                                  cleanData.includes('❯') ||
                                  cleanData.includes('What would you like') ||
                                  cleanData.includes('How can I help') ||
                                  cleanData.includes('ready to help');

            if (isClaudeReady) {
              contextSentRef.current = true;

              // Show briefing status in terminal
              if (xtermRef.current) {
                xtermRef.current.writeln('\x1b[35m\n📚 Sending memory briefing to Claude...\x1b[0m');
              }

              // Wait a moment then send the full context
              setTimeout(() => {
                if (wsRef.current?.readyState === WebSocket.OPEN) {
                  const contextMessage = buildContextPrompt(currentContext);
                  wsRef.current.send(JSON.stringify({ type: 'input', data: contextMessage }));
                  setTimeout(() => {
                    if (wsRef.current?.readyState === WebSocket.OPEN) {
                      wsRef.current.send(JSON.stringify({ type: 'input', data: '\r' }));
                    }
                  }, 100);
                }
              }, 1000); // Give Claude a second to fully render
            }
          }

          // Buffer ALL response text - filter TUI noise
          // Chad gets raw data via sendToChad() for full logging
          const lines = cleanData.split(/[\r\n]+/);
          for (const line of lines) {
            const trimmedLine = line.trim();

            // Skip TUI noise (spinners, status, prompts):
            // - Empty lines at very start
            if (trimmedLine.length === 0 && responseBufferRef.current.length === 0) continue;
            // - Shell prompts
            if (trimmedLine === '$' || trimmedLine === '%' || trimmedLine === '>') continue;
            if (trimmedLine.startsWith('❯')) continue;
            // - Spinner characters (all the fancy ones Claude Code uses)
            if (/^[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏·✢✶✻✽*•∴]+$/.test(trimmedLine)) continue;
            // - Status lines (Ideating, Thinking, shortcuts hints)
            if (/^[·✢✶✻✽*•∴]?\s*(Ideating|Thinking|Thought)/.test(trimmedLine)) continue;
            if (trimmedLine.includes('(esc to interrupt)')) continue;
            if (trimmedLine.includes('for shortcuts')) continue;
            if (trimmedLine.includes('ctrl+o to show')) continue;
            if (trimmedLine.includes('ctrl-g to edit')) continue;
            // - Claude Code UI chrome
            if (trimmedLine.startsWith('Try "')) continue;
            if (trimmedLine === '?' || trimmedLine === '? ') continue;

            // Everything else goes through - INCLUDING box drawing!
            if (trimmedLine.length === 0) {
              responseBufferRef.current += '\n';
            } else {
              responseBufferRef.current += trimmedLine + '\n';
            }
          }

          // Detect if Claude's response is complete (prompt reappeared)
          const isResponseComplete = cleanData.includes('❯') ||
                                     cleanData.includes('> ') ||
                                     cleanData.includes('? ') ||  // Question prompt
                                     cleanData.match(/\n>\s*$/);  // Prompt at end of line

          // Function to send buffered content to chat
          const sendBufferedContent = () => {
            const bufferedContent = responseBufferRef.current.trim();

            // Only send if we have meaningful content
            if (bufferedContent.length > 10) {
              // Skip if too similar to last message (check first 100 chars to catch partial dupes)
              const contentStart = bufferedContent.slice(0, 100);
              const lastStart = lastSentMessageRef.current.slice(0, 100);
              if (contentStart === lastStart) {
                responseBufferRef.current = '';
                return;
              }

              // Skip only actual command execution output (not grids Claude intentionally shows)
              const isToolOutput = bufferedContent.includes('curl ') ||
                                   bufferedContent.includes('npm install') ||
                                   bufferedContent.includes('node_modules');

              if (!isToolOutput) {
                lastSentMessageRef.current = bufferedContent;

                if (onMessage) {
                  onMessage({
                    id: `claude-${Date.now()}`,
                    source: 'claude',
                    role: 'assistant',
                    content: bufferedContent,
                    timestamp: new Date()
                  });
                }

                if (onConversationMessage) {
                  onConversationMessage({
                    id: `claude-${Date.now()}`,
                    user_id: 'claude',
                    user_name: 'Claude',
                    content: bufferedContent,
                    created_at: new Date().toISOString(),
                  });
                }
              }

              responseBufferRef.current = '';
            }
          };

          // If response is complete, send after a short delay (let buffer fill)
          if (isResponseComplete && responseBufferRef.current.length > 10) {
            if (debounceTimerRef.current) {
              clearTimeout(debounceTimerRef.current);
            }
            // Small delay to let any final content arrive
            debounceTimerRef.current = setTimeout(() => {
              sendBufferedContent();
              responseBufferRef.current = ''; // Clear after sending
            }, 500);
          } else {
            // Otherwise debounce: Wait for output to settle before sending to chat
            if (debounceTimerRef.current) {
              clearTimeout(debounceTimerRef.current);
            }

            debounceTimerRef.current = setTimeout(() => {
              sendBufferedContent();
              responseBufferRef.current = ''; // Clear after sending
            }, 8000); // Wait 8s for full response to reduce spam
          }
        } else if (msg.type === 'exit') {
          if (xtermRef.current) {
            xtermRef.current.writeln(`\x1b[33m[Process exited: ${msg.code}]\x1b[0m`);
          }
          setConnected(false);
        }
      } catch {
        if (xtermRef.current) {
          xtermRef.current.write(event.data);
        }
      }
    };

    ws.onerror = () => {
      if (xtermRef.current) {
        xtermRef.current.writeln('\x1b[31m[Connection error]\x1b[0m');
      }
      setConnecting(false);
    };

    ws.onclose = () => {
      setConnected(false);
      setConnecting(false);
      if (xtermRef.current) {
        xtermRef.current.writeln('\x1b[33m[Disconnected]\x1b[0m');
      }
    };

    wsRef.current = ws;
  }, [projectPath, wsUrl]);

  const disconnect = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
    chadWsRef.current?.close();
    chadWsRef.current = null;
    setConnected(false);
    setMemoryStatus('idle');
    setSusanContext(null);
  }, []);

  // Expose connect function via ref (for click-to-connect from AI Team Chat)
  useEffect(() => {
    if (connectRef) {
      connectRef.current = connect;
    }
  }, [connectRef, connect]);

  const sendInput = useCallback(() => {
    console.log('[ClaudeTerminal] sendInput called, connected:', connected, 'wsState:', wsRef.current?.readyState, 'input length:', inputValue.length);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      if (inputValue.trim()) {
        // For long input, chunk it to avoid overwhelming the terminal
        const CHUNK_SIZE = 1000;
        const text = inputValue;

        if (text.length > CHUNK_SIZE) {
          // Send in chunks with delays
          const chunks: string[] = [];
          for (let i = 0; i < text.length; i += CHUNK_SIZE) {
            chunks.push(text.slice(i, i + CHUNK_SIZE));
          }

          let chunkIndex = 0;
          const sendNextChunk = () => {
            if (chunkIndex < chunks.length && wsRef.current?.readyState === WebSocket.OPEN) {
              wsRef.current.send(JSON.stringify({ type: 'input', data: chunks[chunkIndex] }));
              chunkIndex++;
              if (chunkIndex < chunks.length) {
                setTimeout(sendNextChunk, 50);
              } else {
                // All chunks sent, now send Enter
                setTimeout(() => {
                  if (wsRef.current?.readyState === WebSocket.OPEN) {
                    wsRef.current.send(JSON.stringify({ type: 'input', data: '\r' }));
                  }
                }, 100);
              }
            }
          };
          sendNextChunk();
        } else {
          // Short input - send normally
          wsRef.current.send(JSON.stringify({ type: 'input', data: text }));
          setTimeout(() => {
            if (wsRef.current?.readyState === WebSocket.OPEN) {
              wsRef.current.send(JSON.stringify({ type: 'input', data: '\r' }));
            }
          }, 50);
        }

        // Log to conversation (for AI Team Chat to display)
        // Truncate very long pastes in the chat log
        if (onConversationMessage) {
          const displayContent = inputValue.length > 500
            ? inputValue.slice(0, 500) + `... (${inputValue.length} chars)`
            : inputValue.trim();
          onConversationMessage({
            id: `user-${Date.now()}`,
            user_id: 'me',
            user_name: 'You',
            content: displayContent,
            created_at: new Date().toISOString(),
          });
        }
      } else {
        // Just send Enter for empty input (confirmations, etc.)
        wsRef.current.send(JSON.stringify({ type: 'input', data: '\r' }));
      }
      setInputValue('');
    } else {
      console.log('[ClaudeTerminal] WebSocket not open');
    }
  }, [inputValue, connected, onConversationMessage]);

  return (
    <div className="flex flex-col h-full bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <span className="text-base">👨‍💻</span>
          <span className="text-sm font-medium text-white">Claude</span>
          <span className="text-xs text-orange-400/60">Lead Programmer</span>
          <span className={`px-1.5 py-0.5 text-xs rounded ${
            connected ? 'bg-green-600/20 text-green-400' :
            connecting ? 'bg-yellow-600/20 text-yellow-400' :
            'bg-gray-700 text-gray-400'
          }`}>
            {connected ? 'Connected' : connecting ? 'Connecting...' : 'Disconnected'}
          </span>
          {connected && (
            <span className={`flex items-center gap-1 px-1.5 py-0.5 text-xs rounded ${
              memoryStatus === 'loaded' ? 'bg-purple-600/20 text-purple-400' :
              memoryStatus === 'loading' ? 'bg-yellow-600/20 text-yellow-400' :
              'bg-gray-700 text-gray-500'
            }`}>
              <Brain className="w-3 h-3" />
              {memoryStatus === 'loaded' ? 'Memory' : memoryStatus === 'loading' ? 'Loading...' : 'No Memory'}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {connected ? (
            <button
              onClick={disconnect}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-red-600/20 text-red-400 hover:bg-red-600/30 rounded"
            >
              <PowerOff className="w-3 h-3" />
              Disconnect
            </button>
          ) : (
            <button
              onClick={connect}
              disabled={connecting}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-green-600/20 text-green-400 hover:bg-green-600/30 rounded disabled:opacity-50"
            >
              <Power className="w-3 h-3" />
              {connecting ? 'Connecting...' : 'Connect'}
            </button>
          )}
        </div>
      </div>

      {/* Project path */}
      <div className="flex items-center gap-2 px-3 py-1 bg-gray-800/50 border-b border-gray-700 text-xs text-gray-500">
        <FolderOpen className="w-3 h-3" />
        <span className="truncate">{projectPath}</span>
      </div>

      {/* Terminal output - xterm.js handles all the TUI rendering */}
      <div
        ref={terminalRef}
        className="flex-1 min-h-0 overflow-x-auto overflow-y-auto"
        style={{ padding: '8px' }}
      />

      {/* Input area - separate textarea since xterm keyboard wasn't working */}
      <div className="shrink-0 p-2 bg-gray-800 border-t border-gray-700">
        <div className="flex gap-2">
          <span className="text-orange-400 font-mono text-sm pt-2">$</span>
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onPaste={(e) => {
              // Get pasted text and update state immediately
              const pastedText = e.clipboardData.getData('text');
              const target = e.target as HTMLTextAreaElement;
              const start = target.selectionStart;
              const end = target.selectionEnd;
              const newValue = inputValue.slice(0, start) + pastedText + inputValue.slice(end);
              setInputValue(newValue);
              e.preventDefault();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                // Use the textarea's current value directly to avoid state timing issues
                const currentValue = (e.target as HTMLTextAreaElement).value;
                if (currentValue.trim() && wsRef.current?.readyState === WebSocket.OPEN) {
                  // Send the value directly
                  const text = currentValue.trim();
                  if (text.length > 1000) {
                    // Chunk long input
                    const chunks: string[] = [];
                    for (let i = 0; i < text.length; i += 1000) {
                      chunks.push(text.slice(i, i + 1000));
                    }
                    let chunkIndex = 0;
                    const sendNextChunk = () => {
                      if (chunkIndex < chunks.length && wsRef.current?.readyState === WebSocket.OPEN) {
                        wsRef.current.send(JSON.stringify({ type: 'input', data: chunks[chunkIndex] }));
                        chunkIndex++;
                        if (chunkIndex < chunks.length) {
                          setTimeout(sendNextChunk, 50);
                        } else {
                          setTimeout(() => {
                            if (wsRef.current?.readyState === WebSocket.OPEN) {
                              wsRef.current.send(JSON.stringify({ type: 'input', data: '\r' }));
                            }
                          }, 100);
                        }
                      }
                    };
                    sendNextChunk();
                  } else {
                    wsRef.current.send(JSON.stringify({ type: 'input', data: text }));
                    setTimeout(() => {
                      if (wsRef.current?.readyState === WebSocket.OPEN) {
                        wsRef.current.send(JSON.stringify({ type: 'input', data: '\r' }));
                      }
                    }, 50);
                  }
                  // Log to conversation
                  if (onConversationMessage) {
                    onConversationMessage({
                      id: `user-${Date.now()}`,
                      user_id: 'me',
                      user_name: 'You',
                      content: text.length > 500 ? text.slice(0, 500) + `... (${text.length} chars)` : text,
                      created_at: new Date().toISOString(),
                    });
                  }
                  setInputValue('');
                } else if (!currentValue.trim()) {
                  // Empty input - just send Enter for confirmations
                  wsRef.current?.send(JSON.stringify({ type: 'input', data: '\r' }));
                }
              } else if (e.key === 'Escape') {
                // Send Escape character for TUI navigation
                if (wsRef.current?.readyState === WebSocket.OPEN) {
                  wsRef.current.send(JSON.stringify({ type: 'input', data: '\x1b' }));
                }
              }
            }}
            disabled={!connected}
            placeholder={connected ? 'Type command and press Enter (Shift+Enter for new line)...' : 'Click Connect first'}
            rows={6}
            className="flex-1 bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm font-mono placeholder-gray-500 focus:outline-none focus:border-orange-500 disabled:opacity-50 resize-y min-h-[120px]"
          />
          <button
            onClick={sendInput}
            disabled={!connected}
            className="px-3 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 text-white rounded text-sm self-end"
          >
            Send
          </button>
        </div>
        <p className="text-gray-500 text-xs mt-1 ml-6">Enter to send, Shift+Enter for new line, Escape for TUI navigation</p>
      </div>
    </div>
  );
}

export default ClaudeTerminal;
