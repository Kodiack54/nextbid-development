'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { MessageCircle, Send, Hash, X, Code, Circle, GripHorizontal, Minimize2, Maximize2 } from 'lucide-react';

interface ChatMessage {
  id: string;
  channel_id: string;
  user_id: string;
  user_name: string;
  user_avatar?: string;
  content: string;
  created_at: string;
  is_code?: boolean;
}

interface ChatChannel {
  id: string;
  name: string;
  type: 'channel' | 'dm';
  description?: string;
  unread_count: number;
  last_message?: string;
  participants?: string[];
  isAI?: boolean;
  aiType?: 'claude' | 'chad' | 'susan';
}

// AI Worker URLs
const DEV_DROPLET = '161.35.229.220';
const CHAD_URL = `http://${DEV_DROPLET}:5401`;
const SUSAN_URL = `http://${DEV_DROPLET}:5403`;

const MIN_WIDTH = 450;
const MIN_HEIGHT = 400;
const DEFAULT_WIDTH = 600;
const DEFAULT_HEIGHT = 550;

interface ChatDropdownProps {
  // AI Team callbacks
  onSendToClaudeTerminal?: (message: string) => void;
  claudeConnected?: boolean;
  claudeMessages?: ChatMessage[];  // Conversation messages from Claude terminal
}

export default function ChatDropdown({
  onSendToClaudeTerminal,
  claudeConnected = false,
  claudeMessages = [],
}: ChatDropdownProps = {}) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeChannel, setActiveChannel] = useState<ChatChannel | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isCodeMode, setIsCodeMode] = useState(false);
  const [unreadTotal, setUnreadTotal] = useState(0);

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

  const dropdownRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Mock channels - TODO: Load from dev_chat_channels
  const [channels, setChannels] = useState<ChatChannel[]>([
    { id: '1', name: 'general', type: 'channel', description: 'General team discussion', unread_count: 2 },
    { id: '2', name: 'dev-updates', type: 'channel', description: 'Development updates & announcements', unread_count: 0 },
    { id: '3', name: 'code-review', type: 'channel', description: 'Code snippets and reviews', unread_count: 1 },
    { id: '4', name: 'deployments', type: 'channel', description: 'Deployment coordination', unread_count: 0 },
  ]);

  // AI Team members
  const aiTeam: ChatChannel[] = [
    {
      id: 'dm-claude',
      name: 'Claude',
      type: 'dm',
      description: '👨‍💻 Lead Programmer (5400)',
      unread_count: 0,
      isAI: true,
      aiType: 'claude',
    },
    {
      id: 'dm-chad',
      name: 'Chad',
      type: 'dm',
      description: '📝 Transcriber (5401)',
      unread_count: 0,
      isAI: true,
      aiType: 'chad',
    },
    {
      id: 'dm-susan',
      name: 'Susan',
      type: 'dm',
      description: '📚 Librarian (5403)',
      unread_count: 0,
      isAI: true,
      aiType: 'susan',
    },
  ];

  const [aiLoading, setAiLoading] = useState(false);

  const [directMessages, setDirectMessages] = useState<ChatChannel[]>([
    { id: 'dm1', name: 'Michael', type: 'dm', unread_count: 1, participants: ['Michael'] },
    { id: 'dm2', name: 'Dev Team', type: 'dm', unread_count: 0, participants: ['Dev Team'] },
  ]);

  useEffect(() => {
    const channelUnread = channels.reduce((sum, ch) => sum + ch.unread_count, 0);
    const dmUnread = directMessages.reduce((sum, dm) => sum + dm.unread_count, 0);
    setUnreadTotal(channelUnread + dmUnread);
  }, [channels, directMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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

      // Keep within viewport bounds
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

  // Resize handlers
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    if (isMaximized) return;
    setIsResizing(true);
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: size.width,
      height: size.height
    });
    e.preventDefault();
    e.stopPropagation();
  }, [size, isMaximized]);

  // Toggle maximize
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
      // Position near the button (top right area)
      setPosition({
        x: window.innerWidth - size.width - 20,
        y: 80
      });
    }
  }, [isOpen, position.x, position.y, size.width]);

  function loadChannelMessages(channel: ChatChannel) {
    setActiveChannel(channel);
    if (channel.type === 'channel') {
      setChannels(prev => prev.map(ch =>
        ch.id === channel.id ? { ...ch, unread_count: 0 } : ch
      ));
    } else {
      setDirectMessages(prev => prev.map(dm =>
        dm.id === channel.id ? { ...dm, unread_count: 0 } : dm
      ));
    }

    const now = new Date();
    setMessages([
      {
        id: '1',
        channel_id: channel.id,
        user_id: 'michael',
        user_name: 'Michael',
        content: 'Hey team, just pushed the new tradelines update',
        created_at: new Date(now.getTime() - 3600000).toISOString()
      },
      {
        id: '2',
        channel_id: channel.id,
        user_id: 'dev',
        user_name: 'Dev',
        content: 'Nice! I\'ll run the tests on it',
        created_at: new Date(now.getTime() - 3500000).toISOString()
      },
      {
        id: '3',
        channel_id: channel.id,
        user_id: 'michael',
        user_name: 'Michael',
        content: 'Here\'s the code snippet for the API endpoint:',
        created_at: new Date(now.getTime() - 3400000).toISOString()
      },
      {
        id: '4',
        channel_id: channel.id,
        user_id: 'michael',
        user_name: 'Michael',
        content: `async function fetchTradelines(userId: string) {\n  const response = await fetch('/api/tradelines/' + userId);\n  return response.json();\n}`,
        created_at: new Date(now.getTime() - 3300000).toISOString(),
        is_code: true
      },
      {
        id: '5',
        channel_id: channel.id,
        user_id: 'dev',
        user_name: 'Dev',
        content: 'Looks good! I\'ll integrate it into the portal',
        created_at: new Date(now.getTime() - 600000).toISOString()
      },
    ]);
  }

  async function sendMessage() {
    if (!newMessage.trim() || !activeChannel) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      channel_id: activeChannel.id,
      user_id: 'me',
      user_name: 'You',
      content: newMessage,
      created_at: new Date().toISOString(),
      is_code: isCodeMode
    };

    setMessages(prev => [...prev, userMessage]);
    const messageToSend = newMessage;
    setNewMessage('');
    setIsCodeMode(false);

    // Handle AI team members
    if (activeChannel.isAI) {
      if (activeChannel.aiType === 'claude') {
        // Route to Claude terminal
        onSendToClaudeTerminal?.(messageToSend);
      } else if (activeChannel.aiType === 'chad' || activeChannel.aiType === 'susan') {
        // Chat with Chad or Susan
        setAiLoading(true);
        try {
          const apiUrl = activeChannel.aiType === 'chad' ? CHAD_URL : SUSAN_URL;
          const response = await fetch(`${apiUrl}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: messageToSend })
          });

          if (response.ok) {
            const data = await response.json();
            const aiReply: ChatMessage = {
              id: `${activeChannel.aiType}-${Date.now()}`,
              channel_id: activeChannel.id,
              user_id: activeChannel.aiType,
              user_name: activeChannel.name,
              content: data.reply,
              created_at: new Date().toISOString()
            };
            setMessages(prev => [...prev, aiReply]);
          } else {
            const errorReply: ChatMessage = {
              id: `error-${Date.now()}`,
              channel_id: activeChannel.id,
              user_id: activeChannel.aiType || 'error',
              user_name: activeChannel.name,
              content: `Sorry, I couldn't process that. (${response.status})`,
              created_at: new Date().toISOString()
            };
            setMessages(prev => [...prev, errorReply]);
          }
        } catch (err) {
          const errorReply: ChatMessage = {
            id: `error-${Date.now()}`,
            channel_id: activeChannel.id,
            user_id: activeChannel.aiType || 'error',
            user_name: activeChannel.name,
            content: `I'm not available right now. Check if my service is running on port ${activeChannel.aiType === 'chad' ? '5401' : '5403'}.`,
            created_at: new Date().toISOString()
          };
          setMessages(prev => [...prev, errorReply]);
        } finally {
          setAiLoading(false);
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

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Chat Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-10 h-10 bg-gray-700 text-white rounded-xl flex items-center justify-center hover:bg-gray-600 transition-colors relative"
        title="Team Chat"
      >
        <MessageCircle className="w-5 h-5" />
        {unreadTotal > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
            {unreadTotal > 9 ? '9+' : unreadTotal}
          </span>
        )}
      </button>

      {/* Chat Panel - Fixed position, draggable and resizable */}
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
          {/* Title Bar - Draggable */}
          <div
            className="flex items-center justify-between px-3 py-2 bg-gray-900 border-b border-gray-700 cursor-grab select-none"
            onMouseDown={handleMouseDown}
          >
            <div className="flex items-center gap-2">
              <GripHorizontal className="w-4 h-4 text-gray-500" />
              <h3 className="text-white font-semibold text-sm">Dev Chat</h3>
              <span className="text-gray-500 text-xs">Team messaging</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={toggleMaximize}
                className="p-1.5 rounded hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
                title={isMaximized ? 'Restore' : 'Maximize'}
              >
                {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded hover:bg-red-600 text-gray-400 hover:text-white transition-colors"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex" style={{ height: size.height - 44 }}>
            {/* Left Sidebar - Channels */}
            <div className="w-48 bg-gray-900 border-r border-gray-700 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto">
                {/* AI Team Section */}
                <div className="p-2">
                  <p className="text-purple-400 text-xs font-semibold uppercase px-2 mb-1">🤖 AI Team</p>
                  {aiTeam.map(ai => (
                    <button
                      key={ai.id}
                      onClick={() => {
                        setActiveChannel(ai);
                        setMessages([]);
                      }}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-sm transition-colors ${
                        activeChannel?.id === ai.id
                          ? 'bg-purple-600 text-white'
                          : 'text-gray-300 hover:bg-gray-800'
                      }`}
                    >
                      <Circle className={`w-3 h-3 flex-shrink-0 ${
                        ai.aiType === 'claude'
                          ? (claudeConnected ? 'fill-green-500 text-green-500' : 'fill-gray-500 text-gray-500')
                          : 'fill-green-500 text-green-500'
                      }`} />
                      <span className="truncate flex-1">{ai.name}</span>
                    </button>
                  ))}
                </div>

                <div className="p-2">
                  <p className="text-gray-500 text-xs font-semibold uppercase px-2 mb-1">Channels</p>
                  {channels.map(channel => (
                    <button
                      key={channel.id}
                      onClick={() => loadChannelMessages(channel)}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-sm transition-colors ${
                        activeChannel?.id === channel.id
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-300 hover:bg-gray-800'
                      }`}
                    >
                      <Hash className="w-4 h-4 flex-shrink-0" />
                      <span className="truncate flex-1">{channel.name}</span>
                      {channel.unread_count > 0 && (
                        <span className="w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                          {channel.unread_count}
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                <div className="p-2">
                  <p className="text-gray-500 text-xs font-semibold uppercase px-2 mb-1">Direct Messages</p>
                  {directMessages.map(dm => (
                    <button
                      key={dm.id}
                      onClick={() => loadChannelMessages(dm)}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-sm transition-colors ${
                        activeChannel?.id === dm.id
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-300 hover:bg-gray-800'
                      }`}
                    >
                      <Circle className="w-3 h-3 fill-green-500 text-green-500 flex-shrink-0" />
                      <span className="truncate flex-1">{dm.name}</span>
                      {dm.unread_count > 0 && (
                        <span className="w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                          {dm.unread_count}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Right - Messages Area */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {activeChannel ? (
                <>
                  {/* Channel Header */}
                  <div className="px-4 py-2 border-b border-gray-700 flex items-center justify-between flex-shrink-0">
                    <div className="flex items-center gap-2">
                      {activeChannel.type === 'channel' ? (
                        <Hash className="w-5 h-5 text-gray-400" />
                      ) : (
                        <Circle className="w-4 h-4 fill-green-500 text-green-500" />
                      )}
                      <div>
                        <p className="text-white font-medium">{activeChannel.name}</p>
                        {activeChannel.description && (
                          <p className="text-gray-500 text-xs">{activeChannel.description}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {messages.map(msg => (
                      <div key={msg.id} className={`flex gap-3 ${msg.user_id === 'me' ? 'flex-row-reverse' : ''}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 ${
                          msg.user_id === 'me' ? 'bg-blue-600' : 'bg-purple-600'
                        }`}>
                          {msg.user_name.charAt(0)}
                        </div>
                        <div className={`flex-1 min-w-0 ${msg.user_id === 'me' ? 'text-right' : ''}`}>
                          <div className={`flex items-center gap-2 ${msg.user_id === 'me' ? 'justify-end' : ''}`}>
                            <span className="text-white text-sm font-medium">{msg.user_name}</span>
                            <span className="text-gray-500 text-xs">{formatTime(msg.created_at)}</span>
                          </div>
                          {msg.is_code ? (
                            <div className="relative mt-1">
                              <pre className="bg-gray-900 rounded-lg p-3 text-sm text-green-400 overflow-x-auto font-mono whitespace-pre-wrap break-all">
                                {msg.content}
                              </pre>
                              <button
                                onClick={() => copyToClipboard(msg.content)}
                                className="absolute top-2 right-2 text-gray-500 hover:text-white text-xs px-2 py-1 bg-gray-800 rounded"
                              >
                                Copy
                              </button>
                            </div>
                          ) : (
                            <p className={`text-gray-300 text-sm mt-0.5 break-words ${
                              msg.user_id === 'me' ? 'bg-blue-600/20 inline-block px-3 py-1.5 rounded-lg' : ''
                            }`}>
                              {msg.content}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Message Input */}
                  <div className="p-3 border-t border-gray-700 flex-shrink-0">
                    {aiLoading && (
                      <div className="flex items-center gap-2 text-purple-400 text-xs mb-2">
                        <div className="animate-spin w-3 h-3 border-2 border-purple-400 border-t-transparent rounded-full" />
                        <span>{activeChannel.name} is thinking...</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setIsCodeMode(!isCodeMode)}
                        className={`p-2 rounded-lg transition-colors ${
                          isCodeMode ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-400 hover:text-white'
                        }`}
                        title="Code mode"
                      >
                        <Code className="w-4 h-4" />
                      </button>
                      <div className="flex-1 relative">
                        {isCodeMode ? (
                          <textarea
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            placeholder="Paste code here..."
                            className="w-full bg-gray-900 text-green-400 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-mono resize-none"
                            rows={5}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && e.ctrlKey) {
                                sendMessage();
                              }
                            }}
                          />
                        ) : (
                          <textarea
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            placeholder={activeChannel.isAI
                              ? `Message ${activeChannel.name}... ${activeChannel.description || ''}`
                              : `Message #${activeChannel.name}`
                            }
                            className="w-full bg-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                            rows={3}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                sendMessage();
                              }
                            }}
                          />
                        )}
                      </div>
                      <button
                        onClick={sendMessage}
                        disabled={!newMessage.trim() || aiLoading}
                        className={`p-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                          activeChannel.isAI ? 'bg-purple-600 hover:bg-purple-700' : 'bg-blue-600 hover:bg-blue-700'
                        } text-white`}
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </div>
                    {isCodeMode && (
                      <p className="text-gray-500 text-xs mt-1">Press Ctrl+Enter to send code</p>
                    )}
                    {!isCodeMode && (
                      <p className="text-gray-500 text-xs mt-1">Press Enter to send, Shift+Enter for new line</p>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-gray-500">
                  <div className="text-center">
                    <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">Select a channel to start chatting</p>
                  </div>
                </div>
              )}
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
