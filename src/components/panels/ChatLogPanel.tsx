'use client';

import { useRef, useEffect, useState } from 'react';
import { Bot, User, RefreshCw } from 'lucide-react';

export interface ChatLogMessage {
  id: string;
  source: 'claude' | 'chad' | 'external';
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ChatLogPanelProps {
  messages?: ChatLogMessage[];
  streamingContent?: string;
  isSending?: boolean;
  session?: any;
  onSummarize?: () => void;
  onEndSession?: () => void;
  isSummarizing?: boolean;
  onSendToClaudeTerminal?: (message: string) => void;
  onSendToChad?: (message: string) => void;
}

const CHAD_URL = process.env.NEXT_PUBLIC_CHAD_URL || 'http://161.35.229.220:5401';

export function ChatLogPanel({
  messages: propMessages = [],
  streamingContent = '',
  isSending = false,
}: ChatLogPanelProps) {
  const [liveMessages, setLiveMessages] = useState<ChatLogMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Connect to Chad's WebSocket for live terminal output
  useEffect(() => {
    const connect = () => {
      try {
        const ws = new WebSocket(`ws://161.35.229.220:5401/ws?mode=monitor&source=ui-chatlog`);
        
        ws.onopen = () => {
          setIsConnected(true);
          console.log('[ChatLog] Connected to Chad');
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'monitor_output' && data.data) {
              // Parse terminal output for user/assistant messages
              const lines = data.data.split('\n');
              for (const line of lines) {
                if (line.includes('[👤 User]') || line.includes('[🤖 External Claude]')) {
                  const isUser = line.includes('[👤 User]');
                  const content = line.replace(/\[👤 User\]|\[🤖 External Claude\]/g, '').trim();
                  if (content) {
                    setLiveMessages(prev => [...prev.slice(-100), {
                      id: Date.now().toString() + Math.random(),
                      source: 'external',
                      role: isUser ? 'user' : 'assistant',
                      content,
                      timestamp: new Date()
                    }]);
                  }
                }
              }
            }
          } catch (e) {
            // Not JSON, ignore
          }
        };

        ws.onclose = () => {
          setIsConnected(false);
          setTimeout(connect, 5000);
        };

        ws.onerror = () => {
          setIsConnected(false);
        };

        wsRef.current = ws;
      } catch (err) {
        console.error('[ChatLog] WebSocket error:', err);
        setTimeout(connect, 5000);
      }
    };

    connect();

    return () => {
      wsRef.current?.close();
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [liveMessages, propMessages, streamingContent]);

  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Combine prop messages with live messages
  const allMessages = [...propMessages, ...liveMessages];

  return (
    <div className="h-full flex flex-col bg-gray-900">
      {/* Header */}
      <div className="px-3 py-2 bg-blue-900/30 border-b border-blue-800 flex items-center gap-2">
        <Bot className="w-4 h-4 text-blue-400" />
        <span className="text-blue-300 text-sm font-medium">External Claude</span>
        <span className={`ml-auto w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`} />
        {isSending && (
          <span className="text-xs text-blue-400 animate-pulse">typing...</span>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-auto p-3 space-y-3">
        {allMessages.length === 0 && !streamingContent ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 text-sm gap-2">
            <RefreshCw className={`w-5 h-5 ${isConnected ? 'text-green-400' : 'animate-spin'}`} />
            <p>{isConnected ? 'Watching External Claude activity...' : 'Connecting to Chad...'}</p>
          </div>
        ) : (
          <>
            {allMessages.map((msg) => (
              <div key={msg.id} className="flex gap-2">
                <div className={`w-6 h-6 rounded flex items-center justify-center flex-shrink-0 ${
                  msg.role === 'user' ? 'bg-green-900/50' : 'bg-blue-900/50'
                }`}>
                  {msg.role === 'user' ? (
                    <User className="w-3 h-3 text-green-400" />
                  ) : (
                    <Bot className="w-3 h-3 text-blue-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`text-xs font-medium ${
                      msg.role === 'user' ? 'text-green-400' : 'text-blue-400'
                    }`}>
                      {msg.role === 'user' ? 'User' : 'Claude'}
                    </span>
                    <span className="text-gray-600 text-[10px]">
                      {formatTime(msg.timestamp)}
                    </span>
                  </div>
                  <div className="text-gray-300 text-xs leading-relaxed whitespace-pre-wrap break-words">
                    {msg.content}
                  </div>
                </div>
              </div>
            ))}

            {streamingContent && (
              <div className="flex gap-2">
                <div className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0 bg-blue-900/50">
                  <Bot className="w-3 h-3 text-blue-400 animate-pulse" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-medium text-blue-400">Claude</span>
                    <span className="text-gray-600 text-[10px]">now</span>
                  </div>
                  <div className="text-gray-300 text-xs leading-relaxed whitespace-pre-wrap break-words">
                    {streamingContent}
                    <span className="animate-pulse">▊</span>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}
