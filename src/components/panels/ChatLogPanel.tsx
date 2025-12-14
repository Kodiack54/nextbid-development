'use client';

import { useState, useRef, useEffect } from 'react';
import { FileText, Save, Move, Minimize2, Maximize2 } from 'lucide-react';

// Unified message format for both Claude and Chad
export interface ChatLogMessage {
  id: string;
  source: 'claude' | 'chad';
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
  // For floating mode
  floating?: boolean;
  onToggleFloating?: () => void;
  // Chat handlers for sending messages
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
  floating = false,
  onToggleFloating,
  onSendToClaudeTerminal,
  onSendToChad,
}: ChatLogPanelProps) {
  const [position, setPosition] = useState({ x: 100, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isMinimized, setIsMinimized] = useState(false);
  const [claudeInput, setClaudeInput] = useState('');
  const [chadInput, setChadInput] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const claudeEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  // Dragging handlers
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

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  // Source colors and labels
  const getSourceStyle = (source: 'claude' | 'chad', role: 'user' | 'assistant') => {
    if (role === 'user') {
      return {
        bg: source === 'claude' ? 'bg-orange-900/30' : 'bg-blue-900/30',
        border: source === 'claude' ? 'border-orange-500' : 'border-blue-500',
        label: source === 'claude' ? 'text-orange-400' : 'text-blue-400',
        name: 'You',
      };
    }
    return {
      bg: source === 'claude' ? 'bg-orange-900/20' : 'bg-blue-900/20',
      border: source === 'claude' ? 'border-orange-400' : 'border-blue-400',
      label: source === 'claude' ? 'text-orange-300' : 'text-blue-300',
      name: source === 'claude' ? '👨‍💻 Claude' : '🧑‍💻 Chad',
    };
  };

  // Separate messages by source
  const claudeMessages = messages.filter(m => m.source === 'claude');
  const chadMessages = messages.filter(m => m.source === 'chad');

  const panelContent = (
    <>
      {/* Header with actions */}
      <div
        className={`px-3 py-2 border-b border-gray-700 flex items-center justify-between ${floating ? 'cursor-move' : ''}`}
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center gap-2">
          {floating && <Move size={12} className="text-gray-500" />}
          <span className="text-xs text-orange-400">{claudeMessages.length} Claude</span>
          <span className="text-xs text-gray-600">|</span>
          <span className="text-xs text-blue-400">{chadMessages.length} Chad</span>
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
            className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-orange-400 disabled:opacity-50"
            title="End Session & Summarize"
          >
            <Save size={14} />
          </button>
        </div>
      </div>

      {/* Two-column layout for separate conversations */}
      {!isMinimized && (
        <div className="flex-1 flex overflow-hidden">
          {/* Claude Column */}
          <div className="flex-1 flex flex-col border-r border-gray-700">
            <div className="px-2 py-1 bg-orange-900/20 border-b border-gray-700">
              <span className="text-xs font-medium text-orange-400">👨‍💻 Claude - Lead</span>
            </div>
            <div className="flex-1 overflow-auto p-2 space-y-2">
              {claudeMessages.map((msg) => {
                const style = getSourceStyle(msg.source, msg.role);
                return (
                  <div
                    key={msg.id}
                    className={`text-xs p-2 rounded ${style.bg} border-l-2 ${style.border}`}
                  >
                    <div className={`font-medium mb-1 ${style.label} flex items-center gap-2`}>
                      <span>{msg.role === 'user' ? 'You' : 'Claude'}</span>
                      <span className="text-gray-600 text-[10px]">
                        {msg.timestamp.toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="text-gray-300 whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed">
                      {msg.content}
                    </div>
                  </div>
                );
              })}
              {claudeMessages.length === 0 && (
                <div className="text-xs text-gray-600 text-center py-4">
                  Connect to Claude terminal to see messages
                </div>
              )}
              <div ref={claudeEndRef} />
            </div>
            {/* Claude uses terminal input - show hint */}
            <div className="p-2 border-t border-gray-700 bg-gray-800/30 text-center">
              <span className="text-[10px] text-gray-500">Use terminal input below →</span>
            </div>
          </div>

          {/* Chad Column */}
          <div className="flex-1 flex flex-col">
            <div className="px-2 py-1 bg-blue-900/20 border-b border-gray-700">
              <span className="text-xs font-medium text-blue-400">🧑‍💻 Chad - Assistant</span>
            </div>
            <div className="flex-1 overflow-auto p-2 space-y-2">
              {chadMessages.map((msg) => {
                const style = getSourceStyle(msg.source, msg.role);
                return (
                  <div
                    key={msg.id}
                    className={`text-xs p-2 rounded ${style.bg} border-l-2 ${style.border}`}
                  >
                    <div className={`font-medium mb-1 ${style.label} flex items-center gap-2`}>
                      <span>{msg.role === 'user' ? 'You' : 'Chad'}</span>
                      <span className="text-gray-600 text-[10px]">
                        {msg.timestamp.toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="text-gray-300 whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed">
                      {msg.content}
                    </div>
                  </div>
                );
              })}

              {isSending && streamingContent && (
                <div className="text-xs p-2 rounded bg-blue-900/20 border-l-2 border-blue-400">
                  <div className="font-medium mb-1 text-blue-300">Chad</div>
                  <div className="text-gray-300 font-mono text-[11px]">
                    {streamingContent}
                    <span className="inline-block w-1 h-3 bg-blue-500 animate-pulse ml-1" />
                  </div>
                </div>
              )}

              {chadMessages.length === 0 && !streamingContent && (
                <div className="text-xs text-gray-600 text-center py-4">
                  Chat with Chad to see messages
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>
        </div>
      )}
    </>
  );

  // Floating mode - draggable overlay (wide enough for 2 columns like Slack)
  if (floating) {
    return (
      <div
        ref={panelRef}
        className="fixed z-50 bg-gray-900 border border-gray-600 rounded-lg shadow-2xl flex flex-col"
        style={{
          left: position.x,
          top: position.y,
          width: isMinimized ? '200px' : '700px',
          height: isMinimized ? 'auto' : '500px',
          maxHeight: '80vh',
        }}
      >
        {panelContent}
      </div>
    );
  }

  // Docked mode - normal sidebar panel
  return (
    <div className="flex flex-col h-full -m-3">
      {panelContent}
    </div>
  );
}
