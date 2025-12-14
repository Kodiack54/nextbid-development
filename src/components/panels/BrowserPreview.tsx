'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Square, RefreshCw } from 'lucide-react';
import type { Project, Environment, DevServerStatus } from '../../types';

interface BrowserPreviewProps {
  project: Project | null;
  env: Environment;
  userId?: string;
}

export function BrowserPreview({ project, env, userId }: BrowserPreviewProps) {
  const [url, setUrl] = useState('');
  const [currentUrl, setCurrentUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [serverStatus, setServerStatus] = useState<DevServerStatus>('stopped');
  const [isServerLoading, setIsServerLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Build default URL based on project and environment
  useEffect(() => {
    if (project) {
      const port = project[env.portKey];
      const defaultUrl = `http://${project.droplet_ip}:${port}`;
      setUrl(defaultUrl);
      // Don't auto-load URL - wait for server to be running
      if (project.dev_server_status === 'running') {
        setCurrentUrl(defaultUrl);
      }
      setServerStatus(project.dev_server_status || 'stopped');
      setServerError(project.dev_server_error || null);
    }
  }, [project, env]);

  // Poll for server status
  const fetchServerStatus = useCallback(async () => {
    if (!project?.id) return;

    try {
      const res = await fetch('/api/dev-server');
      const data = await res.json();

      if (data.success) {
        const projectStatus = data.projects.find((p: any) => p.id === project.id);
        if (projectStatus) {
          setServerStatus(projectStatus.dev_server_status || 'stopped');
          setServerError(projectStatus.dev_server_error || null);

          // Auto-load URL when server starts
          if (projectStatus.dev_server_status === 'running' && !currentUrl) {
            const port = project[env.portKey];
            setCurrentUrl(`http://${project.droplet_ip}:${port}`);
          }
        }
      }
    } catch (error) {
      console.error('Failed to fetch server status:', error);
    }
  }, [project, env, currentUrl]);

  // Poll every 5 seconds
  useEffect(() => {
    fetchServerStatus();
    const interval = setInterval(fetchServerStatus, 5000);
    return () => clearInterval(interval);
  }, [fetchServerStatus]);

  const handleNavigate = () => {
    if (url.trim()) {
      setIsLoading(true);
      setCurrentUrl(url.trim().startsWith('http') ? url.trim() : `http://${url.trim()}`);
    }
  };

  const handleRefresh = () => {
    if (iframeRef.current && currentUrl) {
      setIsLoading(true);
      iframeRef.current.src = currentUrl;
    }
  };

  const handleStartServer = async () => {
    if (!project?.id) return;

    setIsServerLoading(true);
    setServerError(null);

    try {
      const res = await fetch('/api/dev-server', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'start',
          project_id: project.id,
          user_id: userId,
          environment: env.id
        })
      });

      const data = await res.json();

      if (data.success) {
        setServerStatus('running');
        // Load URL after a short delay for server to be ready
        setTimeout(() => {
          const port = project[env.portKey];
          setCurrentUrl(`http://${project.droplet_ip}:${port}`);
        }, 1000);
      } else {
        setServerError(data.error);
        setServerStatus('error');
      }
    } catch (error) {
      console.error('Failed to start server:', error);
      setServerError('Failed to start server');
      setServerStatus('error');
    } finally {
      setIsServerLoading(false);
    }
  };

  const handleStopServer = async () => {
    if (!project?.id) return;

    setIsServerLoading(true);

    try {
      const res = await fetch('/api/dev-server', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'stop',
          project_id: project.id
        })
      });

      const data = await res.json();

      if (data.success) {
        setServerStatus('stopped');
        setCurrentUrl('');
      } else {
        setServerError(data.error);
      }
    } catch (error) {
      console.error('Failed to stop server:', error);
      setServerError('Failed to stop server');
    } finally {
      setIsServerLoading(false);
    }
  };

  const handleRestartServer = async () => {
    if (!project?.id) return;

    setIsServerLoading(true);

    try {
      const res = await fetch('/api/dev-server', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'restart',
          project_id: project.id
        })
      });

      const data = await res.json();

      if (data.success) {
        // Refresh the iframe after restart
        setTimeout(handleRefresh, 2000);
      } else {
        setServerError(data.error);
      }
    } catch (error) {
      console.error('Failed to restart server:', error);
      setServerError('Failed to restart server');
    } finally {
      setIsServerLoading(false);
    }
  };

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
    <div className="flex flex-col h-full">
      {/* Browser Header */}
      <div className="px-3 py-2 border-b border-gray-700 bg-gray-800 flex items-center gap-2">
        {/* Server Controls */}
        <div className="flex items-center gap-1 pr-2 border-r border-gray-700">
          {serverStatus === 'running' ? (
            <>
              <button
                onClick={handleStopServer}
                disabled={isServerLoading}
                className="p-1.5 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 rounded text-white"
                title="Stop Server"
              >
                <Square className="w-4 h-4" />
              </button>
              <button
                onClick={handleRestartServer}
                disabled={isServerLoading}
                className="p-1.5 bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 rounded text-white"
                title="Restart Server"
              >
                <RefreshCw className={`w-4 h-4 ${isServerLoading ? 'animate-spin' : ''}`} />
              </button>
            </>
          ) : (
            <button
              onClick={handleStartServer}
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

        {/* Navigation buttons */}
        <button
          onClick={handleRefresh}
          disabled={!currentUrl}
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
            onKeyDown={(e) => e.key === 'Enter' && handleNavigate()}
            placeholder="Enter URL..."
            className="flex-1 bg-transparent text-white text-sm outline-none"
          />
          {isLoading && <span className="animate-spin text-blue-400">◌</span>}
        </div>

        {/* Go button */}
        <button
          onClick={handleNavigate}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg"
        >
          Go
        </button>

        {/* Environment indicator */}
        <div className={`px-2 py-1 rounded text-xs font-medium ${
          env.id === 'dev' ? 'bg-blue-600/20 text-blue-400' :
          env.id === 'test' ? 'bg-yellow-600/20 text-yellow-400' :
          'bg-green-600/20 text-green-400'
        }`}>
          {env.name}
        </div>
      </div>

      {/* Error Banner */}
      {serverError && (
        <div className="px-3 py-2 bg-red-900/50 border-b border-red-700 text-red-300 text-sm flex items-center justify-between">
          <span>Error: {serverError}</span>
          <button
            onClick={() => setServerError(null)}
            className="text-red-400 hover:text-red-200"
          >
            ✕
          </button>
        </div>
      )}

      {/* Browser Content */}
      <div className="flex-1 bg-white relative">
        {!project ? (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900 text-gray-500">
            <div className="text-center">
              <div className="text-4xl mb-4">🌐</div>
              <p>Select a project to preview</p>
            </div>
          </div>
        ) : serverStatus === 'stopped' ? (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900 text-gray-500">
            <div className="text-center">
              <div className="text-4xl mb-4">⏸️</div>
              <p className="text-lg mb-2">Server not running</p>
              <p className="text-sm text-gray-600 mb-4">
                Click "Start" to run {project.name} on port {project[env.portKey]}
              </p>
              <button
                onClick={handleStartServer}
                disabled={isServerLoading || env.id === 'prod'}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded-lg text-white flex items-center gap-2 mx-auto"
              >
                <Play className="w-5 h-5" />
                {isServerLoading ? 'Starting...' : 'Start Dev Server'}
              </button>
            </div>
          </div>
        ) : serverStatus === 'starting' ? (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900 text-gray-500">
            <div className="text-center">
              <div className="text-4xl mb-4 animate-spin">⚙️</div>
              <p className="text-lg mb-2">Starting server...</p>
              <p className="text-sm text-gray-600">
                Running npm run dev on port {project[env.portKey]}
              </p>
            </div>
          </div>
        ) : serverStatus === 'error' ? (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900 text-gray-500">
            <div className="text-center max-w-md">
              <div className="text-4xl mb-4">❌</div>
              <p className="text-lg mb-2 text-red-400">Server Error</p>
              <p className="text-sm text-gray-400 mb-4">
                {serverError || 'Unknown error occurred'}
              </p>
              <button
                onClick={handleStartServer}
                disabled={isServerLoading}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded-lg text-white"
              >
                Try Again
              </button>
            </div>
          </div>
        ) : currentUrl ? (
          <iframe
            ref={iframeRef}
            src={currentUrl}
            className="w-full h-full border-0"
            onLoad={() => setIsLoading(false)}
            onError={() => setIsLoading(false)}
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
            title="Browser Preview"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900 text-gray-500">
            <div className="text-center">
              <div className="text-4xl mb-4">🌐</div>
              <p>Enter a URL and click Go</p>
            </div>
          </div>
        )}
      </div>

      {/* Status Bar */}
      <div className="px-3 py-1 border-t border-gray-700 bg-gray-800 flex items-center justify-between text-xs text-gray-500">
        <span>{currentUrl || 'No URL loaded'}</span>
        <span>
          {project ? `${project.droplet_name} · ${project.droplet_ip}:${project[env.portKey]}` : 'No project selected'}
        </span>
      </div>
    </div>
  );
}
