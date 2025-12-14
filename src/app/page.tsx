'use client';

import { useState, useEffect, useRef } from 'react';
import { useUser, useMinRole } from './contexts/UserContext';
import { DoorOpen } from 'lucide-react';
import ChatDropdown from '../components/ChatDropdown';
import TimeClockDropdown from '../components/TimeClockDropdown';
import SettingsDropdown from '../components/SettingsDropdown';

// Types
interface Project {
  id: string;
  name: string;
  slug: string;
  description: string;
  droplet_name: string;
  droplet_ip: string;
  server_path: string;
  port_dev: number;
  port_test: number;
  port_prod: number;
  is_locked: boolean;
  table_prefix?: string;
  database_schema?: Record<string, { columns: string[]; types: Record<string, string> }>;
  lock?: {
    locked_by_name: string;
    locked_at: string;
    purpose: string;
  };
}

interface Environment {
  id: string;
  name: string;
  portKey: 'port_dev' | 'port_test' | 'port_prod';
  readOnly?: boolean;
}

const ENVIRONMENTS: Environment[] = [
  { id: 'dev', name: 'Development', portKey: 'port_dev' },
  { id: 'test', name: 'Test', portKey: 'port_test' },
  { id: 'prod', name: 'Production', portKey: 'port_prod', readOnly: true },
];

// Pop-out panel types
type PanelType = 'files' | 'terminal' | 'ai-usage' | 'browser' | 'schema' | null;

export default function DevEnvironmentPage() {
  const { user, isLoading: userLoading } = useUser();
  const hasAccess = useMinRole('engineer');

  // State
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedEnv, setSelectedEnv] = useState<Environment>(ENVIRONMENTS[0]);
  const [activePanel, setActivePanel] = useState<PanelType>(null);
  const [isLocking, setIsLocking] = useState(false);
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Chat state
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([
    { role: 'assistant', content: 'Hello! I\'m Claude, your AI coding assistant. Select a project to get started, then ask me anything about your code.' }
  ]);

  // Logout confirmation
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [lastUsage, setLastUsage] = useState<{ input_tokens: number; output_tokens: number; cost_usd: number } | null>(null);

  // Fetch projects on mount
  useEffect(() => {
    fetchProjects();
  }, []);

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

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isSending) return;

    const userMessage = inputMessage.trim();
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setInputMessage('');
    setIsSending(true);
    setStreamingContent('');

    try {
      const chatMessages = [...messages.slice(1), { role: 'user' as const, content: userMessage }];

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: chatMessages,
          user_id: user?.id,
          project_id: selectedProject?.id,
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

      setMessages(prev => [...prev, { role: 'assistant', content: fullContent }]);
      setStreamingContent('');
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Sorry, I encountered an error: ${errorMessage}\n\nPlease check that your Anthropic API key is configured in the .env file.`
      }]);
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
      {/* Top Bar - Same style as Dashboard */}
      <div className="h-14 bg-gray-800 border-b border-gray-700 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🛠️</span>
          <div>
            <div className="font-semibold text-white">Dev Environment</div>
            <div className="text-xs text-gray-500">NextBid AI Coding</div>
          </div>
        </div>

        {/* Deploy Pipeline - Center */}
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
          {/* User Info - before buttons */}
          <div className="flex items-center gap-2 pr-2 border-r border-gray-700">
            <span className="text-sm text-gray-400">{user.name}</span>
            <span className="text-xs px-2 py-1 bg-blue-600/20 text-blue-400 rounded">{user.role}</span>
          </div>

          {/* 4 buttons together - Same as Dashboard */}
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
        <>
          <div className="fixed inset-0 bg-black/50 z-50" onClick={() => setShowLogoutConfirm(false)} />
          <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-xl z-50 p-6 w-96">
            <h3 className="text-xl font-bold text-gray-900 mb-3">Confirm Logout</h3>
            <p className="text-gray-600 mb-6">Are you sure you want to log out?</p>
            <div className="flex items-center justify-end space-x-3">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={() => window.location.href = 'http://localhost:7500'}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Yes, Logout
              </button>
            </div>
          </div>
        </>
      )}

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - Icon buttons for pop-outs */}
        <div className="w-14 bg-gray-800 border-r border-gray-700 flex flex-col items-center py-2 gap-1">
          <SidebarIcon
            icon="📁"
            label="Files"
            active={activePanel === 'files'}
            onClick={() => setActivePanel(activePanel === 'files' ? null : 'files')}
          />
          <SidebarIcon
            icon="💻"
            label="Terminal"
            active={activePanel === 'terminal'}
            onClick={() => setActivePanel(activePanel === 'terminal' ? null : 'terminal')}
          />
          <SidebarIcon
            icon="💰"
            label="AI Usage"
            active={activePanel === 'ai-usage'}
            onClick={() => setActivePanel(activePanel === 'ai-usage' ? null : 'ai-usage')}
          />
          <SidebarIcon
            icon="🌐"
            label="Browser"
            active={activePanel === 'browser'}
            onClick={() => setActivePanel(activePanel === 'browser' ? null : 'browser')}
          />
          <SidebarIcon
            icon={<SupabaseLogo />}
            label="DB Schema"
            active={activePanel === 'schema'}
            onClick={() => setActivePanel(activePanel === 'schema' ? null : 'schema')}
          />

          <div className="flex-1" />

          {selectedProject?.is_locked && (
            <div className="text-2xl" title={`Locked by ${selectedProject.lock?.locked_by_name}`}>
              🔒
            </div>
          )}
        </div>

        {/* Pop-out Panel */}
        {activePanel && (
          <div className="w-72 bg-gray-850 border-r border-gray-700 flex flex-col">
            <div className="px-3 py-2 border-b border-gray-700 flex items-center justify-between">
              <span className="text-sm font-medium text-white flex items-center gap-2">
                {activePanel === 'files' && '📁 File Manager'}
                {activePanel === 'terminal' && '💻 Terminal'}
                {activePanel === 'ai-usage' && '💰 AI Usage'}
                {activePanel === 'browser' && '🌐 Virtual Browser'}
                {activePanel === 'schema' && <><SupabaseLogo /> DB Schema</>}
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
              {activePanel === 'schema' && <SchemaPanel project={selectedProject} isOpen={activePanel === 'schema'} />}
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0">
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

              {/* Quick Actions */}
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

          {/* Chat Area - Split 2/3 main chat and 1/3 chat log */}
          <div className="flex-1 flex overflow-hidden">
            {/* Main Chat - 2/3 */}
            <div className="flex-[2] flex flex-col overflow-hidden">
              <div className="flex-1 overflow-auto p-4 space-y-4">
                {messages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-3xl rounded-lg px-4 py-3 ${
                      msg.role === 'user'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-800 border border-gray-700 text-gray-200'
                    }`}>
                      <MessageContent content={msg.content} />
                    </div>
                  </div>
                ))}

                {isSending && streamingContent && (
                  <div className="flex justify-start">
                    <div className="max-w-3xl rounded-lg px-4 py-3 bg-gray-800 border border-gray-700 text-gray-200">
                      <MessageContent content={streamingContent} />
                      <span className="inline-block w-2 h-4 bg-blue-500 animate-pulse ml-1" />
                    </div>
                  </div>
                )}

                {isSending && !streamingContent && (
                  <div className="flex justify-start">
                    <div className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-3">
                      <div className="flex items-center gap-2 text-gray-400">
                        <span className="animate-pulse">●</span>
                        <span className="animate-pulse" style={{ animationDelay: '150ms' }}>●</span>
                        <span className="animate-pulse" style={{ animationDelay: '300ms' }}>●</span>
                        <span className="ml-2">Claude is thinking...</span>
                      </div>
                    </div>
                  </div>
                )}

                {lastUsage && (
                  <div className="flex justify-center">
                    <div className="text-xs text-gray-500 bg-gray-800/50 px-3 py-1 rounded-full">
                      {lastUsage.input_tokens + lastUsage.output_tokens} tokens · ${lastUsage.cost_usd.toFixed(4)}
                    </div>
                  </div>
                )}
              </div>

              {/* Input Area */}
              <div className="p-4 border-t border-gray-700 bg-gray-800">
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <textarea
                      value={inputMessage}
                      onChange={(e) => setInputMessage(e.target.value)}
                      onKeyDown={(e) => {
                        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      placeholder="Ask Claude about your code... (Ctrl+Enter to send)"
                      rows={3}
                      className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none"
                    />
                    <div className="absolute bottom-2 right-2 text-xs text-gray-500">
                      Ctrl+Enter to send
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={handleSendMessage}
                      disabled={!inputMessage.trim() || isSending}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg h-full min-h-[80px]"
                    >
                      {isSending ? '...' : 'Send'}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Chat Log - 1/3 */}
            <div className="flex-1 border-l border-gray-700 bg-gray-850 flex flex-col">
              <div className="px-3 py-2 border-b border-gray-700 bg-gray-800">
                <span className="text-sm font-medium text-gray-400">Chat Log</span>
              </div>
              <div className="flex-1 overflow-auto p-3 space-y-2">
                {messages.map((msg, i) => (
                  <div key={i} className={`text-xs ${msg.role === 'user' ? 'text-blue-400' : 'text-gray-400'}`}>
                    <span className="font-medium">{msg.role === 'user' ? 'You' : 'Claude'}:</span>
                    <span className="ml-1 text-gray-300">
                      {msg.content.length > 150 ? msg.content.substring(0, 150) + '...' : msg.content}
                    </span>
                  </div>
                ))}
                {isSending && streamingContent && (
                  <div className="text-xs text-gray-400">
                    <span className="font-medium">Claude:</span>
                    <span className="ml-1 text-gray-300">
                      {streamingContent.length > 150 ? streamingContent.substring(0, 150) + '...' : streamingContent}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

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
        </div>
      </div>
    </div>
  );
}

// Sidebar Icon Button
function SidebarIcon({ icon, label, active, onClick }: {
  icon: string | React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl transition-colors ${
        active ? 'bg-blue-600 text-white' : 'hover:bg-gray-700 text-gray-400'
      }`}
    >
      {icon}
    </button>
  );
}

// Supabase Logo SVG
function SupabaseLogo() {
  return (
    <svg width="20" height="20" viewBox="0 0 109 113" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M63.7076 110.284C60.8481 113.885 55.0502 111.912 54.9813 107.314L53.9738 40.0627L99.1935 40.0627C107.384 40.0627 111.952 49.5228 106.859 55.9374L63.7076 110.284Z" fill="url(#paint0_linear)"/>
      <path d="M63.7076 110.284C60.8481 113.885 55.0502 111.912 54.9813 107.314L53.9738 40.0627L99.1935 40.0627C107.384 40.0627 111.952 49.5228 106.859 55.9374L63.7076 110.284Z" fill="url(#paint1_linear)" fillOpacity="0.2"/>
      <path d="M45.317 2.07103C48.1765 -1.53037 53.9745 0.442937 54.0434 5.041L54.4849 72.2922H9.83113C1.64038 72.2922 -2.92775 62.8321 2.1655 56.4175L45.317 2.07103Z" fill="#3ECF8E"/>
      <defs>
        <linearGradient id="paint0_linear" x1="53.9738" y1="54.974" x2="94.1635" y2="71.8295" gradientUnits="userSpaceOnUse">
          <stop stopColor="#249361"/>
          <stop offset="1" stopColor="#3ECF8E"/>
        </linearGradient>
        <linearGradient id="paint1_linear" x1="36.1558" y1="30.578" x2="54.4844" y2="65.0806" gradientUnits="userSpaceOnUse">
          <stop/>
          <stop offset="1" stopOpacity="0"/>
        </linearGradient>
      </defs>
    </svg>
  );
}

// Quick Action Button
function QuickButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded-lg border border-gray-600"
    >
      {label}
    </button>
  );
}

// Message Content with Code Blocks
function MessageContent({ content }: { content: string }) {
  const parts = content.split(/(```[\s\S]*?```)/g);

  return (
    <div className="space-y-2">
      {parts.map((part, i) => {
        if (part.startsWith('```')) {
          const match = part.match(/```(\w+)?\n([\s\S]*?)```/);
          const language = match?.[1] || 'text';
          const code = match?.[2] || part.slice(3, -3);

          return (
            <div key={i} className="relative">
              <div className="bg-gray-900 rounded-lg overflow-hidden">
                <div className="flex items-center justify-between px-3 py-1 bg-gray-800 text-xs text-gray-400">
                  <span>{language}</span>
                  <button className="hover:text-white">Copy</button>
                </div>
                <pre className="p-3 text-sm text-green-400 overflow-x-auto">
                  <code>{code}</code>
                </pre>
              </div>
              <button className="mt-1 px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded">
                Apply to File
              </button>
            </div>
          );
        }

        return (
          <p key={i} className="whitespace-pre-wrap">
            {part.split(/(\*\*.*?\*\*)/g).map((segment, j) => {
              if (segment.startsWith('**') && segment.endsWith('**')) {
                return <strong key={j}>{segment.slice(2, -2)}</strong>;
              }
              return segment;
            })}
          </p>
        );
      })}
    </div>
  );
}

// Files Panel
function FilesPanel({ project }: { project: Project | null }) {
  if (!project) {
    return <p className="text-gray-500 text-sm">Select a project first</p>;
  }

  return (
    <div className="text-sm">
      <div className="text-gray-400 mb-2">Local Workspace</div>
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-gray-300 hover:bg-gray-700 px-2 py-1 rounded cursor-pointer">
          <span>📁</span> src/
        </div>
        <div className="flex items-center gap-2 text-gray-300 hover:bg-gray-700 px-2 py-1 rounded cursor-pointer ml-3">
          <span>📁</span> app/
        </div>
        <div className="flex items-center gap-2 text-gray-300 hover:bg-gray-700 px-2 py-1 rounded cursor-pointer ml-6">
          <span>📄</span> page.tsx
        </div>
        <div className="flex items-center gap-2 text-gray-300 hover:bg-gray-700 px-2 py-1 rounded cursor-pointer">
          <span>📄</span> package.json
        </div>
      </div>
      <p className="text-gray-500 text-xs mt-4">Pull from git to load files</p>
    </div>
  );
}

// Terminal Panel
function TerminalPanel({ project, env }: { project: Project | null; env: Environment }) {
  const [command, setCommand] = useState('');
  const [output, setOutput] = useState<string[]>(['$ Ready...']);

  const runCommand = () => {
    if (!command.trim()) return;
    setOutput(prev => [...prev, `$ ${command}`, '(Command execution coming soon)']);
    setCommand('');
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 bg-gray-900 rounded p-2 font-mono text-xs text-green-400 overflow-auto">
        {output.map((line, i) => (
          <div key={i}>{line}</div>
        ))}
      </div>
      <div className="flex gap-1 mt-2">
        <input
          type="text"
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && runCommand()}
          placeholder="$ command"
          className="flex-1 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-white font-mono"
        />
        <button onClick={runCommand} className="px-2 py-1 bg-gray-700 text-white text-xs rounded">
          Run
        </button>
      </div>
    </div>
  );
}

// AI Usage Panel
function AIUsagePanel() {
  const [usage, setUsage] = useState<{
    totals: { requests: number; total_tokens: number; cost_usd: number };
    budget: { monthly_limit: number; used: number; percent_used: number };
    by_user: Array<{ user_id: string; name: string; requests: number; cost: number }>;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchUsage();
  }, []);

  const fetchUsage = async () => {
    try {
      const response = await fetch('/api/ai-usage?period=month');
      const data = await response.json();
      if (data.success) {
        setUsage(data);
      }
    } catch (error) {
      console.error('Error fetching usage:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <div className="text-gray-500 text-sm">Loading usage...</div>;
  }

  if (!usage) {
    return <div className="text-gray-500 text-sm">Failed to load usage</div>;
  }

  const budgetPercent = Math.min(usage.budget.percent_used, 100);
  const budgetColor = budgetPercent > 80 ? 'bg-red-500' : budgetPercent > 60 ? 'bg-yellow-500' : 'bg-blue-500';

  return (
    <div className="text-sm">
      <div className="text-gray-400 mb-3">This Month</div>

      <div className="bg-gray-800 rounded-lg p-3 mb-3">
        <div className="text-2xl font-bold text-white">${usage.budget.used.toFixed(2)}</div>
        <div className="text-gray-500 text-xs">of ${usage.budget.monthly_limit} budget</div>
        <div className="mt-2 h-2 bg-gray-700 rounded-full overflow-hidden">
          <div className={`h-full ${budgetColor}`} style={{ width: `${budgetPercent}%` }} />
        </div>
        <div className="text-xs text-gray-500 mt-1">{usage.budget.percent_used.toFixed(1)}% used</div>
      </div>

      <div className="space-y-2 text-xs">
        <div className="flex justify-between">
          <span className="text-gray-400">Requests</span>
          <span className="text-white">{usage.totals.requests.toLocaleString()}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Tokens used</span>
          <span className="text-white">{usage.totals.total_tokens.toLocaleString()}</span>
        </div>
      </div>

      {usage.by_user.length > 0 && (
        <div className="mt-4">
          <div className="text-gray-400 mb-2">By User</div>
          <div className="space-y-1">
            {usage.by_user.slice(0, 5).map((user) => (
              <div key={user.user_id} className="flex justify-between text-xs">
                <span className="text-gray-300">{user.name}</span>
                <span className="text-gray-400">${user.cost.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Browser Panel
function BrowserPanel() {
  return (
    <div className="text-sm">
      <div className="text-gray-400 mb-2">Virtual Browser</div>
      <input
        type="text"
        placeholder="Enter URL..."
        className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white mb-2"
      />
      <div className="bg-gray-900 rounded h-48 flex items-center justify-center text-gray-500 text-xs">
        Browser preview coming soon
      </div>
      <div className="flex gap-1 mt-2">
        <button className="px-2 py-1 bg-red-600 text-white text-xs rounded">● Record</button>
        <button className="px-2 py-1 bg-gray-700 text-white text-xs rounded">📷</button>
        <button className="px-2 py-1 bg-gray-700 text-white text-xs rounded">🔍</button>
      </div>
    </div>
  );
}

// Schema Panel - 3-level hierarchy: Prefixes → Tables → Columns
function SchemaPanel({ project, isOpen }: { project: Project | null; isOpen: boolean }) {
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [selectedPrefix, setSelectedPrefix] = useState<string | null>(null);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  // Fetch all projects to get all prefixes
  const fetchProjects = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch('/api/projects');
      const data = await res.json();
      if (data.success) {
        setAllProjects(data.projects);
        setLastRefresh(new Date());
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  // Auto-refresh when panel opens
  useEffect(() => {
    if (isOpen) {
      fetchProjects();
    }
  }, [isOpen]);

  // Get unique prefixes from all projects
  const prefixes = allProjects
    .filter(p => p.table_prefix && p.database_schema)
    .map(p => ({
      prefix: p.table_prefix!,
      name: p.name,
      tableCount: Object.keys(p.database_schema || {}).length,
      schema: p.database_schema!
    }));

  // Get tables for selected prefix
  const selectedPrefixData = prefixes.find(p => p.prefix === selectedPrefix);
  const tables = selectedPrefixData ? Object.entries(selectedPrefixData.schema) : [];

  // Get columns for selected table
  const selectedTableSchema = selectedPrefixData?.schema[selectedTable || ''];

  return (
    <div className="text-sm">
      <div className="flex items-center justify-between mb-2">
        <div className="text-gray-400">Database Prefixes</div>
        <span className="text-xs text-gray-500">{prefixes.length} schemas</span>
      </div>

      {prefixes.length === 0 ? (
        <p className="text-gray-500 text-xs">No schemas loaded. Run refresh_all_project_schemas() in Supabase.</p>
      ) : (
        <div className="space-y-1">
          {prefixes.map(({ prefix, name, tableCount }) => (
            <button
              key={prefix}
              onClick={() => {
                setSelectedPrefix(prefix);
                setSelectedTable(null);
              }}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-left ${
                selectedPrefix === prefix ? 'bg-blue-600' : 'bg-gray-800 hover:bg-gray-700'
              }`}
            >
              <span className="text-yellow-400">📁</span>
              <div className="flex-1 min-w-0">
                <div className="text-yellow-400 font-mono text-xs">{prefix}_</div>
                <div className="text-gray-500 text-[10px] truncate">{name}</div>
              </div>
              <span className="text-gray-500 text-xs">{tableCount}</span>
            </button>
          ))}
        </div>
      )}

      <div className="mt-3 pt-2 border-t border-gray-700">
        <button
          onClick={fetchProjects}
          disabled={isRefreshing}
          className="w-full px-2 py-1 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 text-gray-300 text-xs rounded flex items-center justify-center gap-1"
        >
          <span className={isRefreshing ? 'animate-spin' : ''}>🔄</span>
          {isRefreshing ? 'Refreshing...' : 'Refresh All'}
        </button>
        {lastRefresh && (
          <div className="text-center text-[10px] text-gray-600 mt-1">
            Last: {lastRefresh.toLocaleTimeString()}
          </div>
        )}
      </div>

      {/* Tables Popup (Level 2) */}
      {selectedPrefix && selectedPrefixData && (
        <TablesPopup
          prefix={selectedPrefix}
          tables={tables}
          onSelectTable={(tableName) => setSelectedTable(tableName)}
          selectedTable={selectedTable}
          onClose={() => {
            setSelectedPrefix(null);
            setSelectedTable(null);
          }}
        />
      )}

      {/* Columns Popup (Level 3) */}
      {selectedTable && selectedTableSchema && (
        <TableColumnsPopup
          tableName={selectedTable}
          schema={selectedTableSchema}
          onClose={() => setSelectedTable(null)}
        />
      )}
    </div>
  );
}

// Level 2: Tables popup for a selected prefix
function TablesPopup({ prefix, tables, onSelectTable, selectedTable, onClose }: {
  prefix: string;
  tables: [string, { columns: string[]; types: Record<string, string> }][];
  onSelectTable: (name: string) => void;
  selectedTable: string | null;
  onClose: () => void;
}) {
  return (
    <div className="fixed left-[360px] top-20 w-72 bg-gray-800 border border-gray-600 rounded-lg shadow-2xl z-50">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700 bg-gray-750">
        <div className="flex items-center gap-2">
          <span className="text-yellow-400">📁</span>
          <span className="text-yellow-400 font-mono text-sm">{prefix}_</span>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-white text-lg">
          ✕
        </button>
      </div>

      <div className="p-2 max-h-96 overflow-auto space-y-1">
        {tables.map(([tableName, schema]) => (
          <button
            key={tableName}
            onClick={() => onSelectTable(tableName)}
            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-left ${
              selectedTable === tableName ? 'bg-blue-600' : 'hover:bg-gray-700'
            }`}
          >
            <span className="text-green-400">⊞</span>
            <span className="text-green-400 font-mono text-xs truncate flex-1">
              {tableName.replace(prefix + '_', '')}
            </span>
            <span className="text-gray-500 text-xs">{schema.columns?.length || 0}</span>
          </button>
        ))}
      </div>

      <div className="px-3 py-2 border-t border-gray-700 bg-gray-750 text-xs text-gray-500">
        {tables.length} tables
      </div>
    </div>
  );
}

// Level 3: Popup showing table columns - positioned next to the tables popup
function TableColumnsPopup({ tableName, schema, onClose }: {
  tableName: string;
  schema: { columns: string[]; types: Record<string, string> };
  onClose: () => void;
}) {
  const columns = schema.columns || [];
  const types = schema.types || {};

  return (
    <div className="fixed left-[650px] top-20 w-80 bg-gray-800 border border-gray-600 rounded-lg shadow-2xl z-50">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700 bg-gray-750">
        <div className="flex items-center gap-2">
          <span className="text-green-400">⊞</span>
          <span className="text-white font-mono text-sm">{tableName}</span>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-white text-lg">
          ✕
        </button>
      </div>

      <div className="p-2 max-h-96 overflow-auto">
        <table className="w-full">
          <thead>
            <tr className="text-xs text-gray-500 border-b border-gray-700">
              <th className="text-left py-1 px-2">Column</th>
              <th className="text-left py-1 px-2">Type</th>
            </tr>
          </thead>
          <tbody>
            {columns.map((col: string, i: number) => (
              <tr key={col} className={`text-xs ${i % 2 === 0 ? 'bg-gray-800' : 'bg-gray-750'}`}>
                <td className="py-1.5 px-2">
                  <span className="text-gray-200 font-mono">{col}</span>
                </td>
                <td className="py-1.5 px-2">
                  <span className="text-blue-400 font-mono text-[11px]">
                    {formatType(types[col])}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="px-3 py-2 border-t border-gray-700 bg-gray-750 text-xs text-gray-500">
        {columns.length} columns
      </div>
    </div>
  );
}

// Format SQL types to be more readable
function formatType(type: string | undefined): string {
  if (!type) return '';
  return type
    .replace('character varying', 'varchar')
    .replace('timestamp with time zone', 'timestamptz')
    .replace('timestamp without time zone', 'timestamp')
    .replace('double precision', 'double')
    .replace('boolean', 'bool');
}

// Team Chat Panel - For team communication while in build mode
interface TeamMessage {
  id: string;
  user_name: string;
  content: string;
  created_at: string;
  is_own: boolean;
}

function TeamChatPanel({ user }: { user: { id: string; name: string; email: string; role: string } | null }) {
  const [messages, setMessages] = useState<TeamMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch messages on mount and poll for new ones
  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 5000); // Poll every 5 seconds
    return () => clearInterval(interval);
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchMessages = async () => {
    try {
      const res = await fetch('/api/team-chat');
      const data = await res.json();
      if (data.success) {
        setMessages(data.messages.map((m: TeamMessage) => ({
          ...m,
          is_own: m.user_name === user?.name
        })));
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !user) return;

    try {
      const res = await fetch('/api/team-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          user_name: user.name,
          content: newMessage.trim()
        })
      });

      if (res.ok) {
        setNewMessage('');
        fetchMessages();
      }
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (isLoading) {
    return <div className="text-gray-500 text-sm text-center py-4">Loading chat...</div>;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-auto space-y-2 mb-2">
        {messages.length === 0 ? (
          <div className="text-gray-500 text-xs text-center py-4">
            No messages yet. Say hi to your team!
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.is_own ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-lg px-2 py-1 ${
                msg.is_own
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-200'
              }`}>
                {!msg.is_own && (
                  <div className="text-[10px] text-gray-400 font-medium">{msg.user_name}</div>
                )}
                <div className="text-xs">{msg.content}</div>
                <div className={`text-[9px] ${msg.is_own ? 'text-blue-200' : 'text-gray-500'} text-right`}>
                  {formatTime(msg.created_at)}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex gap-1">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="Message team..."
          className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-white"
        />
        <button
          onClick={sendMessage}
          disabled={!newMessage.trim()}
          className="px-2 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 text-white text-xs rounded"
        >
          Send
        </button>
      </div>

      {/* Online indicator */}
      <div className="text-[10px] text-gray-600 text-center mt-2">
        🟢 {user?.name} · Auto-refresh every 5s
      </div>
    </div>
  );
}

// Unlock Modal
function UnlockModal({ project, userId, onClose, onUnlock }: {
  project: Project | null;
  userId?: string;
  onClose: () => void;
  onUnlock: () => void;
}) {
  const [patchNotes, setPatchNotes] = useState('');
  const [changesSummary, setChangesSummary] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleUnlock = async () => {
    if (!patchNotes.trim() || !project || !userId) return;
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/locks', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: project.id,
          user_id: userId,
          patch_notes: patchNotes,
          changes_summary: changesSummary,
        }),
      });

      const data = await response.json();
      if (data.success) {
        onUnlock();
      } else {
        alert(data.error || 'Failed to unlock');
      }
    } catch (error) {
      console.error('Error unlocking:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold text-white mb-4">Unlock {project?.name}</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">
              Patch Notes <span className="text-red-400">*</span>
            </label>
            <textarea
              value={patchNotes}
              onChange={(e) => setPatchNotes(e.target.value)}
              placeholder="What did you change? (required)"
              rows={3}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Changes Summary</label>
            <input
              type="text"
              value={changesSummary}
              onChange={(e) => setChangesSummary(e.target.value)}
              placeholder="e.g., Modified auth.js, server.js"
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 text-gray-400 hover:text-white">
            Cancel
          </button>
          <button
            onClick={handleUnlock}
            disabled={!patchNotes.trim() || isSubmitting}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded-lg"
          >
            {isSubmitting ? 'Unlocking...' : 'Unlock & Save Notes'}
          </button>
        </div>
      </div>
    </div>
  );
}
