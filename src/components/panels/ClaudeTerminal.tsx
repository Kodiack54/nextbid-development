'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal, Power, PowerOff, FolderOpen } from 'lucide-react';

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
    '\x1b[36m    Claude Code Terminal (Subscription)    \x1b[0m',
    '\x1b[36m═══════════════════════════════════════════\x1b[0m',
    '',
    '\x1b[33mClick "Connect" then type commands below\x1b[0m',
    `\x1b[90mProject: ${projectPath}\x1b[0m`,
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
      setOutput(prev => [...prev, '\x1b[32m[Connected]\x1b[0m Type "claude" to start Claude Code', '']);
      ws.send(JSON.stringify({ type: 'resize', cols: 120, rows: 30 }));
      inputRef.current?.focus();
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'output') {
          // Split by newlines and add each line
          const lines = msg.data.split(/\r?\n/);
          setOutput(prev => [...prev, ...lines.filter((l: string) => l)]);
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
          <Terminal className="w-4 h-4 text-orange-400" />
          <span className="text-sm font-medium text-white">Claude Code</span>
          <span className="text-xs text-orange-400/60">(Subscription)</span>
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

      {/* Output area */}
      <div
        ref={outputRef}
        className="flex-1 overflow-auto p-3 font-mono text-sm bg-[#1a1b26] space-y-0.5"
      >
        {output.map((line, i) => (
          <div key={i} className="whitespace-pre-wrap break-all">
            {parseAnsi(line).map((part, j) => (
              <span key={j} className={part.color}>{part.text}</span>
            ))}
          </div>
        ))}
      </div>

      {/* Input area */}
      <div className="p-2 bg-gray-800 border-t border-gray-700">
        <div className="flex gap-2">
          <span className="text-orange-400 font-mono text-sm py-2">$</span>
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={!connected}
            placeholder={connected ? 'Type command and press Enter...' : 'Click Connect first'}
            className="flex-1 bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm font-mono placeholder-gray-500 focus:outline-none focus:border-orange-500 disabled:opacity-50"
          />
          <button
            onClick={sendInput}
            disabled={!connected}
            className="px-3 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 text-white rounded text-sm"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

export default ClaudeTerminal;
