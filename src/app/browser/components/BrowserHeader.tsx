'use client';

import { Play, Square, RefreshCw } from 'lucide-react';
import type { Project, Environment, DevServerStatus } from '../../../types';

interface BrowserHeaderProps {
  url: string;
  setUrl: (url: string) => void;
  isLoading: boolean;
  serverStatus: DevServerStatus;
  isServerLoading: boolean;
  env: Environment;
  project: Project | null;
  onNavigate: () => void;
  onRefresh: () => void;
  onStartServer: () => void;
  onStopServer: () => void;
  onRestartServer: () => void;
}

export function BrowserHeader({
  url,
  setUrl,
  isLoading,
  serverStatus,
  isServerLoading,
  env,
  project,
  onNavigate,
  onRefresh,
  onStartServer,
  onStopServer,
  onRestartServer,
}: BrowserHeaderProps) {
  const getStatusColor = () => {
    switch (serverStatus) {
      case 'running': return 'bg-green-500';
      case 'starting': return 'bg-yellow-500 animate-pulse';
      case 'error': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusBadgeClass = () => {
    switch (serverStatus) {
      case 'running': return 'bg-green-600/20 text-green-400 border-green-500/50';
      case 'starting': return 'bg-yellow-600/20 text-yellow-400 border-yellow-500/50';
      case 'error': return 'bg-red-600/20 text-red-400 border-red-500/50';
      default: return 'bg-gray-600/20 text-gray-400 border-gray-500/50';
    }
  };

  return (
    <div className="px-3 py-2 border-b border-gray-700 bg-gray-800 flex items-center gap-2">
      {/* Server Controls */}
      <div className="flex items-center gap-1 pr-2 border-r border-gray-700">
        {serverStatus === 'running' ? (
          <>
            <button
              onClick={onStopServer}
              disabled={isServerLoading}
              className="p-1.5 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 rounded text-white"
              title="Stop Server"
            >
              <Square className="w-4 h-4" />
            </button>
            <button
              onClick={onRestartServer}
              disabled={isServerLoading}
              className="p-1.5 bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 rounded text-white"
              title="Restart Server"
            >
              <RefreshCw className={`w-4 h-4 ${isServerLoading ? 'animate-spin' : ''}`} />
            </button>
          </>
        ) : (
          <button
            onClick={onStartServer}
            disabled={isServerLoading || !project || env.id === 'prod'}
            className="px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded text-white text-sm flex items-center gap-1"
            title={env.id === 'prod' ? 'Cannot start prod server from dev studio' : 'Start Dev Server'}
          >
            <Play className="w-4 h-4" />
            {isServerLoading ? 'Starting...' : 'Start'}
          </button>
        )}
      </div>

      {/* Status Indicator */}
      <div className={`flex items-center gap-1.5 px-2 py-1 rounded border text-xs ${getStatusBadgeClass()}`}>
        <span className={`w-2 h-2 rounded-full ${getStatusColor()}`}></span>
        <span className="capitalize">{serverStatus}</span>
      </div>

      {/* Refresh Button */}
      <button
        onClick={onRefresh}
        disabled={serverStatus !== 'running'}
        className="p-1.5 hover:bg-gray-700 disabled:opacity-50 rounded text-gray-400 hover:text-white"
        title="Refresh"
      >
        ↻
      </button>

      {/* URL Bar */}
      <div className="flex-1 flex items-center bg-gray-900 rounded-lg border border-gray-700 px-3 py-1.5">
        <span className="text-green-400 mr-2">🌐</span>
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onNavigate()}
          placeholder="Enter URL..."
          className="flex-1 bg-transparent text-white text-sm outline-none"
        />
        {isLoading && <span className="animate-spin text-blue-400">◌</span>}
      </div>

      {/* Go Button */}
      <button
        onClick={onNavigate}
        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg"
      >
        Go
      </button>

      {/* Environment Indicator */}
      <div className={`px-2 py-1 rounded text-xs font-medium ${
        env.id === 'dev' ? 'bg-blue-600/20 text-blue-400' :
        env.id === 'test' ? 'bg-yellow-600/20 text-yellow-400' :
        'bg-green-600/20 text-green-400'
      }`}>
        {env.name}
      </div>
    </div>
  );
}
