'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Power, PowerOff, FolderOpen } from 'lucide-react';

interface ClaudeTerminalProps {
  projectPath?: string;
  wsUrl?: string;
}

export function ClaudeTerminal({ projectPath = '/var/www/NextBid_Dev/dev-studio-5000', wsUrl }: ClaudeTerminalProps) {
  const wsRef = useRef<WebSocket | null>(null);
  const outputRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [output, setOutput] = useState<string[]>([
    '\x1b[36m═══════════════════════════════════════════\x1b[0m',
    '\x1b[36m   👨‍💻 Claude - Lead Programmer (5400)      \x1b[0m',
    '\x1b[36m═══════════════════════════════════════════\x1b[0m',
    '',
    '\x1b[33mClick "Connect" to summon your Lead Programmer\x1b[0m',
    '\x1b[90mUses your $200/mo subscription - no API costs\x1b[0m',
    '',
  ]);
  const [inputValue, setInputValue] = useState('');

  // Auto-scroll output
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);

  // Strip ANSI codes for display (simple version)
  const stripAnsi = (str: string) => {
    return str.replace(/\x1b\[[0-9;]*m/g, '');
  };

  // Parse ANSI to styled spans
  const parseAnsi = (text: string) => {
    const parts: { text: string; color: string }[] = [];
    let currentColor = 'text-gray-300';
    let remaining = text;

    const colorMap: Record<string, string> = {
      '30': 'text-gray-800', '31': 'text-red-400', '32': 'text-green-400',
      '33': 'text-yellow-400', '34': 'text-blue-400', '35': 'text-purple-400',
      '36': 'text-cyan-400', '37': 'text-gray-300', '90': 'text-gray-500',
      '91': 'text-red-300', '92': 'text-green-300', '93': 'text-yellow-300',
      '94': 'text-blue-300', '95': 'text-purple-300', '96': 'text-cyan-300',
      '0': 'text-gray-300',
    };

    const regex = /\x1b\[([0-9;]+)m/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(remaining)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ text: remaining.slice(lastIndex, match.index), color: currentColor });
      }
      const codes = match[1].split(';');
      for (const code of codes) {
        if (colorMap[code]) currentColor = colorMap[code];
      }
      lastIndex = regex.lastIndex;
    }

    if (lastIndex < remaining.length) {
      parts.push({ text: remaining.slice(lastIndex), color: currentColor });
    }

    return parts.length ? parts : [{ text, color: currentColor }];
  };

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    setConnecting(true);

    const DEV_DROPLET = '161.35.229.220';
    const wsEndpoint = wsUrl || `ws://${DEV_DROPLET}:5400`;
    const fullUrl = `${wsEndpoint}?path=${encodeURIComponent(projectPath)}&mode=claude`;

    const ws = new WebSocket(fullUrl);

    ws.onopen = () => {
      setConnected(true);
      setConnecting(false);
      setOutput(prev => [...prev,
        '\x1b[32m[Connected]\x1b[0m',
        '',
        '\x1b[36m☕ Hold please... your master coder will be right with you.\x1b[0m',
        '\x1b[90m   Starting Claude Code...\x1b[0m',
        ''
      ]);
      ws.send(JSON.stringify({ type: 'resize', cols: 120, rows: 30 }));

      // Auto-start Claude after 2 seconds
      setTimeout(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'input', data: 'claude\n' }));
        }
      }, 2000);

      inputRef.current?.focus();
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'output') {
          // Filter out terminal control sequences we don't need
          let data = msg.data;
          // Remove bracketed paste mode sequences
          data = data.replace(/\x1b\[\?2004[hl]/g, '');
          // Remove window title sequences
          data = data.replace(/\x1b\]0;[^\x07]*\x07/g, '');
          // Remove other common control sequences
          data = data.replace(/\x1b\[\?[0-9;]*[a-zA-Z]/g, '');

          // Split by newlines and add each line
          const lines = data.split(/\r?\n/);
          setOutput(prev => [...prev, ...lines.filter((l: string) => l.trim())]);
        } else if (msg.type === 'exit') {
          setOutput(prev => [...prev, `\x1b[33m[Process exited: ${msg.code}]\x1b[0m`]);
          setConnected(false);
        }
      } catch {
        setOutput(prev => [...prev, event.data]);
      }
    };

    ws.onerror = () => {
      setOutput(prev => [...prev, '\x1b[31m[Connection error]\x1b[0m']);
      setConnecting(false);
    };

    ws.onclose = () => {
      setConnected(false);
      setConnecting(false);
      setOutput(prev => [...prev, '\x1b[33m[Disconnected]\x1b[0m']);
    };

    wsRef.current = ws;
  }, [projectPath, wsUrl]);

  const disconnect = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
    setConnected(false);
  }, []);

  const sendInput = useCallback(() => {
    if (!inputValue.trim() && inputValue !== '') return;
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      // Show what user typed
      setOutput(prev => [...prev, `\x1b[94m$ ${inputValue}\x1b[0m`]);
      // Send with newline to execute
      wsRef.current.send(JSON.stringify({ type: 'input', data: inputValue + '\n' }));
      setInputValue('');
    }
  }, [inputValue]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      sendInput();
    }
  };

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

      {/* Output area - horizontal scroll to preserve Claude Code's TUI layout */}
      <div
        ref={outputRef}
        className="flex-1 min-h-0 overflow-auto p-3 font-mono text-xs bg-[#1a1b26]"
      >
        <div className="min-w-[900px]">
          {output.map((line, i) => (
            <div key={i} className="whitespace-pre">
              {parseAnsi(line).map((part, j) => (
                <span key={j} className={part.color}>{part.text}</span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Input area */}
      <div className="shrink-0 p-2 bg-gray-800 border-t border-gray-700">
        <div className="flex gap-2">
          <span className="text-orange-400 font-mono text-sm pt-2">$</span>
          <textarea
            ref={inputRef as any}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendInput();
              }
            }}
            disabled={!connected}
            placeholder={connected ? 'Type command and press Enter (Shift+Enter for new line)...' : 'Click Connect first'}
            rows={4}
            className="flex-1 bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm font-mono placeholder-gray-500 focus:outline-none focus:border-orange-500 disabled:opacity-50 resize-none"
          />
          <button
            onClick={sendInput}
            disabled={!connected}
            className="px-3 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 text-white rounded text-sm self-end"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

export default ClaudeTerminal;
