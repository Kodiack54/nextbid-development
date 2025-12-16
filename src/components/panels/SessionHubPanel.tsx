'use client';

import { useState, useEffect } from 'react';

interface Session {
  id: string;
  title: string;
  status: string;
  started_at: string;
  ended_at?: string;
  summary?: string;
  dev_projects?: { name: string; slug: string };
  message_count?: number;
  source_type?: string;
  source_name?: string;
  project_path?: string;
  needs_review?: boolean;
  processed_by_susan?: boolean;
}

interface ProjectDoc {
  id: string;
  doc_type: string;
  content: string;
  updated_at: string;
}

interface ProjectKnowledge {
  id: string;
  category: string;
  title: string;
  summary?: string;
  session_id?: string;
  created_at: string;
  importance?: number;
}

interface WorkerStatus {
  isRunning: boolean;
  lastRun: Date | null;
  runCount: number;
  lastResult: {
    success: boolean;
    results?: any[];
    error?: string;
  } | null;
}

interface SessionHubPanelProps {
  projectId: string | null;
  userId: string | null;
  workerStatus?: WorkerStatus;
  onTriggerWorker?: () => void;
}

export function SessionHubPanel({ projectId, userId, workerStatus, onTriggerWorker }: SessionHubPanelProps) {
  const [activeTab, setActiveTab] = useState<'sessions' | 'docs' | 'knowledge' | 'todos'>('sessions');
  const [sessions, setSessions] = useState<Session[]>([]);
  const [docs, setDocs] = useState<ProjectDoc[]>([]);
  const [knowledge, setKnowledge] = useState<ProjectKnowledge[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [expandedDoc, setExpandedDoc] = useState<string | null>(null);

  // Fetch sessions from Chad's dumps (dev_ai_sessions)
  useEffect(() => {
    const fetchSessions = async () => {
      setLoading(true);
      try {
        // Fetch from Chad's pending dumps endpoint
        const res = await fetch('/api/chad/sessions');
        const data = await res.json();
        if (data.success) {
          setSessions(data.sessions || []);
        }
      } catch (error) {
        console.error('Failed to fetch sessions:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSessions();
    // Refresh every 30 seconds to catch new dumps
    const interval = setInterval(fetchSessions, 30000);
    return () => clearInterval(interval);
  }, [projectId]);

  // Fetch docs and knowledge when project changes
  useEffect(() => {
    if (!projectId) return;

    const fetchProjectData = async () => {
      try {
        const [docsRes, knowledgeRes] = await Promise.all([
          fetch(`/api/project-docs?project_id=${projectId}`),
          fetch(`/api/project-knowledge?project_id=${projectId}`),
        ]);

        const [docsData, knowledgeData] = await Promise.all([
          docsRes.json().catch(() => ({ success: false })),
          knowledgeRes.json().catch(() => ({ success: false })),
        ]);

        if (docsData.success) setDocs(docsData.docs || []);
        if (knowledgeData.success) setKnowledge(knowledgeData.knowledge || []);
      } catch (error) {
        console.error('Failed to fetch project data:', error);
      }
    };

    fetchProjectData();
  }, [projectId]);

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(mins / 60);
    const days = Math.floor(hours / 24);

    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const tabs = [
    { id: 'sessions', label: 'Sessions', count: sessions.length },
    { id: 'docs', label: 'Docs', count: docs.length },
    { id: 'knowledge', label: 'Knowledge', count: knowledge.length },
    { id: 'todos', label: 'Todos', count: 0 },
  ] as const;

  return (
    <div className="h-full flex flex-col text-sm">
      {/* Worker Status Bar */}
      <div className="px-3 py-2 bg-gray-800 border-b border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${workerStatus?.isRunning ? 'bg-yellow-400 animate-pulse' : 'bg-green-400'}`} />
          <span className="text-gray-400 text-xs">
            {workerStatus?.isRunning ? 'Cataloging...' : 'Cataloger idle'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {workerStatus?.lastRun && (
            <span className="text-gray-500 text-xs">
              Last: {formatTime(workerStatus.lastRun.toISOString())}
            </span>
          )}
          <button
            onClick={onTriggerWorker}
            disabled={workerStatus?.isRunning}
            className="px-2 py-0.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 text-white text-xs rounded"
          >
            Run Now
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-700">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 px-2 py-2 text-xs font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-gray-800 text-white border-b-2 border-blue-500'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className="ml-1 px-1.5 py-0.5 bg-gray-700 rounded text-[10px]">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'sessions' && (
          <SessionsList
            sessions={sessions}
            loading={loading}
            selectedSession={selectedSession}
            onSelectSession={setSelectedSession}
            formatTime={formatTime}
          />
        )}

        {activeTab === 'docs' && (
          <DocsList
            docs={docs}
            expandedDoc={expandedDoc}
            onToggleDoc={setExpandedDoc}
            formatTime={formatTime}
          />
        )}

        {activeTab === 'knowledge' && (
          <KnowledgeList
            knowledge={knowledge}
            formatTime={formatTime}
          />
        )}

        {activeTab === 'todos' && (
          <TodosList projectId={projectId} />
        )}
      </div>
    </div>
  );
}

// Sub-components

function SessionsList({
  sessions,
  loading,
  selectedSession,
  onSelectSession,
  formatTime,
}: {
  sessions: Session[];
  loading: boolean;
  selectedSession: Session | null;
  onSelectSession: (s: Session | null) => void;
  formatTime: (d: string) => string;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-32 text-gray-500">
        Loading sessions...
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500">
        <p>No session dumps yet.</p>
        <p className="text-xs mt-1">Chad will capture dumps every 30 minutes.</p>
      </div>
    );
  }

  // Split into pending and processed
  const pending = sessions.filter(s => s.needs_review);
  const processed = sessions.filter(s => !s.needs_review);

  return (
    <div>
      {/* Pending for Susan */}
      {pending.length > 0 && (
        <div className="border-b border-gray-700">
          <div className="px-3 py-1.5 bg-yellow-900/20 text-yellow-400 text-[10px] font-medium">
            Pending for Susan ({pending.length})
          </div>
          <div className="divide-y divide-gray-800">
            {pending.map(session => (
              <button
                key={session.id}
                onClick={() => onSelectSession(selectedSession?.id === session.id ? null : session)}
                className={`w-full px-3 py-2 text-left hover:bg-gray-800 transition-colors ${
                  selectedSession?.id === session.id ? 'bg-gray-800' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
                    <span className="text-white text-xs font-medium truncate max-w-[120px]">
                      {session.source_name || session.title || 'Unknown'}
                    </span>
                    {session.message_count && (
                      <span className="text-gray-500 text-[10px]">
                        ({session.message_count} msgs)
                      </span>
                    )}
                  </div>
                  <span className="text-gray-500 text-[10px]">
                    {formatTime(session.started_at)}
                  </span>
                </div>
                {session.source_type && (
                  <div className="text-gray-500 text-[10px] mt-0.5 pl-3.5">
                    {session.source_type}
                  </div>
                )}
                {selectedSession?.id === session.id && session.summary && (
                  <div className="mt-2 p-2 bg-gray-900 rounded text-gray-400 text-[11px] whitespace-pre-wrap">
                    {session.summary}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Processed sessions */}
      {processed.length > 0 && (
        <div>
          <div className="px-3 py-1.5 bg-gray-800 text-gray-400 text-[10px] font-medium">
            Processed ({processed.length})
          </div>
          <div className="divide-y divide-gray-800">
            {processed.map(session => (
              <button
                key={session.id}
                onClick={() => onSelectSession(selectedSession?.id === session.id ? null : session)}
                className={`w-full px-3 py-2 text-left hover:bg-gray-800 transition-colors ${
                  selectedSession?.id === session.id ? 'bg-gray-800' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                    <span className="text-gray-300 text-xs font-medium truncate max-w-[120px]">
                      {session.source_name || session.title || 'Unknown'}
                    </span>
                  </div>
                  <span className="text-gray-500 text-[10px]">
                    {formatTime(session.started_at)}
                  </span>
                </div>
                {selectedSession?.id === session.id && session.summary && (
                  <div className="mt-2 p-2 bg-gray-900 rounded text-gray-400 text-[11px] whitespace-pre-wrap">
                    {session.summary}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DocsList({
  docs,
  expandedDoc,
  onToggleDoc,
  formatTime,
}: {
  docs: ProjectDoc[];
  expandedDoc: string | null;
  onToggleDoc: (id: string | null) => void;
  formatTime: (d: string) => string;
}) {
  const docTypeIcons: Record<string, string> = {
    README: '📖',
    TODO: '✅',
    CODEBASE: '📁',
    CHANGELOG: '📝',
  };

  if (docs.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500">
        <p>No generated docs yet.</p>
        <p className="text-xs mt-1">The cataloger will generate docs from your sessions.</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-800">
      {docs.map(doc => (
        <div key={doc.id} className="px-3 py-2">
          <button
            onClick={() => onToggleDoc(expandedDoc === doc.id ? null : doc.id)}
            className="w-full flex items-center justify-between text-left hover:bg-gray-800 -mx-3 -my-2 px-3 py-2"
          >
            <div className="flex items-center gap-2">
              <span>{docTypeIcons[doc.doc_type] || '📄'}</span>
              <span className="text-white font-mono text-xs">{doc.doc_type}.md</span>
            </div>
            <span className="text-gray-500 text-[10px]">
              {formatTime(doc.updated_at)}
            </span>
          </button>

          {expandedDoc === doc.id && (
            <div className="mt-2 p-2 bg-gray-900 rounded max-h-64 overflow-auto">
              <pre className="text-gray-300 text-[11px] whitespace-pre-wrap font-mono">
                {doc.content}
              </pre>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function KnowledgeList({
  knowledge,
  formatTime,
}: {
  knowledge: ProjectKnowledge[];
  formatTime: (d: string) => string;
}) {
  const categoryColors: Record<string, string> = {
    api: 'text-blue-400',
    config: 'text-yellow-400',
    architecture: 'text-purple-400',
    feature: 'text-green-400',
    'bug-fix': 'text-red-400',
    database: 'text-cyan-400',
    explanation: 'text-gray-400',
  };

  if (knowledge.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500">
        <p>No knowledge items yet.</p>
        <p className="text-xs mt-1">Susan extracts knowledge from your sessions.</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-800">
      {knowledge.map(item => (
        <div key={item.id} className="px-3 py-2">
          <div className="flex items-center justify-between mb-1">
            <span className={`text-xs font-medium ${categoryColors[item.category] || 'text-gray-400'}`}>
              {item.category?.replace('_', ' ') || 'general'}
            </span>
            <span className="text-gray-500 text-[10px]">
              {formatTime(item.created_at)}
            </span>
          </div>
          <div className="text-white text-xs font-medium mb-1">
            {item.title}
          </div>
          {item.summary && (
            <div className="text-gray-400 text-[11px]">
              {item.summary}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function TodosList({ projectId }: { projectId: string | null }) {
  const [todos, setTodos] = useState<any[]>([]);

  useEffect(() => {
    if (!projectId) return;

    const fetchTodos = async () => {
      try {
        const res = await fetch(`/api/project-knowledge?project_id=${projectId}&type=todo`);
        const data = await res.json();
        if (data.success) {
          setTodos(data.knowledge || []);
        }
      } catch (error) {
        console.error('Failed to fetch todos:', error);
      }
    };

    fetchTodos();
  }, [projectId]);

  if (todos.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500">
        <p>No todos tracked yet.</p>
        <p className="text-xs mt-1">Todos are extracted from your chat sessions.</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-800">
      {todos.map((todo, i) => (
        <div key={i} className="px-3 py-2 flex items-start gap-2">
          <input type="checkbox" className="mt-0.5" />
          <span className="text-gray-300 text-xs">
            {typeof todo.content === 'string' ? todo.content : JSON.stringify(todo.content)}
          </span>
        </div>
      ))}
    </div>
  );
}
