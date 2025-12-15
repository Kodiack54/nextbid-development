'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Bot, Send, X, GripHorizontal, Minimize2, Maximize2, Terminal, Zap } from 'lucide-react';

interface ChatMessage {
  id: string;
  user_id: string;
  user_name: string;
  content: string;
  created_at: string;
}

type AITeamMember = 'claude' | 'chad' | 'susan';

interface AITeamChatProps {
  // Claude terminal integration
  onSendToClaudeTerminal?: (message: string) => void;
  onConnectClaude?: () => void; // Trigger Claude connect when clicking his name
  claudeConnected?: boolean;
  claudeMessages?: ChatMessage[];
  // Chad API integration
  onSendToChad?: (message: string) => Promise<string>;
  chadMessages?: ChatMessage[];
  // Susan API integration (Librarian)
  onSendToSusan?: (message: string) => Promise<string>;
  susanMessages?: ChatMessage[];
  // User context
  userId?: string;
  userName?: string;
}

// Optimal sizing for AI Team Chat - wider for readability
const MIN_WIDTH = 600;
const MIN_HEIGHT = 500;
const DEFAULT_WIDTH = 900;
const DEFAULT_HEIGHT = 650;

export default function AITeamChat({
  onSendToClaudeTerminal,
  onConnectClaude,
  claudeConnected = false,
  claudeMessages = [],
  onSendToChad,
  chadMessages = [],
  onSendToSusan,
  susanMessages = [],
  userId,
  userName = 'Boss',
}: AITeamChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeMember, setActiveMember] = useState<AITeamMember>('claude');
  const [newMessage, setNewMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  // Dragging state
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Resizing state
  const [size, setSize] = useState({ width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT });
  const [isResizing, setIsResizing] = useState(false);
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [isMaximized, setIsMaximized] = useState(false);
  const [preMaxSize, setPreMaxSize] = useState({ width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT, x: 0, y: 0 });

  const panelRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Get current messages based on active member
  const messages = activeMember === 'claude'
    ? claudeMessages
    : activeMember === 'chad'
      ? chadMessages
      : susanMessages;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Drag handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (isMaximized) return;
    setIsDragging(true);
    const rect = panelRef.current?.getBoundingClientRect();
    if (rect) {
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
    }
    e.preventDefault();
  }, [isMaximized]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging) {
      const newX = e.clientX - dragOffset.x;
      const newY = e.clientY - dragOffset.y;
      const maxX = window.innerWidth - size.width;
      const maxY = window.innerHeight - size.height;
      setPosition({
        x: Math.max(0, Math.min(newX, maxX)),
        y: Math.max(0, Math.min(newY, maxY))
      });
    }
    if (isResizing) {
      const deltaX = e.clientX - resizeStart.x;
      const deltaY = e.clientY - resizeStart.y;
      setSize({
        width: Math.max(MIN_WIDTH, resizeStart.width + deltaX),
        height: Math.max(MIN_HEIGHT, resizeStart.height + deltaY)
      });
    }
  }, [isDragging, isResizing, dragOffset, resizeStart, size.width, size.height]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setIsResizing(false);
  }, []);

  useEffect(() => {
    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, isResizing, handleMouseMove, handleMouseUp]);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    if (isMaximized) return;
    setIsResizing(true);
    setResizeStart({ x: e.clientX, y: e.clientY, width: size.width, height: size.height });
    e.preventDefault();
    e.stopPropagation();
  }, [size, isMaximized]);

  const toggleMaximize = () => {
    if (isMaximized) {
      setSize({ width: preMaxSize.width, height: preMaxSize.height });
      setPosition({ x: preMaxSize.x, y: preMaxSize.y });
      setIsMaximized(false);
    } else {
      setPreMaxSize({ ...size, ...position });
      setSize({ width: window.innerWidth - 100, height: window.innerHeight - 100 });
      setPosition({ x: 50, y: 50 });
      setIsMaximized(true);
    }
  };

  // Initialize position when opening
  useEffect(() => {
    if (isOpen && position.x === 0 && position.y === 0) {
      setPosition({
        x: window.innerWidth - size.width - 80,
        y: 80
      });
    }
  }, [isOpen, position.x, position.y, size.width]);

  async function sendMessage() {
    if (!newMessage.trim()) return;

    const messageContent = newMessage.trim();
    setNewMessage('');

    if (activeMember === 'claude') {
      // Send to Claude terminal
      if (onSendToClaudeTerminal) {
        onSendToClaudeTerminal(messageContent);
      }
    } else if (activeMember === 'chad') {
      // Send to Chad API
      if (onSendToChad) {
        setIsTyping(true);
        try {
          await onSendToChad(messageContent);
        } finally {
          setIsTyping(false);
        }
      }
    } else if (activeMember === 'susan') {
      // Send to Susan API (Librarian)
      if (onSendToSusan) {
        setIsTyping(true);
        try {
          await onSendToSusan(messageContent);
        } finally {
          setIsTyping(false);
        }
      }
    }
  }

  function formatTime(dateStr: string) {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return date.toLocaleDateString();
  }

  return (
    <div className="relative">
      {/* AI Team Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors relative ${
          isOpen ? 'bg-orange-600 text-white' : 'bg-gray-700 text-white hover:bg-gray-600'
        }`}
        title="AI Team Chat"
      >
        <Bot className="w-5 h-5" />
        {claudeConnected && (
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-gray-800" />
        )}
      </button>

      {/* Chat Panel */}
      {isOpen && (
        <div
          ref={panelRef}
          className="fixed bg-gray-800 rounded-xl shadow-2xl border border-gray-700 overflow-hidden z-[100]"
          style={{
            width: size.width,
            height: size.height,
            left: position.x,
            top: position.y,
            cursor: isDragging ? 'grabbing' : 'default'
          }}
        >
          {/* Title Bar */}
          <div
            className="flex items-center justify-between px-3 py-2 bg-gray-900 border-b border-gray-700 cursor-grab select-none"
            onMouseDown={handleMouseDown}
          >
            <div className="flex items-center gap-2">
              <GripHorizontal className="w-4 h-4 text-gray-500" />
              <h3 className="text-white font-semibold text-sm">AI Team</h3>
              <span className={`text-xs px-1.5 py-0.5 rounded ${
                claudeConnected ? 'bg-green-900/50 text-green-400' : 'bg-gray-700 text-gray-400'
              }`}>
                {claudeConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={toggleMaximize}
                className="p-1.5 rounded hover:bg-gray-700 text-gray-400 hover:text-white"
                title={isMaximized ? 'Restore' : 'Maximize'}
              >
                {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded hover:bg-red-600 text-gray-400 hover:text-white"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex" style={{ height: size.height - 44 }}>
            {/* Left Sidebar - AI Team Members */}
            <div className="w-36 bg-gray-900 border-r border-gray-700 flex flex-col">
              <div className="p-2">
                <p className="text-gray-500 text-xs font-semibold uppercase px-2 mb-1">AI Team</p>

                {/* Claude - green when online, grey when offline. Click to connect if offline */}
                <button
                  onClick={() => {
                    setActiveMember('claude');
                    // If Claude is offline and we have a connect handler, trigger it
                    if (!claudeConnected && onConnectClaude) {
                      onConnectClaude();
                    }
                  }}
                  className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg text-left text-sm transition-colors ${
                    activeMember === 'claude'
                      ? claudeConnected
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-600 text-white'
                      : 'text-gray-300 hover:bg-gray-800'
                  }`}
                  title={claudeConnected ? 'Claude is online' : 'Click to connect Claude'}
                >
                  <div className="relative text-xl">
                    👨‍💻
                    <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-gray-900 ${
                      claudeConnected ? 'bg-green-500' : 'bg-gray-500'
                    }`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="block truncate font-medium">Claude</span>
                    <span className="block truncate text-xs opacity-60">{claudeConnected ? 'Online' : 'Click to connect'}</span>
                  </div>
                </button>

                {/* Chad */}
                <button
                  onClick={() => setActiveMember('chad')}
                  className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg text-left text-sm transition-colors mt-1 ${
                    activeMember === 'chad'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-300 hover:bg-gray-800'
                  }`}
                >
                  <div className="relative text-xl">
                    🧑‍💻
                    <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-gray-900" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="block truncate font-medium">Chad</span>
                    <span className="block truncate text-xs opacity-60">Assistant</span>
                  </div>
                </button>

                {/* Susan */}
                <button
                  onClick={() => setActiveMember('susan')}
                  className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg text-left text-sm transition-colors mt-1 ${
                    activeMember === 'susan'
                      ? 'bg-purple-600 text-white'
                      : 'text-gray-300 hover:bg-gray-800'
                  }`}
                >
                  <div className="relative text-xl">
                    👩‍💼
                    <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-gray-900" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="block truncate font-medium">Susan</span>
                    <span className="block truncate text-xs opacity-60">Librarian</span>
                  </div>
                </button>
              </div>

              {/* Info footer */}
              <div className="mt-auto p-2 border-t border-gray-700">
                <div className="text-xs text-gray-500 px-2">
                  <div>👤 {userName}</div>
                  <div className="mt-1 text-[10px]">
                    {activeMember === 'claude'
                      ? '💰 Uses subscription'
                      : activeMember === 'chad'
                        ? '💰 ~$0.001/msg'
                        : '💰 ~$0.001/msg'
                    }
                  </div>
                </div>
              </div>
            </div>

            {/* Right - Messages Area */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Member Header */}
              <div className="px-4 py-2 border-b border-gray-700 flex items-center gap-3 flex-shrink-0">
                {activeMember === 'claude' && (
                  <>
                    <span className="text-2xl">👨‍💻</span>
                    <div>
                      <p className="text-white font-medium">Claude</p>
                      <p className="text-gray-500 text-xs">Lead Programmer - Terminal ($200/mo sub)</p>
                    </div>
                  </>
                )}
                {activeMember === 'chad' && (
                  <>
                    <span className="text-2xl">🧑‍💻</span>
                    <div>
                      <p className="text-white font-medium">Chad</p>
                      <p className="text-gray-500 text-xs">Assistant Dev - Quick tasks & transcription</p>
                    </div>
                  </>
                )}
                {activeMember === 'susan' && (
                  <>
                    <span className="text-2xl">👩‍💼</span>
                    <div>
                      <p className="text-white font-medium">Susan</p>
                      <p className="text-gray-500 text-xs">Librarian - Catalogs knowledge & asks questions</p>
                    </div>
                  </>
                )}
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 && (
                  <div className="text-center text-gray-500 py-8">
                    <div className="text-3xl mb-2">
                      {activeMember === 'claude' ? '👨‍💻' : activeMember === 'chad' ? '🧑‍💻' : '👩‍💼'}
                    </div>
                    <p className="text-sm">
                      {activeMember === 'claude'
                        ? claudeConnected
                          ? 'Claude is ready. Send a message!'
                          : 'Connect to Claude terminal first'
                        : activeMember === 'chad'
                          ? 'Chad is ready for quick tasks!'
                          : 'Susan is ready to help organize knowledge!'
                      }
                    </p>
                  </div>
                )}

                {messages.map(msg => {
                  const isUser = msg.user_id === 'me' || msg.user_id === userId;
                  return (
                    <div key={msg.id} className="flex gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-lg flex-shrink-0 ${
                        isUser
                          ? 'bg-gray-600'
                          : activeMember === 'claude'
                            ? 'bg-orange-900/50'
                            : activeMember === 'chad'
                              ? 'bg-blue-900/50'
                              : 'bg-purple-900/50'
                      }`}>
                        {isUser
                          ? '👤'
                          : activeMember === 'claude'
                            ? '👨‍💻'
                            : activeMember === 'chad'
                              ? '🧑‍💻'
                              : '👩‍💼'
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-white text-sm font-medium">{msg.user_name}</span>
                          <span className="text-gray-500 text-xs">{formatTime(msg.created_at)}</span>
                        </div>
                        <p className="text-gray-300 text-sm mt-0.5 break-words">
                          {msg.content}
                        </p>
                      </div>
                    </div>
                  );
                })}

                {isTyping && (
                  <div className="flex gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-lg ${
                      activeMember === 'chad' ? 'bg-blue-900/50' : 'bg-purple-900/50'
                    }`}>
                      {activeMember === 'chad' ? '🧑‍💻' : '👩‍💼'}
                    </div>
                    <div className={`px-3 py-2 rounded-lg ${
                      activeMember === 'chad' ? 'bg-blue-900/30' : 'bg-purple-900/30'
                    }`}>
                      <div className="flex gap-1">
                        <span className={`w-2 h-2 rounded-full animate-bounce ${
                          activeMember === 'chad' ? 'bg-blue-400' : 'bg-purple-400'
                        }`} style={{ animationDelay: '0ms' }} />
                        <span className={`w-2 h-2 rounded-full animate-bounce ${
                          activeMember === 'chad' ? 'bg-blue-400' : 'bg-purple-400'
                        }`} style={{ animationDelay: '150ms' }} />
                        <span className={`w-2 h-2 rounded-full animate-bounce ${
                          activeMember === 'chad' ? 'bg-blue-400' : 'bg-purple-400'
                        }`} style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Message Input */}
              <div className="p-3 border-t border-gray-700 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder={
                      activeMember === 'claude'
                        ? claudeConnected ? 'Message Claude...' : 'Connect terminal first'
                        : activeMember === 'chad'
                          ? 'Message Chad...'
                          : 'Message Susan...'
                    }
                    disabled={activeMember === 'claude' && !claudeConnected}
                    className={`flex-1 bg-gray-700 text-white rounded-lg px-3 py-2 text-sm outline-none disabled:opacity-50 focus:ring-2 ${
                      activeMember === 'claude'
                        ? 'focus:ring-orange-500'
                        : activeMember === 'chad'
                          ? 'focus:ring-blue-500'
                          : 'focus:ring-purple-500'
                    }`}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        sendMessage();
                      }
                    }}
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!newMessage.trim() || (activeMember === 'claude' && !claudeConnected)}
                    className={`p-2 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                      activeMember === 'claude'
                        ? 'bg-orange-600 hover:bg-orange-700'
                        : activeMember === 'chad'
                          ? 'bg-blue-600 hover:bg-blue-700'
                          : 'bg-purple-600 hover:bg-purple-700'
                    }`}
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Resize Handle */}
          {!isMaximized && (
            <div
              className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize"
              onMouseDown={handleResizeStart}
              style={{
                background: 'linear-gradient(135deg, transparent 50%, #4B5563 50%)',
                borderBottomRightRadius: '0.75rem'
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}
