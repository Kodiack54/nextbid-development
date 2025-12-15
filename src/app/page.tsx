'use client';

import { useState, useEffect, useRef } from 'react';
import { DoorOpen } from 'lucide-react';

// Contexts & Hooks
import { useUser, useMinRole } from './contexts/UserContext';
import { useSession } from '../hooks/useSession';

// Dropdowns
import { ChatDropdown, TimeClockDropdown, SettingsDropdown, AITeamChat } from '../components/dropdowns';

// Panels
import {
  FilesPanel,
  TerminalPanel,
  AIUsagePanel,
  BrowserPanel,
  BrowserPreview,
  SchemaPanel,
  ChatLogPanel,
  SessionHubPanel,
  StorageMonitorPanel,
  ProjectManagerPanel,
  DocsPanel,
  ClaudeTerminal,
} from '../components/panels';
import ProjectManagementPanel from './project-management/ProjectManagementPanel';
import type { ChatLogMessage } from '../components/panels/ChatLogPanel';
import type { ConversationMessage } from '../components/panels/ClaudeTerminal';
// Claude uses Terminal (subscription), Chad uses API chat

// Hooks
import { useCatalogerWorker } from '../hooks/useCatalogerWorker';
import { useDocWorker } from '../hooks/useDocWorker';

// Modals
import { UnlockModal, SummaryModal, LogoutConfirmModal } from '../components/modals';

// UI Components
import { SidebarIcon, QuickButton, MessageContent, DraggableSidebar } from '../components/ui';
import type { SidebarItem } from '../components/ui';

// Icons
import { SupabaseLogo } from '../components/icons';

// Types
import { Project, Environment, PanelType, SessionSummary, ENVIRONMENTS } from '../types';

export default function DevEnvironmentPage() {
  const { user, isLoading: userLoading } = useUser();
  const hasAccess = useMinRole('engineer');

  // Session management
  const {
    session,
    messages: sessionMessages,
    isLoading: sessionLoading,
    startSession,
    addMessage,
    endSession,
    summarizeSession,
  } = useSession();

  // Cataloger worker - runs in background to process sessions
  const { status: catalogerStatus, triggerNow: triggerCataloger } = useCatalogerWorker({
    intervalMs: 60000,
    enabled: true,
  });

  // Doc Worker - runs every 5 minutes to auto-document conversations
  const { status: docWorkerStatus, triggerNow: triggerDocWorker, lastResult: docWorkerResult } = useDocWorker({
    intervalMs: 300000, // Run every 5 minutes
    enabled: true,
  });

  // State
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedEnv, setSelectedEnv] = useState<Environment>(ENVIRONMENTS[0]);
  const [activePanel, setActivePanel] = useState<PanelType>(null);
  const [isLocking, setIsLocking] = useState(false);
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [sessionSummary, setSessionSummary] = useState<SessionSummary | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);

  // Toggle between Claude (Sonnet) and Chad (Haiku)
  const [chatMode, setChatMode] = useState<'claude' | 'chad'>('claude');

  // Separate chat histories for each AI team member
  const [claudeMessages, setClaudeMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([
    { role: 'assistant', content: "Hey Boss! I'm Claude, your Lead Programmer.\n\nI handle the complex stuff - architecture, deep problem solving, thorough code reviews. I use Sonnet so I'm smarter but cost a bit more.\n\nWhat are we building today?" }
  ]);
  const [chadMessages, setChadMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([
    { role: 'assistant', content: "Yo! Chad here, Assistant Dev.\n\nI'm your quick helper - simple questions, fast fixes, looking stuff up. I run on GPT-4o-mini so I'm basically free (~$0.001/msg).\n\nWhat do you need?" }
  ]);

  // Get current messages based on active chat mode
  const messages = chatMode === 'claude' ? claudeMessages : chadMessages;
  const setMessages = chatMode === 'claude' ? setClaudeMessages : setChadMessages;

  // UI state
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [lastUsage, setLastUsage] = useState<{ input_tokens: number; output_tokens: number; cost_usd: number } | null>(null);

  // File attachments for chat
  const [attachedFiles, setAttachedFiles] = useState<Array<{ name: string; url: string; type: string; size: number }>>([]);
  const [isUploading, setIsUploading] = useState(false);
  const chatFileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Combined chat log for both Claude and Chad (separate conversations, Slack-style)
  const [chatLog, setChatLog] = useState<ChatLogMessage[]>([]);
  const [chatLogFloating, setChatLogFloating] = useState(false);

  // Handler to add messages to the combined log
  const addToChatLog = (message: ChatLogMessage) => {
    setChatLog(prev => [...prev, message]);
  };

  // AI Team Chat state
  const [claudeConnected, setClaudeConnected] = useState(false);
  const [claudeConversation, setClaudeConversation] = useState<ConversationMessage[]>([]);
  const [chadConversation, setChadConversation] = useState<ConversationMessage[]>([]);
  const [susanConversation, setSusanConversation] = useState<ConversationMessage[]>([]);
  const claudeSendRef = useRef<((message: string) => void) | null>(null);
  const claudeConnectRef = useRef<(() => void) | null>(null);

  // Handler for Claude conversation messages (from terminal)
  const handleClaudeConversation = (msg: ConversationMessage) => {
    setClaudeConversation(prev => [...prev, msg]);
  };

  // Handler for sending to Chad API
  const handleSendToChad = async (message: string): Promise<string> => {
    // Add user message
    const userMsg: ConversationMessage = {
      id: `chad-user-${Date.now()}`,
      user_id: 'me',
      user_name: 'You',
      content: message,
      created_at: new Date().toISOString(),
    };
    setChadConversation(prev => [...prev, userMsg]);

    try {
      // Call Chad API through proxy
      const response = await fetch('/api/chad/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          context: selectedProject?.server_path,
        }),
      });

      const data = await response.json();
      const reply = data.reply || 'Sorry, I had trouble processing that.';

      const assistantMsg: ConversationMessage = {
        id: `chad-assistant-${Date.now()}`,
        user_id: 'chad',
        user_name: 'Chad',
        content: reply,
        created_at: new Date().toISOString(),
      };
      setChadConversation(prev => [...prev, assistantMsg]);
      return reply;
    } catch (error) {
      console.error('Chad API error:', error);
      const errorMsg = 'Sorry, I\'m having connection issues. Try again?';
      const assistantMsg: ConversationMessage = {
        id: `chad-assistant-${Date.now()}`,
        user_id: 'chad',
        user_name: 'Chad',
        content: errorMsg,
        created_at: new Date().toISOString(),
      };
      setChadConversation(prev => [...prev, assistantMsg]);
      return errorMsg;
    }
  };

  // Handler for sending to Susan API
  const handleSendToSusan = async (message: string): Promise<string> => {
    // Add user message
    const userMsg: ConversationMessage = {
      id: `susan-user-${Date.now()}`,
      user_id: 'me',
      user_name: 'You',
      content: message,
      created_at: new Date().toISOString(),
    };
    setSusanConversation(prev => [...prev, userMsg]);

    try {
      // Call Susan API through proxy
      const response = await fetch('/api/susan/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          projectPath: selectedProject?.server_path,
        }),
      });

      const data = await response.json();
      const reply = data.reply || 'Sorry, I had trouble processing that.';

      const assistantMsg: ConversationMessage = {
        id: `susan-assistant-${Date.now()}`,
        user_id: 'susan',
        user_name: 'Susan',
        content: reply,
        created_at: new Date().toISOString(),
      };
      setSusanConversation(prev => [...prev, assistantMsg]);
      return reply;
    } catch (error) {
      console.error('Susan API error:', error);
      const errorMsg = 'Sorry, I\'m having connection issues. Try again?';
      const assistantMsg: ConversationMessage = {
        id: `susan-assistant-${Date.now()}`,
        user_id: 'susan',
        user_name: 'Susan',
        content: errorMsg,
        created_at: new Date().toISOString(),
      };
      setSusanConversation(prev => [...prev, assistantMsg]);
      return errorMsg;
    }
  };

  // Fetch projects on mount
  useEffect(() => {
    fetchProjects();
  }, []);

  // Auto-scroll chat to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  // Start session when user is available
  useEffect(() => {
    if (user?.id && !session && !sessionLoading) {
      startSession(user.id, selectedProject?.id);
    }
  }, [user?.id, session, sessionLoading, selectedProject?.id, startSession]);

  const handleSummarize = async () => {
    setIsSummarizing(true);
    const summary = await summarizeSession();
    if (summary) {
      setSessionSummary(summary);
      setShowSummaryModal(true);
    }
    setIsSummarizing(false);
  };

  const handleEndSession = async () => {
    await handleSummarize();
    await endSession();
    if (user?.id) {
      startSession(user.id, selectedProject?.id);
    }
  };

  const fetchProjects = async () => {
    try {
      const response = await fetch('/api/projects');
      const data = await response.json();
      if (data.success) {
        setProjects(data.projects);
        if (data.projects.length > 0 && !selectedProject) {
          setSelectedProject(data.projects[0]);
        }
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLockProject = async () => {
    if (!selectedProject || !user) return;
    setIsLocking(true);

    try {
      const response = await fetch('/api/locks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: selectedProject.id,
          user_id: user.id,
          branch: selectedEnv.id,
          purpose: 'Development',
          environment: selectedEnv.id,
        }),
      });

      const data = await response.json();
      if (data.success) {
        fetchProjects();
      } else {
        alert(data.error || 'Failed to lock project');
      }
    } catch (error) {
      console.error('Error locking project:', error);
    } finally {
      setIsLocking(false);
    }
  };

  // Handle attaching files to chat message
  const handleAttachFiles = async (files: FileList) => {
    if (!selectedProject) return;

    setIsUploading(true);
    const newAttachments: typeof attachedFiles = [];

    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('project_id', selectedProject.id);
        formData.append('folder', 'chat-attachments');

        const res = await fetch('/api/files', {
          method: 'POST',
          body: formData,
        });

        const data = await res.json();
        if (data.success) {
          newAttachments.push({
            name: file.name,
            url: data.file.url,
            type: file.type,
            size: file.size,
          });
        }
      }

      setAttachedFiles(prev => [...prev, ...newAttachments]);
    } catch (error) {
      console.error('Failed to upload attachments:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSendMessage = async () => {
    if ((!inputMessage.trim() && attachedFiles.length === 0) || isSending) return;

    // Build message content with attachments
    let userMessage = inputMessage.trim();
    if (attachedFiles.length > 0) {
      const attachmentText = attachedFiles.map(f => `[Attached: ${f.name}](${f.url})`).join('\n');
      userMessage = userMessage ? `${userMessage}\n\n${attachmentText}` : attachmentText;
    }

    // Add to the correct chat history based on mode
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setInputMessage('');
    setAttachedFiles([]);
    setIsSending(true);
    setStreamingContent('');

    // Add user message to chat log (for Chad)
    addToChatLog({
      id: `chad-user-${Date.now()}`,
      source: 'chad',
      role: 'user',
      content: userMessage,
      timestamp: new Date(),
    });

    try {
      const chatMessages = [...messages.slice(1), { role: 'user' as const, content: userMessage }];

      // Claude uses Sonnet (smarter), Chad uses GPT-4o-mini (20x cheaper!)
      const model = chatMode === 'claude' ? 'claude-sonnet-4-20250514' : 'gpt-4o-mini';

      // Different system prompts for Claude vs Chad - Kodiack AI Team
      const claudePrompt = `You are Claude, the LEAD PROGRAMMER at Kodiack Studios AI Team.

ROLE: Senior architect and problem solver. The boss calls on you for complex work.

PERSONALITY:
- Thoughtful and thorough - you think before you code
- Confident in your expertise but always learning
- You take ownership of problems and see them through
- You explain your reasoning so others can learn

APPROACH:
- Analyze the full picture before diving in
- Read actual code to understand context
- Consider edge cases and potential issues
- Write clean, maintainable code
- If requirements are unclear, ask for clarification

You have tools: read_file, write_file, list_files, search_files, query_database, run_command

Project: ${selectedProject?.server_path || '/var/www/NextBid_Dev/dev-studio-5000'}
User: The Boss`;

      const chadPrompt = `You are Chad, ASSISTANT DEVELOPER at Kodiack Studios AI Team.

ROLE: Quick helper for simple tasks. Fast, efficient, gets stuff done.

PERSONALITY:
- Chill and easy-going but focused
- No BS - you get straight to the point
- Happy to help with the quick stuff
- You know when to escalate to Claude for complex work

APPROACH:
- Be fast and concise
- Handle simple questions quickly
- Use tools to check actual code when needed
- If something seems complex, suggest asking Claude instead

You have tools: read_file, write_file, list_files, search_files, query_database, run_command

Project: ${selectedProject?.server_path || '/var/www/NextBid_Dev/dev-studio-5000'}
User: The Boss`;

      const systemPrompt = chatMode === 'claude' ? claudePrompt : chadPrompt;

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: chatMessages,
          user_id: user?.id,
          project_id: selectedProject?.id,
          model: model,
          system_prompt: systemPrompt,
          assistant_name: chatMode, // 'claude' or 'chad' for tracking
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Chat request failed');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let fullContent = '';
      let usageData: { input_tokens: number; output_tokens: number; cost_usd: number } | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === 'content') {
                fullContent += data.text;
                setStreamingContent(fullContent);
              } else if (data.type === 'done') {
                usageData = data.usage;
                setLastUsage(data.usage);
              } else if (data.type === 'error') {
                throw new Error(data.error);
              }
            } catch {
              // JSON parse error, skip
            }
          }
        }
      }

      // Add assistant response to the correct chat history
      setMessages(prev => [...prev, { role: 'assistant', content: fullContent }]);
      setStreamingContent('');

      // Add Chad's response to chat log
      addToChatLog({
        id: `chad-assistant-${Date.now()}`,
        source: 'chad',
        role: 'assistant',
        content: fullContent,
        timestamp: new Date(),
      });
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errContent = `Sorry, I encountered an error: ${errorMessage}\n\nPlease check that your Anthropic API key is configured in the .env file.`;
      setMessages(prev => [...prev, { role: 'assistant', content: errContent }]);
    } finally {
      setIsSending(false);
    }
  };

  // Loading state
  if (userLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <div className="text-center">
          <div className="animate-spin text-4xl mb-4">⚙️</div>
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  // No user - show login redirect
  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-8 text-center max-w-md">
          <div className="text-5xl mb-4">🔐</div>
          <h2 className="text-xl font-semibold text-white mb-2">Authentication Required</h2>
          <p className="text-gray-400 mb-4">Please access the Dev Environment through the Dashboard.</p>
          <a
            href="http://localhost:7500"
            className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
          >
            Go to Dashboard
          </a>
        </div>
      </div>
    );
  }

  // Access check
  if (!hasAccess) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <div className="bg-gray-800 border border-red-500/50 rounded-xl p-8 text-center max-w-md">
          <div className="text-5xl mb-4">🔒</div>
          <h2 className="text-xl font-semibold text-white mb-2">Access Restricted</h2>
          <p className="text-gray-400">Engineer+ access required for the Dev Environment.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-900">
      {/* Top Bar */}
      <div className="h-14 bg-gray-800 border-b border-gray-700 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🛠️</span>
          <div>
            <div className="font-semibold text-white">Dev Environment</div>
            <div className="text-xs text-gray-500">NextBid AI Coding</div>
          </div>
        </div>

        {/* Deploy Pipeline */}
        <div className="flex items-center gap-2">
          <button className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg flex items-center gap-1">
            <span>↓</span> Pull
          </button>
          <span className="text-gray-500">→</span>
          <div className="px-3 py-1.5 bg-blue-600/20 border border-blue-500/50 rounded-lg text-blue-400 text-sm font-medium">
            DEV
          </div>
          <span className="text-gray-500">→</span>
          <div className="px-3 py-1.5 bg-yellow-600/20 border border-yellow-500/50 rounded-lg text-yellow-400 text-sm font-medium">
            TEST
          </div>
          <span className="text-gray-500">→</span>
          <div className="px-3 py-1.5 bg-green-600/20 border border-green-500/50 rounded-lg text-green-400 text-sm font-medium">
            PROD
          </div>
          <span className="text-gray-500">→</span>
          <button className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg flex items-center gap-1">
            <span>↑</span> Push + Notes
          </button>
        </div>

        <div className="flex items-center space-x-2">
          <div className="flex items-center gap-2 pr-2 border-r border-gray-700">
            <span className="text-sm text-gray-400">{user.name}</span>
            <span className="text-xs px-2 py-1 bg-blue-600/20 text-blue-400 rounded">{user.role}</span>
          </div>

          <AITeamChat
            onSendToClaudeTerminal={(msg) => claudeSendRef.current?.(msg)}
            onConnectClaude={() => claudeConnectRef.current?.()}
            claudeConnected={claudeConnected}
            claudeMessages={claudeConversation}
            onSendToChad={handleSendToChad}
            chadMessages={chadConversation}
            onSendToSusan={handleSendToSusan}
            susanMessages={susanConversation}
            userId={user?.id}
            userName={user?.name}
          />
          <ChatDropdown />
          <TimeClockDropdown />
          <SettingsDropdown />
          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center hover:bg-blue-700 transition-colors"
            title="Logout"
          >
            <DoorOpen className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <LogoutConfirmModal
          onClose={() => setShowLogoutConfirm(false)}
          onConfirm={() => window.location.href = 'http://localhost:7500'}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - Draggable */}
        <div className="w-14 bg-gray-800 border-r border-gray-700 flex flex-col items-center py-2">
          <DraggableSidebar
            items={[
              { id: 'files', icon: '📁', label: 'Files' },
              { id: 'terminal', icon: '💻', label: 'Terminal' },
              { id: 'ai-usage', icon: '💰', label: 'AI Usage' },
              { id: 'browser', icon: '🌐', label: 'Browser' },
              { id: 'schema', icon: <SupabaseLogo />, label: 'DB Schema' },
              { id: 'chatlog', icon: '📜', label: 'Chat Log' },
              { id: 'hub', icon: '🎯', label: 'Session Hub' },
              { id: 'storage', icon: '💾', label: 'Storage' },
              { id: 'projects', icon: '⚙️', label: 'Projects' },
              { id: 'docs', icon: '📝', label: 'Docs' },
            ]}
            activePanel={activePanel}
            onPanelChange={(panel) => setActivePanel(panel as typeof activePanel)}
          />

          <div className="flex-1" />

          {selectedProject?.is_locked && (
            <div className="text-2xl" title={`Locked by ${selectedProject.lock?.locked_by_name}`}>
              🔒
            </div>
          )}
        </div>

        {/* Pop-out Panel - Overlay */}
        {activePanel && (
          <div className={`absolute left-14 top-14 bottom-0 ${activePanel === "projects" || activePanel === "docs" ? "w-[600px]" : "w-72"} bg-gray-850 border-r border-gray-700 flex flex-col z-40 shadow-xl`}>
            <div className="px-3 py-2 border-b border-gray-700 flex items-center justify-between">
              <span className="text-sm font-medium text-white flex items-center gap-2">
                {activePanel === 'files' && '📁 File Manager'}
                {activePanel === 'terminal' && '💻 Terminal'}
                {activePanel === 'ai-usage' && '💰 AI Usage'}
                {activePanel === 'browser' && '🌐 Virtual Browser'}
                {activePanel === 'schema' && <><SupabaseLogo /> DB Schema</>}
                {activePanel === 'chatlog' && '📜 Chat Log'}
                {activePanel === 'hub' && '🎯 Session Hub'}
                {activePanel === 'projects' && '📋 Project Manager'}
                {activePanel === 'storage' && '💾 Storage Monitor'}
              </span>
              <button onClick={() => setActivePanel(null)} className="text-gray-500 hover:text-white">
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-auto p-3">
              {activePanel === 'files' && <FilesPanel project={selectedProject} />}
              {activePanel === 'terminal' && <TerminalPanel project={selectedProject} env={selectedEnv} />}
              {activePanel === 'ai-usage' && <AIUsagePanel />}
              {activePanel === 'browser' && <BrowserPanel />}
              {activePanel === 'schema' && <div id="schema-panel-slot" />}
              {activePanel === 'chatlog' && (
                <ChatLogPanel
                  messages={chatLog}
                  streamingContent={streamingContent}
                  isSending={isSending}
                  session={session}
                  onSummarize={handleSummarize}
                  onEndSession={handleEndSession}
                  isSummarizing={isSummarizing}
                  onSendToClaudeTerminal={(msg) => claudeSendRef.current?.(msg)}
                  onSendToChad={handleSendToChad}
                />
              )}
              {activePanel === 'hub' && (
                <SessionHubPanel
                  projectId={selectedProject?.id || null}
                  userId={user?.id || null}
                  workerStatus={catalogerStatus}
                  onTriggerWorker={triggerCataloger}
                />
              )}
              {activePanel === 'storage' && <StorageMonitorPanel />}
              {activePanel === 'projects' && <ProjectManagerPanel onProjectsChange={fetchProjects} />}
              {activePanel === 'docs' && <DocsPanel workerStatus={docWorkerStatus} onTriggerWorker={triggerDocWorker} />}
            </div>
          </div>
        )}

        {/* Schema panel always mounted so popups persist - renders into slot when panel open */}
        <SchemaPanel project={selectedProject} isOpen={activePanel === 'schema'} />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {activePanel === 'projects' ? (
            /* Project Management View */
            <div className="flex-1 flex flex-col overflow-hidden bg-gray-900 p-4">
              <ProjectManagementPanel onProjectsChange={fetchProjects} />
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
                <div className="flex items-center gap-3">
                  <select
                    value={selectedProject?.id || ''}
                    onChange={(e) => {
                      const project = projects.find(p => p.id === e.target.value);
                      setSelectedProject(project || null);
                    }}
                    className="w-48 bg-gray-700 border border-gray-600 rounded-lg px-3 py-1.5 text-white text-sm"
                  >
                    {projects.map(project => (
                      <option key={project.id} value={project.id}>
                        {project.is_locked ? '🔒 ' : ''}{project.name}
                      </option>
                    ))}
                  </select>

                  <select
                    value={selectedEnv.id}
                    onChange={(e) => {
                      const env = ENVIRONMENTS.find(env => env.id === e.target.value);
                      if (env) setSelectedEnv(env);
                    }}
                    className="w-48 bg-gray-700 border border-gray-600 rounded-lg px-3 py-1.5 text-white text-sm"
                  >
                    {ENVIRONMENTS.map(env => (
                      <option key={env.id} value={env.id}>
                        {env.name} {env.readOnly ? '(Read Only)' : ''}
                      </option>
                    ))}
                  </select>

                  <div className="flex gap-1 ml-2 border-l border-gray-600 pl-3">
                    <QuickButton label="Explain" onClick={() => setInputMessage('Explain this code')} />
                    <QuickButton label="Review" onClick={() => setInputMessage('Review this code for bugs')} />
                    <QuickButton label="Refactor" onClick={() => setInputMessage('Refactor this code')} />
                    <QuickButton label="Document" onClick={() => setInputMessage('Add documentation')} />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {selectedProject?.is_locked ? (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-yellow-400">
                        🔒 Locked by {selectedProject.lock?.locked_by_name}
                      </span>
                      <button
                        onClick={() => setShowUnlockModal(true)}
                        className="px-3 py-1.5 bg-yellow-600 hover:bg-yellow-700 text-white text-sm rounded-lg"
                      >
                        Unlock
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={handleLockProject}
                      disabled={isLocking}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg disabled:opacity-50"
                    >
                      {isLocking ? 'Locking...' : '🔓 Lock Project'}
                    </button>
                  )}
                </div>
              </div>

              {/* Main Area - Browser + Chat */}
              <div className="flex-1 flex overflow-hidden">
                {/* Browser Preview - 2/3 */}
                <div className="flex-[2] min-w-0 flex flex-col border-r border-gray-700 bg-gray-900">
                  <BrowserPreview project={selectedProject} env={selectedEnv} userId={user?.id} />
                </div>

                {/* Claude Code Terminal - 1/3 */}
                <div className="flex-1 min-w-0 max-w-lg flex flex-col bg-gray-850">
                  <ClaudeTerminal
                    sendRef={claudeSendRef}
                    connectRef={claudeConnectRef}
                    onConversationMessage={handleClaudeConversation}
                    onConnectionChange={setClaudeConnected}
                  />
                </div>
              </div>
            </>
          )}

          {/* Unlock Modal */}
          {showUnlockModal && (
            <UnlockModal
              project={selectedProject}
              userId={user?.id}
              onClose={() => setShowUnlockModal(false)}
              onUnlock={() => {
                setShowUnlockModal(false);
                fetchProjects();
              }}
            />
          )}

          {/* Session Summary Modal */}
          {showSummaryModal && sessionSummary && (
            <SummaryModal
              summary={sessionSummary}
              onClose={() => setShowSummaryModal(false)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
