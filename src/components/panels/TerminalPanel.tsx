'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { RefreshCw, Trash2 } from 'lucide-react';
import type { Project, Environment } from '../../types';

interface TerminalPanelProps {
  project: Project | null;
  env: Environment;
}

export function TerminalPanel({ project, env }: TerminalPanelProps) {
  const [logs, setLogs] = useState<string>('Select a project to view server logs...');
  const [isLoading, setIsLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const fetchLogs = useCallback(async () => {
    if (!project?.id) return;

    setIsLoading(true);
    try {
      const res = await fetch(`/api/dev-server/logs/${project.id}?lines=200`);
      const data = await res.json();

      if (data.success) {
        if (data.logs) {
          setLogs(data.logs);
        } else {
          setLogs('No logs available. Server may not be running.');
        }
      } else {
        setLogs(`Error fetching logs: ${data.error}`);
      }
    } catch (error) {
      console.error('Failed to fetch logs:', error);
      setLogs('Failed to fetch logs. Check console for details.');
    } finally {
      setIsLoading(false);
    }
  }, [project?.id]);

  // Initial fetch and auto-refresh
  useEffect(() => {
    fetchLogs();

    if (autoRefresh) {
      const interval = setInterval(fetchLogs, 3000);
      return () => clearInterval(interval);
    }
  }, [fetchLogs, autoRefresh]);

  // Auto-scroll to bottom when logs update
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  const clearLogs = () => {
    setLogs('Logs cleared.\n\nWaiting for new output...');
  };

  // Parse and colorize logs
  const renderLogs = () => {
    return logs.split('\n').map((line, i) => {
      let className = 'text-gray-300';

      // Color code based on content
      if (line.includes('error') || line.includes('Error') || line.includes('ERROR')) {
        className = 'text-red-400';
      } else if (line.includes('warn') || line.includes('Warn') || line.includes('WARN')) {
        className = 'text-yellow-400';
      } else if (line.includes('✓') || line.includes('success') || line.includes('ready') || line.includes('compiled')) {
        className = 'text-green-400';
      } else if (line.includes('info') || line.includes('INFO')) {
        className = 'text-blue-400';
      } else if (line.startsWith('$') || line.startsWith('>')) {
        className = 'text-cyan-400';
      } else if (line.includes('PM2') || line.includes('[PM2]')) {
        className = 'text-purple-400';
      }

      return (
        <div key={i} className={className}>
          {line || '\u00A0'}
        </div>
      );
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">
            {project ? `${project.name} logs` : 'No project'}
          </span>
          {project?.pm2_process_name && (
            <span className="text-xs px-1.5 py-0.5 bg-purple-600/20 text-purple-400 rounded">
              {project.pm2_process_name}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <label className="flex items-center gap-1 text-xs text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="w-3 h-3"
            />
            Auto
          </label>
          <button
            onClick={fetchLogs}
            disabled={isLoading}
            className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white"
            title="Refresh logs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={clearLogs}
            className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white"
            title="Clear logs"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Logs Display */}
      <div className="flex-1 bg-gray-900 rounded p-2 font-mono text-xs overflow-auto">
        {renderLogs()}
        <div ref={logsEndRef} />
      </div>

      {/* Status Bar */}
      <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
        <span>
          {project?.dev_server_status === 'running' ? (
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              Server running
            </span>
          ) : project?.dev_server_status === 'error' ? (
            <span className="flex items-center gap-1 text-red-400">
              <span className="w-2 h-2 bg-red-500 rounded-full"></span>
              Server error
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 bg-gray-500 rounded-full"></span>
              Server stopped
            </span>
          )}
        </span>
        <span>
          {autoRefresh ? 'Refreshing every 3s' : 'Auto-refresh off'}
        </span>
      </div>
    </div>
  );
}
