'use client';

import { useState, useRef, useEffect } from 'react';
import { FileText, Save, Move, Minimize2, Maximize2, Bot } from 'lucide-react';

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
  session: Session | null;
  onSummarize: () => void;
  onEndSession: () => void;
  isSummarizing: boolean;
  floating?: boolean;
  onToggleFloating?: () => void;
  onSendToClaudeTerminal?: (message: string) => void;
}

export function ChatLogPanel({
  messages,
  streamingContent = '',
  isSending = false,
  session,
  onSummarize,
  onEndSession,
  isSummarizing,
  floating = false,
  onToggleFloating,
  onSendToClaudeTerminal,
}: ChatLogPanelProps) {
  const [position, setPosition] = useState({ x: 100, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isMinimized, setIsMinimized] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!floating) return;
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
  };

  useEffect(() => {
    if (!isDragging) return;
    const handleMouseMove = (e: MouseEvent) => {
      setPosition({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y,
      });
    };
    const handleMouseUp = () => setIsDragging(false);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  const panelContent = (
    <>
      {/* Header */}
      <div
        className={`px-3 py-2 border-b border-blue-900/50 bg-[#0a1628] flex items-center justify-between ${floating ? 'cursor-move' : ''}`}
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center gap-2">
          {floating && <Move size={12} className="text-gray-500" />}
          <Bot className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-medium text-blue-400">External Claude</span>
          <span className="text-xs text-blue-400/60">[{messages.length} msgs]</span>
          {session && (
            <span className="text-xs text-green-400 bg-green-900/30 px-1.5 py-0.5 rounded ml-2">
              Active
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {floating && (
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white"
              title={isMinimized ? 'Expand' : 'Minimize'}
            >
              {isMinimized ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
            </button>
          )}
          {onToggleFloating && (
            <button
              onClick={onToggleFloating}
              className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white"
              title={floating ? 'Dock panel' : 'Float panel'}
            >
              <Move size={14} />
            </button>
          )}
          <button
            onClick={onSummarize}
            disabled={isSummarizing || messages.length < 2}
            className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white disabled:opacity-50"
            title="Summarize Session"
          >
            {isSummarizing ? (
              <span className="animate-spin text-xs">⏳</span>
            ) : (
              <FileText size={14} />
            )}
          </button>
          <button
            onClick={onEndSession}
            disabled={!session || messages.length < 2}
            className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-blue-400 disabled:opacity-50"
            title="End Session & Summarize"
          >
            <Save size={14} />
          </button>
        </div>
      </div>

      {/* Messages */}
      {!isMinimized && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-auto p-2 space-y-2">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`text-xs p-2 rounded border-l-2 ${
                  msg.role === 'user'
                    ? 'bg-green-900/20 border-green-500'
                    : 'bg-blue-900/20 border-blue-500'
                }`}
              >
                <div className={`font-medium mb-1 flex items-center gap-2 ${
                  msg.role === 'user' ? 'text-green-400' : 'text-blue-400'
                }`}>
                  <span>{msg.role === 'user' ? '👤 User' : '🤖 Claude'}</span>
                  <span className="text-gray-600 text-[10px]">
                    {msg.timestamp.toLocaleTimeString()}
                  </span>
                </div>
                <div className="text-gray-300 whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed">
                  {msg.content}
                </div>
              </div>
            ))}

            {isSending && streamingContent && (
              <div className="text-xs p-2 rounded bg-blue-900/20 border-l-2 border-blue-400">
                <div className="font-medium mb-1 text-blue-300">🤖 Claude</div>
                <div className="text-gray-300 font-mono text-[11px]">
                  {streamingContent}
                  <span className="inline-block w-1 h-3 bg-blue-500 animate-pulse ml-1" />
                </div>
              </div>
            )}

            {messages.length === 0 && !streamingContent && (
              <div className="text-xs text-gray-600 text-center py-8">
                Watching External Claude activity...
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-2 border-t border-gray-700 bg-gray-800/50">
            <div className="flex gap-1">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && inputValue.trim() && onSendToClaudeTerminal) {
                    onSendToClaudeTerminal(inputValue.trim());
                    setInputValue('');
                  }
                }}
                placeholder="Send to External Claude..."
                className="flex-1 bg-gray-900 border border-gray-600 rounded px-2 py-1 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
              <button
                onClick={() => {
                  if (inputValue.trim() && onSendToClaudeTerminal) {
                    onSendToClaudeTerminal(inputValue.trim());
                    setInputValue('');
                  }
                }}
                disabled={!inputValue.trim() || !onSendToClaudeTerminal}
                className="px-2 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded text-xs"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );

  if (floating) {
    return (
      <div
        ref={panelRef}
        className="fixed z-50 bg-gray-900 border border-blue-600 rounded-lg shadow-2xl flex flex-col"
        style={{
          left: position.x,
          top: position.y,
          width: isMinimized ? '200px' : '400px',
          height: isMinimized ? 'auto' : '400px',
          maxHeight: '80vh',
        }}
      >
        {panelContent}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full -m-3">
      {panelContent}
    </div>
  );
}
