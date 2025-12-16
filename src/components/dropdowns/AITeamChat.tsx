'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Bot, Send, X, GripHorizontal, Minimize2, Maximize2, Terminal, Zap, StickyNote, Copy, Check, Plus, Trash2 } from 'lucide-react';

interface ChatMessage {
  id: string;
  user_id: string;
  user_name: string;
  content: string;
  created_at: string;
}

type AITeamMember = 'ryan' | 'chad' | 'susan' | 'mike' | 'tiffany' | 'clair';

interface NotepadTab {
  id: string;
  name: string;
  content: string;
}

interface AITeamChatProps {
  // Claude terminal integration
  onSendToClaudeTerminal?: (message: string) => void;
  onConnectClaude?: () => void; // Trigger Claude connect when clicking his name
  claudeConnected?: boolean;
  claudeMessages?: ChatMessage[];
  // External Claude Code (MCP) connection status
  externalClaudeConnected?: boolean;
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
const NOTEPAD_WIDTH = 1100; // Extra wide for notepad mode

export default function AITeamChat({
  onSendToClaudeTerminal,
  onConnectClaude,
  claudeConnected = false,
  claudeMessages = [],
  externalClaudeConnected = false,
  onSendToChad,
  chadMessages = [],
  onSendToSusan,
  susanMessages = [],
  userId,
  userName = 'Boss',
}: AITeamChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeMember, setActiveMember] = useState<AITeamMember>('chad');
  const [newMessage, setNewMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  // Notepad state
  const [showNotepad, setShowNotepad] = useState(false);
  const [activeNotepadTab, setActiveNotepadTab] = useState(0);
  const [notepadTabs, setNotepadTabs] = useState<NotepadTab[]>([
    { id: '1', name: 'Quick Commands', content: '' },
    { id: '2', name: 'Notes', content: '' },
    { id: '3', name: 'Snippets', content: '' },
    { id: '4', name: 'Scratch', content: '' },
  ]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingTabId, setEditingTabId] = useState<string | null>(null);

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
  // Only Chad and Susan have real message stores - others are placeholders for now
  const messages = activeMember === 'chad'
    ? chadMessages
    : activeMember === 'susan'
      ? susanMessages
      : []; // Ryan, Mike, Tiffany, Clair don't have messages yet

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Load notepad from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('ai-team-notepad');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setNotepadTabs(parsed);
        }
      } catch (e) {
        console.error('Failed to load notepad:', e);
      }
    }
  }, []);

  // Save notepad to localStorage
  useEffect(() => {
    localStorage.setItem('ai-team-notepad', JSON.stringify(notepadTabs));
  }, [notepadTabs]);

  // Auto-expand width when notepad is shown
  useEffect(() => {
    if (showNotepad && !isMaximized) {
      setSize(prev => ({
        ...prev,
        width: Math.max(prev.width, NOTEPAD_WIDTH)
      }));
    }
  }, [showNotepad, isMaximized]);

  // Notepad functions
  const updateNotepadContent = (content: string) => {
    setNotepadTabs(tabs =>
      tabs.map((tab, i) =>
        i === activeNotepadTab ? { ...tab, content } : tab
      )
    );
  };

  const updateTabName = (id: string, name: string) => {
    setNotepadTabs(tabs =>
      tabs.map(tab => tab.id === id ? { ...tab, name } : tab)
    );
    setEditingTabId(null);
  };

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

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

    if (activeMember === 'chad') {
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
    // Ryan, Mike, Tiffany, Clair - messages logged for Chad to relay later
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

                {/* Ryan - Project Manager */}
                <button
                  onClick={() => setActiveMember('ryan')}
                  className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg text-left text-sm transition-colors ${
                    activeMember === 'ryan'
                      ? 'bg-orange-600 text-white'
                      : 'text-gray-300 hover:bg-gray-800'
                  }`}
                >
                  <div className="relative text-xl">
                    👨‍💼
                    <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-gray-500 border-2 border-gray-900" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="block truncate font-medium">Ryan</span>
                    <span className="block truncate text-xs opacity-60">Project Mgr</span>
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

                {/* Mike */}
                <button
                  onClick={() => setActiveMember('mike')}
                  className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg text-left text-sm transition-colors mt-1 ${
                    activeMember === 'mike'
                      ? 'bg-teal-600 text-white'
                      : 'text-gray-300 hover:bg-gray-800'
                  }`}
                >
                  <div className="relative text-xl">
                    👷
                    <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-gray-500 border-2 border-gray-900" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="block truncate font-medium">Mike</span>
                    <span className="block truncate text-xs opacity-60">Port 5405</span>
                  </div>
                </button>

                {/* Tiffany */}
                <button
                  onClick={() => setActiveMember('tiffany')}
                  className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg text-left text-sm transition-colors mt-1 ${
                    activeMember === 'tiffany'
                      ? 'bg-pink-600 text-white'
                      : 'text-gray-300 hover:bg-gray-800'
                  }`}
                >
                  <div className="relative text-xl">
                    👩‍🎨
                    <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-gray-500 border-2 border-gray-900" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="block truncate font-medium">Tiffany</span>
                    <span className="block truncate text-xs opacity-60">Port 5404</span>
                  </div>
                </button>

                {/* Clair */}
                <button
                  onClick={() => setActiveMember('clair')}
                  className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg text-left text-sm transition-colors mt-1 ${
                    activeMember === 'clair'
                      ? 'bg-indigo-600 text-white'
                      : 'text-gray-300 hover:bg-gray-800'
                  }`}
                >
                  <div className="relative text-xl">
                    📋
                    <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-gray-900" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="block truncate font-medium">Clair</span>
                    <span className="block truncate text-xs opacity-60">Doc Manager</span>
                  </div>
                </button>

                {/* Notepad Toggle */}
                <div className="border-t border-gray-700 mt-2 pt-2">
                  <button
                    onClick={() => setShowNotepad(!showNotepad)}
                    className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg text-left text-sm transition-colors ${
                      showNotepad
                        ? 'bg-yellow-600 text-white'
                        : 'text-gray-300 hover:bg-gray-800'
                    }`}
                  >
                    <StickyNote className="w-5 h-5" />
                    <div className="flex-1 min-w-0">
                      <span className="block truncate font-medium">Notepad</span>
                      <span className="block truncate text-xs opacity-60">Quick snippets</span>
                    </div>
                  </button>
                </div>
              </div>

              {/* Info footer */}
              <div className="mt-auto p-2 border-t border-gray-700">
                <div className="text-xs text-gray-500 px-2">
                  <div>👤 {userName}</div>
                  <div className="mt-1 text-[10px]">
                    {(activeMember === 'chad' || activeMember === 'susan')
                      ? '💰 ~$0.001/msg'
                      : '💬 Relayed by Chad'
                    }
                  </div>
                </div>
              </div>
            </div>

            {/* Right - Messages Area or Notepad */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Header - Different for Notepad vs Chat */}
              {showNotepad ? (
                <div className="px-4 py-2 border-b border-gray-700 flex items-center justify-between flex-shrink-0">
                  <div className="flex items-center gap-3">
                    <StickyNote className="w-5 h-5 text-yellow-400" />
                    <div>
                      <p className="text-white font-medium">Quick Notepad</p>
                      <p className="text-gray-500 text-xs">Copy/paste snippets - saved locally</p>
                    </div>
                  </div>
                  <button
                    onClick={() => copyToClipboard(notepadTabs[activeNotepadTab].content, notepadTabs[activeNotepadTab].id)}
                    className="flex items-center gap-1.5 px-2 py-1 text-xs rounded bg-gray-700 hover:bg-gray-600 text-gray-300"
                    title="Copy all content"
                  >
                    {copiedId === notepadTabs[activeNotepadTab].id ? (
                      <><Check className="w-3 h-3 text-green-400" /> Copied</>
                    ) : (
                      <><Copy className="w-3 h-3" /> Copy All</>
                    )}
                  </button>
                </div>
              ) : (
                <div className="px-4 py-2 border-b border-gray-700 flex items-center gap-3 flex-shrink-0">
                {activeMember === 'ryan' && (
                  <>
                    <span className="text-2xl">👨‍💼</span>
                    <div>
                      <p className="text-white font-medium">Ryan</p>
                      <p className="text-gray-500 text-xs">Project Manager - Coming soon</p>
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
                {activeMember === 'mike' && (
                  <>
                    <span className="text-2xl">👷</span>
                    <div>
                      <p className="text-white font-medium">Mike</p>
                      <p className="text-gray-500 text-xs">Port 5405 - Coming soon</p>
                    </div>
                  </>
                )}
                {activeMember === 'tiffany' && (
                  <>
                    <span className="text-2xl">👩‍🎨</span>
                    <div>
                      <p className="text-white font-medium">Tiffany</p>
                      <p className="text-gray-500 text-xs">Port 5404 - Coming soon</p>
                    </div>
                  </>
                )}
                {activeMember === 'clair' && (
                  <>
                    <span className="text-2xl">📋</span>
                    <div>
                      <p className="text-white font-medium">Clair</p>
                      <p className="text-gray-500 text-xs">Doc Manager - Manages documentation</p>
                    </div>
                  </>
                )}
              </div>
              )}

              {/* Content Area - Messages or Notepad */}
              {showNotepad ? (
                <>
                  {/* Notepad Tabs */}
                  <div className="flex border-b border-gray-700 overflow-x-auto flex-shrink-0">
                    {notepadTabs.map((tab, index) => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveNotepadTab(index)}
                        onDoubleClick={() => setEditingTabId(tab.id)}
                        className={`px-3 py-2 text-sm whitespace-nowrap border-b-2 transition-colors ${
                          activeNotepadTab === index
                            ? 'border-yellow-500 text-yellow-400 bg-gray-800/50'
                            : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-gray-800/30'
                        }`}
                      >
                        {editingTabId === tab.id ? (
                          <input
                            type="text"
                            defaultValue={tab.name}
                            autoFocus
                            className="bg-gray-700 text-white px-1 py-0.5 text-sm rounded w-24 outline-none"
                            onBlur={(e) => updateTabName(tab.id, e.target.value || 'Untitled')}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                updateTabName(tab.id, e.currentTarget.value || 'Untitled');
                              }
                              if (e.key === 'Escape') {
                                setEditingTabId(null);
                              }
                            }}
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : (
                          tab.name
                        )}
                      </button>
                    ))}
                  </div>

                  {/* Notepad Content */}
                  <div className="flex-1 p-3 overflow-hidden">
                    <textarea
                      value={notepadTabs[activeNotepadTab].content}
                      onChange={(e) => updateNotepadContent(e.target.value)}
                      placeholder="Paste commands, snippets, or notes here...

Double-click a tab to rename it.
Click 'Copy All' to copy contents to clipboard.

Example:
pm2 logs dev-studio-5000 --lines 5
git pull && npm run build && pm2 restart dev-studio-5000"
                      className="w-full h-full bg-gray-900 text-gray-100 rounded-lg p-3 text-sm font-mono resize-none outline-none border border-gray-700 focus:border-yellow-500"
                      spellCheck={false}
                    />
                  </div>

                  {/* Notepad Footer */}
                  <div className="px-3 pb-3 text-xs text-gray-500 flex items-center justify-between">
                    <span>
                      {notepadTabs[activeNotepadTab].content.length} characters
                      {notepadTabs[activeNotepadTab].content.split('\n').length > 1 &&
                        ` • ${notepadTabs[activeNotepadTab].content.split('\n').length} lines`}
                    </span>
                    <span>Auto-saved locally</span>
                  </div>
                </>
              ) : (
                <>
                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-3">
                    {messages.length === 0 && (
                      <div className="text-center text-gray-500 py-8">
                        <div className="text-3xl mb-2">
                          {activeMember === 'ryan' ? '👨‍💼' :
                           activeMember === 'chad' ? '🧑‍💻' :
                           activeMember === 'susan' ? '👩‍💼' :
                           activeMember === 'mike' ? '👷' :
                           activeMember === 'tiffany' ? '👩‍🎨' : '📋'}
                        </div>
                        <p className="text-sm">
                          {activeMember === 'chad'
                            ? 'Chad is ready for quick tasks!'
                            : activeMember === 'susan'
                              ? 'Susan is ready to help organize knowledge!'
                              : `${activeMember.charAt(0).toUpperCase() + activeMember.slice(1)} - Coming soon! Messages will be relayed by Chad.`
                          }
                        </p>
                      </div>
                    )}

                    {messages.map(msg => {
                      const isUser = msg.user_id === 'me' || msg.user_id === userId;
                      return (
                        <div key={msg.id} className="flex gap-3 overflow-hidden">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-lg flex-shrink-0 ${
                            isUser
                              ? 'bg-gray-600'
                              : activeMember === 'ryan'
                                ? 'bg-orange-900/50'
                                : activeMember === 'chad'
                                  ? 'bg-blue-900/50'
                                  : activeMember === 'susan'
                                    ? 'bg-purple-900/50'
                                    : activeMember === 'mike'
                                      ? 'bg-teal-900/50'
                                      : activeMember === 'tiffany'
                                        ? 'bg-pink-900/50'
                                        : 'bg-indigo-900/50'
                          }`}>
                            {isUser
                              ? '👤'
                              : activeMember === 'ryan'
                                ? '👨‍💼'
                                : activeMember === 'chad'
                                  ? '🧑‍💻'
                                  : activeMember === 'susan'
                                    ? '👩‍💼'
                                    : activeMember === 'mike'
                                      ? '👷'
                                      : activeMember === 'tiffany'
                                        ? '👩‍🎨'
                                        : '📋'
                            }
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-white text-sm font-medium">{msg.user_name}</span>
                              <span className="text-gray-500 text-xs">{formatTime(msg.created_at)}</span>
                            </div>
                            <div className="text-gray-300 text-sm mt-0.5 break-all overflow-hidden" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}>
                              {/* Check if entire message is a box/banner - render as one block */}
                              {msg.content.includes('╭') && msg.content.includes('╯') ? (
                                <pre className="font-mono text-xs text-cyan-400 whitespace-pre leading-tight">{msg.content}</pre>
                              ) : msg.content.split('\n').map((line, i) => {
                                // Handle box-drawing / ASCII art (render in monospace)
                                if (/[│├└┌┐┘┬┴┼─═║╔╗╚╝╠╣╦╩╬┃┏┓┗┛┣┫┳┻╋╮╰╯▐▛▜▝▘]/.test(line)) {
                                  return <pre key={i} className="font-mono text-xs text-cyan-400 whitespace-pre">{line}</pre>;
                                }
                                // Handle bullet points
                                if (line.trim().startsWith('- ') || line.trim().startsWith('• ') || line.trim().startsWith('● ')) {
                                  return <div key={i} className="ml-2 flex gap-1"><span className="text-gray-500">•</span><span>{line.replace(/^[\s]*[-•●]\s*/, '')}</span></div>;
                                }
                                // Handle numbered items
                                if (/^\s*\d+[.)]\s/.test(line)) {
                                  const match = line.match(/^(\s*)(\d+[.)])\s*(.*)$/);
                                  if (match) {
                                    return <div key={i} className="ml-2 flex gap-1"><span className="text-blue-400 font-medium">{match[2]}</span><span>{match[3]}</span></div>;
                                  }
                                }
                                // Handle code blocks (lines starting with spaces/tabs or backticks)
                                if (line.startsWith('```') || line.startsWith('    ') || line.startsWith('\t')) {
                                  return <code key={i} className="block bg-gray-800 px-2 py-0.5 rounded text-xs font-mono text-green-400">{line.replace(/^```\w*/, '').replace(/```$/, '')}</code>;
                                }
                                // Empty lines become visible spacing
                                if (line.trim() === '') {
                                  return <div key={i} className="h-4" />;
                                }
                                // Regular text - ensure wrapping
                                return <div key={i} className="break-words" style={{ wordBreak: 'break-word' }}>{line}</div>;
                              })}
                            </div>
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
                      <textarea
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onPaste={(e) => {
                          // Ensure paste works properly
                          const pastedText = e.clipboardData.getData('text');
                          const target = e.target as HTMLTextAreaElement;
                          const start = target.selectionStart;
                          const end = target.selectionEnd;
                          const currentVal = target.value;
                          const newValue = currentVal.slice(0, start) + pastedText + currentVal.slice(end);

                          // Update DOM directly
                          target.value = newValue;
                          setNewMessage(newValue);
                          // Set cursor position
                          const newCursorPos = start + pastedText.length;
                          setTimeout(() => target.setSelectionRange(newCursorPos, newCursorPos), 0);
                          e.preventDefault();
                        }}
                        placeholder={
                          activeMember === 'chad'
                            ? 'Message Chad...'
                            : activeMember === 'susan'
                              ? 'Message Susan...'
                              : `Message ${activeMember.charAt(0).toUpperCase() + activeMember.slice(1)}... (Chad will relay)`
                        }
                        disabled={false}
                        rows={4}
                        className={`flex-1 bg-gray-700 text-white rounded-lg px-3 py-2 text-sm outline-none disabled:opacity-50 focus:ring-2 resize-y min-h-[80px] ${
                          activeMember === 'ryan'
                            ? 'focus:ring-orange-500'
                            : activeMember === 'chad'
                              ? 'focus:ring-blue-500'
                              : activeMember === 'susan'
                                ? 'focus:ring-purple-500'
                                : activeMember === 'mike'
                                  ? 'focus:ring-teal-500'
                                  : activeMember === 'tiffany'
                                    ? 'focus:ring-pink-500'
                                    : 'focus:ring-indigo-500'
                        }`}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            sendMessage();
                          }
                        }}
                      />
                      <button
                        onClick={sendMessage}
                        disabled={!newMessage.trim()}
                        className={`p-2 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                          activeMember === 'ryan'
                            ? 'bg-orange-600 hover:bg-orange-700'
                            : activeMember === 'chad'
                              ? 'bg-blue-600 hover:bg-blue-700'
                              : activeMember === 'susan'
                                ? 'bg-purple-600 hover:bg-purple-700'
                                : activeMember === 'mike'
                                  ? 'bg-teal-600 hover:bg-teal-700'
                                  : activeMember === 'tiffany'
                                    ? 'bg-pink-600 hover:bg-pink-700'
                                    : 'bg-indigo-600 hover:bg-indigo-700'
                        }`}
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </>
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
