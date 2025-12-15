'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Power, PowerOff, FolderOpen, Brain } from 'lucide-react';
import type { Terminal } from '@xterm/xterm';
import type { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { useUser } from '@/app/contexts/UserContext';

// Import from terminal module
import {
  type ChatLogMessage,
  type ConversationMessage,
  type ClaudeTerminalProps,
  DEV_DROPLET,
  CHAT_DEBOUNCE_MS,
  MIN_CONTENT_LENGTH,
  DEDUP_COOLDOWN_MS,
  BRIEFING_FALLBACK_MS,
  POST_BRIEFING_DELAY_MS,
  filterForChat,
  shouldFilterContent,
  cleanAnsiCodes,
  sendChunkedMessage,
  sendMultipleEnters,
  sendArrowKey,
  sendEscape,
  sendEnter,
  useSusanBriefing,
  buildContextPrompt,
  useChadTranscription,
} from './terminal';

// Re-export types for external consumers
export type { ChatLogMessage, ConversationMessage };

export function ClaudeTerminal({
  projectPath = '/var/www/NextBid_Dev/dev-studio-5000',
  wsUrl,
  onMessage,
  sendRef,
  connectRef,
  onConversationMessage,
  onConnectionChange,
}: ClaudeTerminalProps) {
  const { user } = useUser();
  const wsRef = useRef<WebSocket | null>(null);
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const contextSentRef = useRef(false);

  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [inputValue, setInputValue] = useState('');

  // Use extracted hooks
  const {
    memoryStatus,
    susanContext,
    susanContextRef,
    fetchSusanContext,
    reset: resetSusan,
  } = useSusanBriefing(projectPath);

  const {
    connectToChad,
    sendToChad,
    disconnect: disconnectChad,
  } = useChadTranscription(projectPath, user?.id);

  // Chat buffering refs
  const responseBufferRef = useRef<string>('');
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const recentMessagesRef = useRef<string[]>([]);
  const lastMessageTimeRef = useRef<number>(0);
  const briefingSentToClaudeRef = useRef<boolean>(false);
  const showedReadyMessageRef = useRef<boolean>(false);
  const readyToShowMessagesRef = useRef<boolean>(false);

  // Expose send function via ref for external use (AI Team Chat)
  const sendMessage = useCallback((message: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      sendChunkedMessage(wsRef.current, message);

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

  // Initialize xterm.js
  useEffect(() => {
    if (!terminalRef.current || xtermRef.current) return;

    const initTerminal = async () => {
      const { Terminal } = await import('@xterm/xterm');
      const { FitAddon } = await import('@xterm/addon-fit');

      const term = new Terminal({
        theme: {
          background: '#0d1117',
          foreground: '#e6edf3',
          cursor: '#58a6ff',
          cursorAccent: '#0d1117',
          black: '#0d1117',
          red: '#ff7b72',
          green: '#3fb950',
          yellow: '#d29922',
          blue: '#58a6ff',
          magenta: '#bc8cff',
          cyan: '#39c5cf',
          white: '#e6edf3',
          brightBlack: '#484f58',
          brightRed: '#ffa198',
          brightGreen: '#56d364',
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

    const handleResize = () => {
      if (fitAddonRef.current) {
        setTimeout(() => fitAddonRef.current?.fit(), 100);
      }
    };
    window.addEventListener('resize', handleResize);

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

  const connect = useCallback(async () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    setConnecting(true);
    contextSentRef.current = false;

    const contextPromise = fetchSusanContext();
    connectToChad();

    const wsEndpoint = wsUrl || `ws://${DEV_DROPLET}:5400`;
    const fullUrl = `${wsEndpoint}?path=${encodeURIComponent(projectPath)}&mode=claude`;
    const ws = new WebSocket(fullUrl);

    ws.onopen = async () => {
      setConnected(true);
      setConnecting(false);

      if (onConversationMessage) {
        onConversationMessage({
          id: `claude-${Date.now()}`,
          user_id: 'claude',
          user_name: 'Claude',
          content: 'Be right there, gathering my thoughts... 🧠',
          created_at: new Date().toISOString(),
        });
      }

      if (xtermRef.current) {
        xtermRef.current.writeln('\x1b[32m[Connected]\x1b[0m');
        xtermRef.current.writeln('');
        xtermRef.current.writeln('\x1b[36m☕ Hold please... your master coder will be right with you.\x1b[0m');
        xtermRef.current.writeln('\x1b[90m   Starting Claude Code...\x1b[0m');

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

      if (fitAddonRef.current && xtermRef.current) {
        ws.send(JSON.stringify({
          type: 'resize',
          cols: xtermRef.current.cols,
          rows: xtermRef.current.rows
        }));
      }

      setTimeout(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'input', data: 'claude\r' }));
        }
      }, 2000);

      // Fallback: If Susan briefing hasn't been sent after 12 seconds
      setTimeout(() => {
        const ctx = susanContextRef.current;
        if (!contextSentRef.current && ctx?.greeting && ws.readyState === WebSocket.OPEN) {
          console.log('[ClaudeTerminal] Fallback timer: sending Susan briefing');
          contextSentRef.current = true;
          briefingSentToClaudeRef.current = true;

          if (xtermRef.current) {
            xtermRef.current.writeln('\x1b[35m\n📚 Sending memory briefing to Claude...\x1b[0m');
          }

          const contextMessage = buildContextPrompt(ctx);
          sendChunkedMessage(ws, contextMessage, () => {
            sendMultipleEnters(ws, () => {
              setTimeout(() => {
                readyToShowMessagesRef.current = true;
                console.log('[ClaudeTerminal] Ready to show chat messages (fallback)');
              }, POST_BRIEFING_DELAY_MS);
            });
          });
        }
      }, BRIEFING_FALLBACK_MS);

      inputRef.current?.focus();
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'output' && xtermRef.current) {
          xtermRef.current.write(msg.data);
          xtermRef.current.scrollToBottom();
          sendToChad(msg.data);

          const cleanData = cleanAnsiCodes(msg.data);

          // Detect Claude ready and send Susan's briefing
          const currentContext = susanContextRef.current;
          if (!contextSentRef.current && currentContext?.greeting) {
            if (cleanData.length > 10) {
              console.log('[ClaudeTerminal] Checking for ready prompt in:', cleanData.slice(-100));
            }

            const isClaudeReady = cleanData.includes('What would you like') ||
                                  cleanData.includes('How can I help') ||
                                  cleanData.includes('What can I help') ||
                                  cleanData.includes('help you with') ||
                                  cleanData.includes('work on today') ||
                                  cleanData.includes('assist you') ||
                                  /[❯>›»]\s*$/.test(cleanData) ||
                                  cleanData.includes('❯') ||
                                  (cleanData.includes('Opus') && cleanData.includes('Claude'));

            if (isClaudeReady) {
              contextSentRef.current = true;
              console.log('[ClaudeTerminal] Detected Claude ready prompt, sending Susan briefing');

              if (xtermRef.current) {
                xtermRef.current.writeln('\x1b[35m\n📚 Sending memory briefing to Claude...\x1b[0m');
              }

              setTimeout(() => {
                if (wsRef.current?.readyState === WebSocket.OPEN) {
                  const contextMessage = buildContextPrompt(currentContext);
                  console.log('[ClaudeTerminal] Sending context:', contextMessage.slice(0, 100) + '...');
                  briefingSentToClaudeRef.current = true;

                  sendChunkedMessage(wsRef.current, contextMessage, () => {
                    sendMultipleEnters(wsRef.current!, () => {
                      setTimeout(() => {
                        readyToShowMessagesRef.current = true;
                        console.log('[ClaudeTerminal] Ready to show chat messages');
                      }, POST_BRIEFING_DELAY_MS);
                    });
                  });
                }
              }, 500);
            }
          }

          // Filter and buffer for chat display
          const filteredContent = filterForChat(msg.data);
          if (filteredContent) {
            responseBufferRef.current += filteredContent;
          }

          // Debounce: send buffered content after output settles
          if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
          debounceTimerRef.current = setTimeout(() => {
            const content = responseBufferRef.current.trim();

            if (content.length < MIN_CONTENT_LENGTH) {
              responseBufferRef.current = '';
              return;
            }

            if (shouldFilterContent(content)) {
              responseBufferRef.current = '';
              return;
            }

            // Deduplication
            const normalizedContent = content.replace(/\s+/g, ' ').toLowerCase();
            const isDuplicate = recentMessagesRef.current.some(recent => {
              const normalizedRecent = recent.replace(/\s+/g, ' ').toLowerCase();
              if (normalizedContent === normalizedRecent) return true;
              const sig1 = normalizedContent.slice(0, 50);
              const sig2 = normalizedRecent.slice(0, 50);
              if (sig1 === sig2) return true;
              return false;
            });

            const now = Date.now();
            const tooSoon = now - lastMessageTimeRef.current < DEDUP_COOLDOWN_MS;

            if (!isDuplicate && !tooSoon) {
              recentMessagesRef.current.push(content);
              if (recentMessagesRef.current.length > 10) {
                recentMessagesRef.current.shift();
              }
              lastMessageTimeRef.current = now;

              if (onConversationMessage) {
                if (!readyToShowMessagesRef.current) {
                  responseBufferRef.current = '';
                  return;
                }

                if (briefingSentToClaudeRef.current && !showedReadyMessageRef.current) {
                  showedReadyMessageRef.current = true;
                  onConversationMessage({
                    id: `claude-ready-${Date.now()}`,
                    user_id: 'claude',
                    user_name: 'Claude',
                    content: "Ready to work! Let's go! 🚀",
                    created_at: new Date().toISOString(),
                  });
                }

                onConversationMessage({
                  id: `claude-${Date.now()}`,
                  user_id: 'claude',
                  user_name: 'Claude',
                  content: content,
                  created_at: new Date().toISOString(),
                });
              }
            }
            responseBufferRef.current = '';
          }, CHAT_DEBOUNCE_MS);
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
  }, [projectPath, wsUrl, fetchSusanContext, connectToChad, sendToChad, onConversationMessage, susanContextRef]);

  const disconnect = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
    disconnectChad();
    setConnected(false);
    resetSusan();
    briefingSentToClaudeRef.current = false;
    showedReadyMessageRef.current = false;
    readyToShowMessagesRef.current = false;
    recentMessagesRef.current = [];
    responseBufferRef.current = '';
  }, [disconnectChad, resetSusan]);

  // Expose connect function via ref
  useEffect(() => {
    if (connectRef) {
      connectRef.current = connect;
    }
  }, [connectRef, connect]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const currentValue = (e.target as HTMLTextAreaElement).value;
      if (currentValue.trim() && wsRef.current?.readyState === WebSocket.OPEN) {
        const text = currentValue.trim();
        sendChunkedMessage(wsRef.current, text);
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
      } else if (!currentValue.trim() && wsRef.current) {
        sendEnter(wsRef.current);
      }
    } else if (e.key === 'Escape' && wsRef.current) {
      sendEscape(wsRef.current);
    } else if (e.key === 'ArrowUp' && wsRef.current) {
      e.preventDefault();
      sendArrowKey(wsRef.current, 'up');
    } else if (e.key === 'ArrowDown' && wsRef.current) {
      e.preventDefault();
      sendArrowKey(wsRef.current, 'down');
    } else if (e.key === 'ArrowRight' && wsRef.current) {
      e.preventDefault();
      sendArrowKey(wsRef.current, 'right');
    } else if (e.key === 'ArrowLeft' && wsRef.current) {
      e.preventDefault();
      sendArrowKey(wsRef.current, 'left');
    }
  }, [onConversationMessage]);

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const pastedText = e.clipboardData.getData('text');
    const target = e.target as HTMLTextAreaElement;
    const start = target.selectionStart;
    const end = target.selectionEnd;
    const currentVal = target.value;
    const newValue = currentVal.slice(0, start) + pastedText + currentVal.slice(end);

    target.value = newValue;
    setInputValue(newValue);
    const newCursorPos = start + pastedText.length;
    target.setSelectionRange(newCursorPos, newCursorPos);
    e.preventDefault();
  }, []);

  const sendInput = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      if (inputValue.trim()) {
        sendChunkedMessage(wsRef.current, inputValue);
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
        sendEnter(wsRef.current);
      }
      setInputValue('');
    }
  }, [inputValue, onConversationMessage]);

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

      {/* Terminal output */}
      <div
        ref={terminalRef}
        className="flex-1 min-h-0 overflow-x-auto overflow-y-auto"
        style={{ padding: '8px' }}
      />

      {/* Input area */}
      <div className="shrink-0 p-2 bg-gray-800 border-t border-gray-700">
        <div className="flex gap-2">
          <span className="text-orange-400 font-mono text-sm pt-2">$</span>
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onPaste={handlePaste}
            onKeyDown={handleKeyDown}
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
