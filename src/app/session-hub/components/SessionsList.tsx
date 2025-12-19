'use client';

interface Session {
  id: string;
  title: string;
  status: 'pending_capture' | 'captured' | 'pending_scrub' | 'scrubbed' | 'pending_categorize' | 'categorized';
  started_at: string;
  ended_at?: string;
  summary?: string;
  message_count?: number;
  source_type?: string;
  source_name?: string;
  project_path?: string;
  processed_by_chad?: boolean;
  processed_by_jen?: boolean;
  processed_by_susan?: boolean;
}

interface SessionsListProps {
  sessions: Session[];
  loading: boolean;
}

export function SessionsList({ sessions, loading }: SessionsListProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-32 text-gray-500">
        <div className="animate-pulse">Loading sessions...</div>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">
        <div className="text-4xl mb-3">📭</div>
        <p className="font-medium">No session dumps yet</p>
        <p className="text-xs mt-1">Chad captures dumps every 10 minutes</p>
      </div>
    );
  }

  // Group by pipeline status
  const pendingChad = sessions.filter(s => !s.processed_by_chad);
  const pendingJen = sessions.filter(s => s.processed_by_chad && !s.processed_by_jen);
  const pendingSusan = sessions.filter(s => s.processed_by_jen && !s.processed_by_susan);
  const completed = sessions.filter(s => s.processed_by_susan);

  return (
    <div className="divide-y divide-gray-800">
      {/* Pending Chad */}
      {pendingChad.length > 0 && (
        <SessionGroup
          title="Pending Capture (Chad)"
          sessions={pendingChad}
          color="blue"
          icon="📥"
        />
      )}

      {/* Pending Jen */}
      {pendingJen.length > 0 && (
        <SessionGroup
          title="Pending Scrub (Jen)"
          sessions={pendingJen}
          color="purple"
          icon="🔍"
        />
      )}

      {/* Pending Susan */}
      {pendingSusan.length > 0 && (
        <SessionGroup
          title="Pending Categorize (Susan)"
          sessions={pendingSusan}
          color="yellow"
          icon="📁"
        />
      )}

      {/* Completed */}
      {completed.length > 0 && (
        <SessionGroup
          title="Completed"
          sessions={completed.slice(0, 20)}
          color="green"
          icon="✅"
          collapsed
        />
      )}
    </div>
  );
}

interface SessionGroupProps {
  title: string;
  sessions: Session[];
  color: 'blue' | 'purple' | 'yellow' | 'green';
  icon: string;
  collapsed?: boolean;
}

function SessionGroup({ title, sessions, color, icon, collapsed }: SessionGroupProps) {
  const bgColors: Record<string, string> = {
    blue: 'bg-blue-900/20',
    purple: 'bg-purple-900/20',
    yellow: 'bg-yellow-900/20',
    green: 'bg-green-900/20',
  };

  const textColors: Record<string, string> = {
    blue: 'text-blue-400',
    purple: 'text-purple-400',
    yellow: 'text-yellow-400',
    green: 'text-green-400',
  };

  const dotColors: Record<string, string> = {
    blue: 'bg-blue-400',
    purple: 'bg-purple-400',
    yellow: 'bg-yellow-400',
    green: 'bg-green-400',
  };

  return (
    <div>
      <div className={`px-4 py-2 ${bgColors[color]} flex items-center gap-2`}>
        <span>{icon}</span>
        <span className={`text-xs font-medium ${textColors[color]}`}>
          {title}
        </span>
        <span className="px-1.5 py-0.5 bg-gray-700 rounded text-[10px] text-gray-300">
          {sessions.length}
        </span>
      </div>
      <div className="divide-y divide-gray-800/50">
        {sessions.map(session => (
          <SessionRow key={session.id} session={session} dotColor={dotColors[color]} />
        ))}
      </div>
    </div>
  );
}

interface SessionRowProps {
  session: Session;
  dotColor: string;
}

function SessionRow({ session, dotColor }: SessionRowProps) {
  return (
    <div className="px-4 py-3 hover:bg-gray-800/50 transition-colors cursor-pointer">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
          <span className="text-sm text-gray-300 font-medium truncate max-w-[200px]">
            {session.source_name || session.source_type || 'Unknown Source'}
          </span>
          {session.message_count && (
            <span className="text-xs text-gray-500">
              {session.message_count} msgs
            </span>
          )}
        </div>
        <span className="text-xs text-gray-500">
          {formatTimeAgo(session.started_at)}
        </span>
      </div>
      {session.summary && (
        <div className="mt-1 text-xs text-gray-500 truncate">
          {session.summary}
        </div>
      )}
      {/* Pipeline progress */}
      <div className="mt-2 flex items-center gap-1">
        <PipelineDot done={session.processed_by_chad} label="C" />
        <div className="w-2 h-px bg-gray-700" />
        <PipelineDot done={session.processed_by_jen} label="J" />
        <div className="w-2 h-px bg-gray-700" />
        <PipelineDot done={session.processed_by_susan} label="S" />
      </div>
    </div>
  );
}

function PipelineDot({ done, label }: { done?: boolean; label: string }) {
  return (
    <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold ${
      done ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-500'
    }`}>
      {label}
    </div>
  );
}

function formatTimeAgo(dateStr: string): string {
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
}
