'use client';

import { useState, useEffect, useCallback } from 'react';

interface ServerStatus {
  name: string;
  port: number;
  emoji: string;
  role: string;
  status: 'online' | 'degraded' | 'offline';
  responseTime?: number;
  details?: string;
}

// AI Workers in the studio
const AI_WORKERS = [
  { name: 'Susan', port: 5403, emoji: '👩‍💼', role: 'Memory & Knowledge', healthPath: '/health' },
  { name: 'Clair', port: 5406, emoji: '📚', role: 'Cataloger & Learning', healthPath: '/health' },
  { name: 'Tiffany', port: 5407, emoji: '🧪', role: 'Tester', healthPath: '/health' },
  { name: 'Mike', port: 5408, emoji: '🔬', role: 'Security', healthPath: '/health' },
  { name: 'Ryan', port: 5405, emoji: '🏃', role: 'Runner', healthPath: '/health' },
];

export function SystemHealthPanel() {
  const [servers, setServers] = useState<ServerStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);

  const checkServers = useCallback(async () => {
    setLoading(true);
    const results: ServerStatus[] = [];

    for (const worker of AI_WORKERS) {
      const startTime = Date.now();
      try {
        // Use our API proxy to check health
        const res = await fetch(`/api/health-check?port=${worker.port}`, {
          method: 'GET',
          signal: AbortSignal.timeout(5000), // 5 second timeout
        });

        const responseTime = Date.now() - startTime;

        if (res.ok) {
          const data = await res.json();
          results.push({
            name: worker.name,
            port: worker.port,
            emoji: worker.emoji,
            role: worker.role,
            status: responseTime > 2000 ? 'degraded' : 'online',
            responseTime,
            details: data.uptime ? `Up ${formatUptime(data.uptime)}` : 'Running',
          });
        } else {
          results.push({
            name: worker.name,
            port: worker.port,
            emoji: worker.emoji,
            role: worker.role,
            status: 'degraded',
            responseTime,
            details: `HTTP ${res.status}`,
          });
        }
      } catch (err) {
        results.push({
          name: worker.name,
          port: worker.port,
          emoji: worker.emoji,
          role: worker.role,
          status: 'offline',
          details: 'Not responding',
        });
      }
    }

    setServers(results);
    setLastCheck(new Date());
    setLoading(false);
  }, []);

  useEffect(() => {
    checkServers();
    // Auto-refresh every 30 seconds
    const interval = setInterval(checkServers, 30000);
    return () => clearInterval(interval);
  }, [checkServers]);

  const formatUptime = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
    return `${Math.floor(seconds / 86400)}d`;
  };

  const getStatusDot = (status: string) => {
    switch (status) {
      case 'online':
        return (
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
          </span>
        );
      case 'degraded':
        return (
          <span className="relative flex h-3 w-3">
            <span className="animate-pulse absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-yellow-500"></span>
          </span>
        );
      case 'offline':
        return (
          <span className="relative flex h-3 w-3">
            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
          </span>
        );
      default:
        return (
          <span className="relative flex h-3 w-3">
            <span className="relative inline-flex rounded-full h-3 w-3 bg-gray-500"></span>
          </span>
        );
    }
  };

  const getStatusBg = (status: string) => {
    switch (status) {
      case 'online': return 'border-green-500/30 bg-green-500/5';
      case 'degraded': return 'border-yellow-500/30 bg-yellow-500/5';
      case 'offline': return 'border-red-500/30 bg-red-500/5';
      default: return 'border-gray-500/30';
    }
  };

  const onlineCount = servers.filter(s => s.status === 'online').length;
  const totalCount = AI_WORKERS.length;

  return (
    <div className="h-full flex flex-col text-sm overflow-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <span className="text-white font-medium">AI Workers</span>
          <span className="text-gray-500 text-xs ml-2">
            {onlineCount}/{totalCount} online
          </span>
        </div>
        <button
          onClick={checkServers}
          disabled={loading}
          className="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded disabled:opacity-50"
        >
          {loading ? '...' : 'Check'}
        </button>
      </div>

      {/* Overall Status */}
      <div className={`mb-3 p-2 rounded border ${
        onlineCount === totalCount
          ? 'border-green-500/30 bg-green-500/10'
          : onlineCount === 0
            ? 'border-red-500/30 bg-red-500/10'
            : 'border-yellow-500/30 bg-yellow-500/10'
      }`}>
        <div className="flex items-center gap-2">
          {onlineCount === totalCount ? (
            <>
              <span className="text-green-400">✓</span>
              <span className="text-green-400 text-xs">All systems operational</span>
            </>
          ) : onlineCount === 0 ? (
            <>
              <span className="text-red-400">✗</span>
              <span className="text-red-400 text-xs">All systems offline</span>
            </>
          ) : (
            <>
              <span className="text-yellow-400">!</span>
              <span className="text-yellow-400 text-xs">{totalCount - onlineCount} system(s) need attention</span>
            </>
          )}
        </div>
      </div>

      {/* Server List */}
      <div className="space-y-2 flex-1">
        {servers.map((server) => (
          <div
            key={server.port}
            className={`p-2 rounded border transition-colors ${getStatusBg(server.status)}`}
          >
            <div className="flex items-center gap-3">
              {/* Status Dot */}
              {getStatusDot(server.status)}

              {/* Emoji & Name */}
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="text-lg">{server.emoji}</span>
                <div className="min-w-0">
                  <div className="text-white font-medium">{server.name}</div>
                  <div className="text-gray-500 text-xs truncate">{server.role}</div>
                </div>
              </div>

              {/* Port & Response Time */}
              <div className="text-right">
                <div className="text-gray-400 text-xs font-mono">:{server.port}</div>
                {server.responseTime !== undefined && (
                  <div className={`text-xs ${server.responseTime > 1000 ? 'text-yellow-400' : 'text-gray-500'}`}>
                    {server.responseTime}ms
                  </div>
                )}
              </div>
            </div>

            {/* Details */}
            {server.details && (
              <div className={`mt-1 text-xs ${
                server.status === 'offline' ? 'text-red-400' :
                server.status === 'degraded' ? 'text-yellow-400' : 'text-gray-500'
              }`}>
                {server.details}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Last Check */}
      {lastCheck && (
        <div className="mt-2 text-xs text-gray-600 text-center">
          Last checked: {lastCheck.toLocaleTimeString()}
        </div>
      )}
    </div>
  );
}
