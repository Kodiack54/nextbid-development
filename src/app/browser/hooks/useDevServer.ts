'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Project, Environment, DevServerStatus } from '../../../types';

interface UseDevServerProps {
  project: Project | null;
  env: Environment;
  userId?: string;
  setCurrentUrl: (url: string) => void;
}

export function useDevServer({ project, env, userId, setCurrentUrl }: UseDevServerProps) {
  const [serverStatus, setServerStatus] = useState<DevServerStatus>('stopped');
  const [serverError, setServerError] = useState<string | null>(null);
  const [isServerLoading, setIsServerLoading] = useState(false);

  // Initialize status from project
  useEffect(() => {
    if (project) {
      setServerStatus(project.dev_server_status || 'stopped');
      setServerError(project.dev_server_error || null);
    }
  }, [project]);

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

          // Auto-load URL when server starts (localhost for droplet access)
          if (projectStatus.dev_server_status === 'running') {
            const port = project[env.portKey];
            setCurrentUrl(`http://localhost:${port}`);
          }
        }
      }
    } catch (error) {
      console.error('Failed to fetch server status:', error);
    }
  }, [project, env, setCurrentUrl]);

  // Poll every 5 seconds
  useEffect(() => {
    fetchServerStatus();
    const interval = setInterval(fetchServerStatus, 5000);
    return () => clearInterval(interval);
  }, [fetchServerStatus]);

  const handleStartServer = useCallback(async () => {
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
        // Load URL after a short delay for server to be ready (localhost for droplet access)
        setTimeout(() => {
          const port = project[env.portKey];
          setCurrentUrl(`http://localhost:${port}`);
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
  }, [project, env, userId, setCurrentUrl]);

  const handleStopServer = useCallback(async () => {
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
  }, [project, setCurrentUrl]);

  const handleRestartServer = useCallback(async () => {
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

      if (!data.success) {
        setServerError(data.error);
      }
    } catch (error) {
      console.error('Failed to restart server:', error);
      setServerError('Failed to restart server');
    } finally {
      setIsServerLoading(false);
    }
  }, [project]);

  const clearError = useCallback(() => {
    setServerError(null);
  }, []);

  return {
    serverStatus,
    serverError,
    isServerLoading,
    handleStartServer,
    handleStopServer,
    handleRestartServer,
    clearError,
  };
}
