'use client';

import { useEffect, useRef, useState } from 'react';
import { Eye, Wifi, WifiOff } from 'lucide-react';

const WS_URL = 'ws://161.35.229.220:5400';

export function ServerClaudeViewer() {
  const wsRef = useRef<WebSocket | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [connected, setConnected] = useState(false);
  const [output, setOutput] = useState<string[]>([
    '\x1b[34m═══════════════════════════════════════════\x1b[0m',
    '\x1b[34m   🤖 Server Claude - Activity Monitor   \x1b[0m', 
    '\x1b[34m═══════════════════════════════════════════\x1b[0m',
    '',
    'Connecting to server...',
  ]);

  useEffect(() => {
    const connect = () => {
      try {
        const ws = new WebSocket(`${WS_URL}?mode=monitor`);
        
        ws.onopen = () => {
          setConnected(true);
          setOutput(prev => [...prev, '\x1b[32m[Connected as Monitor]\x1b[0m', '']);
        };

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'monitor_connected') {
              setOutput(prev => [...prev, `[Active Sessions: ${msg.activeSessions}]`]);
            } else if (msg.type === 'monitor_output' && msg.data) {
              setOutput(prev => [...prev, msg.data]);
            } else if (msg.type === 'session_started') {
              setOutput(prev => [...prev, `\x1b[32m[New session started - ${msg.activeSessions} active]\x1b[0m`]);
            } else if (msg.type === 'session_ended') {
              setOutput(prev => [...prev, `\x1b[33m[Session ended - ${msg.activeSessions} active]\x1b[0m`]);
            }
          } catch {
            // Raw text output
            setOutput(prev => [...prev, event.data]);
          }
        };

        ws.onclose = () => {
          setConnected(false);
          setOutput(prev => [...prev, '\x1b[33m[Disconnected - Reconnecting...]\x1b[0m']);
          setTimeout(connect, 3000);
        };

        ws.onerror = () => {
          setConnected(false);
        };

        wsRef.current = ws;
      } catch (err) {
        console.error('WebSocket error:', err);
        setTimeout(connect, 3000);
      }
    };

    connect();

    return () => {
      wsRef.current?.close();
    };
  }, []);

  // Auto-scroll
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [output]);

  return (
    <div className="flex flex-col h-full bg-[#0a1628]">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-[#0a1628] border-b border-blue-900/50">
        <div className="flex items-center gap-2">
          <span className="text-base">🤖</span>
          <span className="text-sm font-medium text-blue-400">Server Claude</span>
          <span className="text-xs text-blue-400/60">[Monitor]</span>
          <span className={`flex items-center gap-1 px-1.5 py-0.5 text-xs rounded ${
            connected ? 'bg-blue-600/20 text-blue-400' : 'bg-gray-700 text-gray-400'
          }`}>
            {connected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            {connected ? 'Watching' : 'Connecting...'}
          </span>
        </div>
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <Eye className="w-3 h-3" />
          Read-only
        </div>
      </div>

      {/* Output */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto p-3 font-mono text-sm text-gray-300"
        style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
      >
        {output.map((line, i) => (
          <div key={i} dangerouslySetInnerHTML={{ __html: ansiToHtml(line) }} />
        ))}
      </div>
    </div>
  );
}

// Simple ANSI to HTML converter
function ansiToHtml(text: string): string {
  return text
    .replace(/\x1b\[34m/g, '<span style="color: #58a6ff">')
    .replace(/\x1b\[32m/g, '<span style="color: #3fb950">')
    .replace(/\x1b\[33m/g, '<span style="color: #d29922">')
    .replace(/\x1b\[31m/g, '<span style="color: #ff7b72">')
    .replace(/\x1b\[90m/g, '<span style="color: #6e7681">')
    .replace(/\x1b\[0m/g, '</span>')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/&lt;span/g, '<span')
    .replace(/&lt;\/span&gt;/g, '</span>');
}

export default ServerClaudeViewer;
