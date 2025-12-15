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
  const recentMessagesRef = useRef<Set<string>>(new Set()); // Track recent message signatures
  const susanBriefingSentRef = useRef<boolean>(false); // Session-level Susan briefing tracking
  const inSusanBriefingRef = useRef<boolean>(false); // Track if currently inside a briefing block

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
          // Dark mode with bright red/green (Claude Code style)
          background: '#0d1117',      // Dark background
          foreground: '#e6edf3',      // Light text
          cursor: '#58a6ff',          // Blue cursor
          cursorAccent: '#0d1117',
          black: '#0d1117',
          red: '#ff7b72',             // Bright red
          green: '#3fb950',           // Bright green
          yellow: '#d29922',
          blue: '#58a6ff',
          magenta: '#bc8cff',
          cyan: '#39c5cf',
          white: '#e6edf3',
          brightBlack: '#484f58',
          brightRed: '#ffa198',       // Brighter red
          brightGreen: '#56d364',     // Brighter green
          brightYellow: '#e3b341',
          brightBlue: '#79c0ff',
          brightMagenta: '#d2a8ff',
          brightCyan: '#56d4dd',
          brightWhite: '#ffffff',
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

            // Skip TUI noise (spinners, status, prompts, echoes):
            // - Susan briefing duplicate detection at LINE level
            // Track entering/exiting briefing blocks
            if (trimmedLine.includes('=== SUSAN') && trimmedLine.includes('BRIEFING')) {
              if (susanBriefingSentRef.current) {
                inSusanBriefingRef.current = true; // We're in a duplicate briefing
                continue;
              }
              // First briefing - let it through
              susanBriefingSentRef.current = true;
            }
            if (trimmedLine.includes('=== END BRIEFING ===')) {
              if (inSusanBriefingRef.current) {
                inSusanBriefingRef.current = false; // Exit duplicate briefing block
                continue;
              }
            }
            // Skip all lines while inside a duplicate briefing block
            if (inSusanBriefingRef.current) continue;
            // - Skip repeated "Ready to continue" lines (Susan briefing footer)
            if (trimmedLine.includes('Ready to continue where we left off')) {
              if (susanBriefingSentRef.current) continue; // Only allow first one
            }
            // - Empty lines at very start
            if (trimmedLine.length === 0 && responseBufferRef.current.length === 0) continue;
            // - Shell prompts
            if (trimmedLine === '$' || trimmedLine === '%' || trimmedLine === '>') continue;
            if (trimmedLine.startsWith('❯')) continue;
            // - User input echo (lines starting with > followed by text)
            if (trimmedLine.startsWith('> ') && !trimmedLine.startsWith('> ===')) continue;
            if (trimmedLine.startsWith('>') && !trimmedLine.startsWith('> ===')) continue; // Also catch >text without space
            // - Short user input echo (just > followed by 1-3 chars, like "> k" or "> y")
            if (/^>\s*[a-zA-Z0-9]{1,3}$/.test(trimmedLine)) continue;
            // - Longer user input echo (user messages getting echoed back)
            if (/^>\s*\w+/.test(trimmedLine) && !trimmedLine.includes('===')) continue;
            // - TUI instruction/tip lines
            if (trimmedLine.includes('Enter to select')) continue;
            if (trimmedLine.includes('Tab/Arrow keys')) continue;
            if (trimmedLine.includes('Esc to cancel')) continue;
            if (trimmedLine.includes('to navigate')) continue;
            if (trimmedLine.includes('Press up to edit')) continue;
            if (trimmedLine.includes('queued messages')) continue;
            if (trimmedLine.startsWith('⎿')) continue; // Tip indicator
            if (trimmedLine.includes('Tip: Run /')) continue;
            if (trimmedLine.includes('/install-github-app')) continue;
            if (trimmedLine.includes('/resume later')) continue;
            if (trimmedLine.includes('terminal?')) continue; // Filter ANY line with terminal?
            if (trimmedLine.includes('asted text #')) continue; // "Pasted text #1" indicator
            if (trimmedLine.includes('+1 lines]')) continue; // Paste line count indicator
            // - Guest passes notification spam
            if (trimmedLine.includes('guest passes')) continue;
            if (trimmedLine.includes('/passes')) continue;
            if (trimmedLine.includes('CC ✻')) continue; // Claude Code branding icon
            if (trimmedLine.includes('┊ (')) continue; // Status bar separator
            // - TUI turn indicator spam
            if (trimmedLine === 'that turn' || trimmedLine.includes('that turn')) continue;
            // - Spinner characters (all the fancy ones Claude Code uses)
            if (/^[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏·✢✶✻✽*•∴]+$/.test(trimmedLine)) continue;
            // - Status lines (Ideating, Thinking, Unfurling, shortcuts hints)
            if (/^[·✢✶✻✽*•∴]?\s*(Ideating|Thinking|Thought|Unfurling)/.test(trimmedLine)) continue;
            if (trimmedLine.includes('(esc to interrupt)')) continue;
            if (trimmedLine.includes('esc to interrupt')) continue; // Without parens
            if (trimmedLine.includes('for shortcuts')) continue;
            if (trimmedLine.includes('ctrl+o to show')) continue;
            if (trimmedLine.includes('ctrl+o to expand')) continue; // Expand hint
            if (trimmedLine.includes('ctrl-g to edit')) continue;
            // - Claude Code UI chrome
            if (trimmedLine.startsWith('Try "')) continue;
            if (trimmedLine.startsWith('Try \'')) continue;
            if (trimmedLine.includes('Try "')) continue; // Catch mid-line suggestions too
            if (trimmedLine === '?' || trimmedLine === '? ') continue;
            // NOTE: Welcome banner, boxes, and ASCII art are ALLOWED through
            // Only filtering actual TUI spam that repeats 50+ times
            // - TUI separator lines - ONLY pure horizontal lines (no corners/edges)
            // These are box-drawing horizontal chars: ─ (2500), ━ (2501), ═ (2550)
            // Box corners/edges we KEEP: ┌┐└┘├┤┬┴┼│ etc.
            if (/^[─━═\-]+$/.test(trimmedLine) && trimmedLine.length > 5) continue; // Pure horizontal separator spam
            // Don't filter lines with corners - they're part of boxes!
            // - Empty standalone bullet markers (not part of content)
            // Use regex to catch bullets with any trailing whitespace
            if (/^[•●]\s*$/.test(trimmedLine)) continue;
            if (trimmedLine === '-' || trimmedLine === '*') continue;
            // - Tool call status lines (● Search, ● Bash, ● Read, etc.)
            if (/^●?\s*(Search|Bash|Read|Write|Edit|Glob|Grep|Task)\s*\(/.test(trimmedLine)) continue;
            // - Tool output noise
            if (trimmedLine.startsWith('drwxr-xr-x')) continue; // ls -la output
            if (trimmedLine.startsWith('-rw-r--r--')) continue; // ls -la files
            if (trimmedLine.includes('… +') && trimmedLine.includes('lines')) continue; // Truncation indicator
            // - Token/timing status
            if (/↓\s*[\d.]+k?\s*tokens/.test(trimmedLine)) continue; // Token count indicators

            // Everything else goes through - INCLUDING box drawing!
            // Preserve original indentation (use line, not trimmedLine)
            if (trimmedLine.length === 0) {
              // Only add blank line if last char isn't already a newline (prevent gaps)
              if (!responseBufferRef.current.endsWith('\n\n')) {
                responseBufferRef.current += '\n';
              }
            } else {
              // Keep original line to preserve indentation
              responseBufferRef.current += line + '\n';
            }
          }

          // Detect if Claude's response is complete (prompt reappeared)
          const isResponseComplete = cleanData.includes('❯') ||
                                     cleanData.includes('> ') ||
                                     cleanData.includes('? ') ||  // Question prompt
                                     cleanData.match(/\n>\s*$/);  // Prompt at end of line

          // Function to send buffered content to chat
          const sendBufferedContent = () => {
            let bufferedContent = responseBufferRef.current.trim();

            // Post-process content for cleaner formatting
            // 1. Remove • markers at start of lines (TUI noise)
            // They appear before actual content or on their own
            bufferedContent = bufferedContent.replace(/^[•●]\s*\n/gm, ''); // Standalone bullet + newline
            bufferedContent = bufferedContent.replace(/^[•●]\s*$/gm, '');  // Standalone bullet at end
            bufferedContent = bufferedContent.replace(/^[•●]\s*/gm, '');   // Bullet at start of line (with or without space)
            // 2. Join numbered items split across lines (1.\n  Second → 1. Second)
            // Handle various formats: "1.\n", "1. \n", "1.\nSecond", etc.
            bufferedContent = bufferedContent.replace(/^(\d+\.)\s*\n\s*(\S)/gm, '$1 $2');
            bufferedContent = bufferedContent.replace(/^(\d+\.)\s*\n/gm, '$1 ');
            // 3. Normalize bullet spacing
            bufferedContent = bufferedContent.replace(/^(\s*)-\s+/gm, '$1- ');
            // 4. Remove • prefix if followed by - (redundant marker)
            bufferedContent = bufferedContent.replace(/^•\s*-\s*/gm, '- ');
            // 5. Clean up multiple consecutive newlines
            bufferedContent = bufferedContent.replace(/\n{3,}/g, '\n\n');
            // 6. Normalize indentation - trim trailing but keep leading structure
            bufferedContent = bufferedContent.split('\n').map(line => {
              // Keep intentional indentation (2+ spaces) but trim trailing whitespace
              const leadingMatch = line.match(/^(\s+)/);
              if (leadingMatch) {
                return leadingMatch[1] + line.trimEnd().slice(leadingMatch[1].length);
              }
              return line.trim();
            }).join('\n');
            // 7. Final trim
            bufferedContent = bufferedContent.trim();

            // Only send if we have meaningful content (lowered to 3 to allow short messages)
            if (bufferedContent.length > 3) {
              // Create multiple signatures for robust dedup:
              // 1. First 100 chars (catches similar starts)
              // 2. Normalized content hash (catches identical content with whitespace differences)
              const normalizedContent = bufferedContent.replace(/\s+/g, ' ').trim();
              const shortSig = normalizedContent.slice(0, 100);
              const fullSig = normalizedContent.slice(0, 500); // Longer signature for better matching

              // Skip if we've seen similar content recently
              if (recentMessagesRef.current.has(shortSig) || recentMessagesRef.current.has(fullSig)) {
                responseBufferRef.current = '';
                return;
              }

              // Skip Susan briefing duplicates (session-level - only send ONCE per connection)
              if (bufferedContent.includes('SUSAN') && bufferedContent.includes('BRIEFING')) {
                if (susanBriefingSentRef.current) {
                  responseBufferRef.current = '';
                  return;
                }
                susanBriefingSentRef.current = true; // Mark as sent for entire session
              }

              // Skip echoed user instructions (long prompts that get echoed back)
              if (bufferedContent.includes('Run these tests in order') ||
                  bufferedContent.includes('Wait for my y/n') ||
                  bufferedContent.includes('Start with Test 1')) {
                responseBufferRef.current = '';
                return;
              }

              // Add signatures to recent set and auto-expire
              recentMessagesRef.current.add(shortSig);
              recentMessagesRef.current.add(fullSig);
              setTimeout(() => {
                recentMessagesRef.current.delete(shortSig);
                recentMessagesRef.current.delete(fullSig);
              }, 30000); // Increased to 30 seconds

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
          if (isResponseComplete && responseBufferRef.current.length > 3) {
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
    susanBriefingSentRef.current = false; // Reset for next connection
    inSusanBriefingRef.current = false; // Reset briefing block tracking
    recentMessagesRef.current.clear(); // Clear dedup cache
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
              // Get pasted text and update both DOM and state immediately
              const pastedText = e.clipboardData.getData('text');
              const target = e.target as HTMLTextAreaElement;
              const start = target.selectionStart;
              const end = target.selectionEnd;
              const currentVal = target.value; // Use DOM value, not React state
              const newValue = currentVal.slice(0, start) + pastedText + currentVal.slice(end);

              // Update DOM directly for immediate availability
              target.value = newValue;
              // Also update React state for controlled component
              setInputValue(newValue);
              // Set cursor position after pasted text
              const newCursorPos = start + pastedText.length;
              target.setSelectionRange(newCursorPos, newCursorPos);
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
