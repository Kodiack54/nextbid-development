'use client';

import { useState, useEffect } from 'react';

interface Session {
  id: string;
  title: string;
  status: string;
  started_at: string;
  ended_at?: string;
  summary?: string;
  message_count?: number;
  source_type?: string;
  source_name?: string;
  project_path?: string;
  needs_review?: boolean;
  processed_by_susan?: boolean;
}

interface Extraction {
  id: string;
  session_id: string;
  extraction_type: string;
  content: string;
  category: string;
  priority: string;
  status: string;
  created_at: string;
  project_path?: string;
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

const CHAD_URL = process.env.NEXT_PUBLIC_CHAD_URL || 'http://161.35.229.220:5401';

export function SessionHubPanel({ projectId, userId, workerStatus, onTriggerWorker }: SessionHubPanelProps) {
  const [activeTab, setActiveTab] = useState<'sessions' | 'knowledge' | 'todos'>('sessions');
  const [sessions, setSessions] = useState<Session[]>([]);
  const [knowledge, setKnowledge] = useState<Extraction[]>([]);
  const [todos, setTodos] = useState<Extraction[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);

  // Fetch sessions from Chad's dumps
  useEffect(() => {
    const fetchSessions = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${CHAD_URL}/api/sessions/recent`);
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
    const interval = setInterval(fetchSessions, 30000);
    return () => clearInterval(interval);
  }, []);

  // Fetch extractions (knowledge + todos) from Chad
  useEffect(() => {
    const fetchExtractions = async () => {
      try {
        const res = await fetch(`${CHAD_URL}/api/extractions/pending`);
        const data = await res.json();
        if (data.success) {
          setKnowledge(data.data?.knowledge || []);
          setTodos(data.data?.todos || []);
        }
      } catch (error) {
        console.error('Failed to fetch extractions:', error);
      }
    };

    fetchExtractions();
    const interval = setInterval(fetchExtractions, 30000);
    return () => clearInterval(interval);
  }, []);

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
    { id: 'knowledge', label: 'Knowledge', count: knowledge.length },
    { id: 'todos', label: 'Todos', count: todos.length },
  ] as const;

  return (
    <div className="h-full flex flex-col text-sm">
      {/* Worker Status Bar */}
      <div className="px-3 py-2 bg-gray-800 border-b border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${workerStatus?.isRunning ? 'bg-yellow-400 animate-pulse' : 'bg-green-400'}`} />
          <span className="text-gray-400 text-xs">
            Chad → Susan Pipeline
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
              <span className={`ml-1 px-1.5 py-0.5 rounded text-[10px] ${
                tab.id === 'todos' ? 'bg-yellow-600' : 'bg-gray-700'
              }`}>
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

        {activeTab === 'knowledge' && (
          <KnowledgeList knowledge={knowledge} formatTime={formatTime} />
        )}

        {activeTab === 'todos' && (
          <TodosList todos={todos} formatTime={formatTime} />
        )}
      </div>
    </div>
  );
}

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
        <p className="text-xs mt-1">Chad captures dumps every 30 minutes.</p>
      </div>
    );
  }

  const pending = sessions.filter(s => s.status === 'pending_review');
  const processed = sessions.filter(s => s.status !== 'pending_review');

  return (
    <div className="divide-y divide-gray-800">
      {pending.length > 0 && (
        <div>
          <div className="px-3 py-1.5 bg-yellow-900/30 text-yellow-400 text-[10px] font-medium flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
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
                    <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
                    <span className="text-gray-300 text-xs font-medium truncate max-w-[120px]">
                      {session.source_name || session.source_type || 'Unknown'}
                    </span>
                    {session.message_count && (
                      <span className="text-gray-500 text-[10px]">
                        {session.message_count} msgs
                      </span>
                    )}
                  </div>
                  <span className="text-gray-500 text-[10px]">
                    {formatTime(session.started_at)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {processed.length > 0 && (
        <div>
          <div className="px-3 py-1.5 bg-gray-800 text-gray-400 text-[10px] font-medium">
            Processed ({processed.length})
          </div>
          <div className="divide-y divide-gray-800">
            {processed.slice(0, 10).map(session => (
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
                      {session.source_name || session.source_type || 'Unknown'}
                    </span>
                  </div>
                  <span className="text-gray-500 text-[10px]">
                    {formatTime(session.started_at)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function KnowledgeList({
  knowledge,
  formatTime,
}: {
  knowledge: Extraction[];
  formatTime: (d: string) => string;
}) {
  const categoryColors: Record<string, string> = {
    decision: 'text-purple-400 bg-purple-900/30',
    discovery: 'text-blue-400 bg-blue-900/30',
    config: 'text-yellow-400 bg-yellow-900/30',
    infrastructure: 'text-cyan-400 bg-cyan-900/30',
    bug: 'text-red-400 bg-red-900/30',
    solution: 'text-green-400 bg-green-900/30',
    general: 'text-gray-400 bg-gray-800',
  };

  if (knowledge.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500">
        <p>No knowledge items pending.</p>
        <p className="text-xs mt-1">Chad extracts → Susan sorts.</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-800">
      <div className="px-3 py-1.5 bg-blue-900/20 text-blue-400 text-[10px] font-medium">
        Pending for Susan to sort ({knowledge.length})
      </div>
      {knowledge.map(item => (
        <div key={item.id} className="px-3 py-2">
          <div className="flex items-center justify-between mb-1">
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${categoryColors[item.category] || categoryColors.general}`}>
              {item.category}
            </span>
            <span className="text-gray-500 text-[10px]">
              {formatTime(item.created_at)}
            </span>
          </div>
          <div className="text-gray-300 text-xs leading-relaxed">
            {item.content?.substring(0, 200)}
            {item.content?.length > 200 && '...'}
          </div>
        </div>
      ))}
    </div>
  );
}

function TodosList({
  todos,
  formatTime,
}: {
  todos: Extraction[];
  formatTime: (d: string) => string;
}) {
  if (todos.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500">
        <p>No todos pending.</p>
        <p className="text-xs mt-1">Chad extracts → Susan sorts.</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-800">
      <div className="px-3 py-1.5 bg-yellow-900/20 text-yellow-400 text-[10px] font-medium">
        Pending for Susan to assign ({todos.length})
      </div>
      {todos.map(item => (
        <div key={item.id} className="px-3 py-2 flex items-start gap-2">
          <span className={`mt-0.5 w-2 h-2 rounded border ${
            item.priority === 'high' ? 'border-red-400' : 'border-gray-500'
          }`} />
          <div className="flex-1">
            <div className="text-gray-300 text-xs leading-relaxed">
              {item.content?.substring(0, 150)}
              {item.content?.length > 150 && '...'}
            </div>
            <div className="text-gray-500 text-[10px] mt-1">
              {formatTime(item.created_at)}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
