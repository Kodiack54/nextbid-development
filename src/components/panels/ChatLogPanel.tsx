'use client';

import { useRef, useEffect } from 'react';
import { Bot, User } from 'lucide-react';

export interface ChatLogMessage {
  id: string;
  source: 'claude' | 'chad' | 'external';
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface Session {
  id: string;
  status: string;
}

interface ChatLogPanelProps {
  messages: ChatLogMessage[];
  streamingContent?: string;
  isSending?: boolean;
  session?: Session | null;
  onSummarize?: () => void;
  onEndSession?: () => void;
  isSummarizing?: boolean;
  onSendToClaudeTerminal?: (message: string) => void;
  onSendToChad?: (message: string) => void;
}

export function ChatLogPanel({
  messages,
  streamingContent = '',
  isSending = false,
  session,
  onSummarize,
  onEndSession,
  isSummarizing,
  onSendToClaudeTerminal,
  onSendToChad,
}: ChatLogPanelProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="h-full flex flex-col bg-gray-900">
      {/* Header */}
      <div className="px-3 py-2 bg-blue-900/30 border-b border-blue-800 flex items-center gap-2">
        <Bot className="w-4 h-4 text-blue-400" />
        <span className="text-blue-300 text-sm font-medium">External Claude</span>
        {isSending && (
          <span className="ml-auto text-xs text-blue-400 animate-pulse">typing...</span>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-auto p-3 space-y-3">
        {messages.length === 0 && !streamingContent ? (
          <div className="flex items-center justify-center h-full text-gray-500 text-sm">
            Watching External Claude activity...
          </div>
        ) : (
          <>
            {messages.map((msg) => (
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
