'use client';

import { useState, useEffect, useCallback, RefObject } from 'react';
import type { Project, Environment } from '../../../types';

interface UseBrowserProps {
  project: Project | null;
  env: Environment;
  iframeRef: RefObject<HTMLIFrameElement | null>;
}

export function useBrowser({ project, env, iframeRef }: UseBrowserProps) {
  const [url, setUrl] = useState('');
  const [currentUrl, setCurrentUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Build default URL based on project and environment (localhost for droplet access)
  useEffect(() => {
    if (project) {
      const port = project[env.portKey];
      const defaultUrl = `http://localhost:${port}`;
      setUrl(defaultUrl);
      // Don't auto-load URL - wait for server to be running
      if (project.dev_server_status === 'running') {
        setCurrentUrl(defaultUrl);
      }
    }
  }, [project, env]);

  const handleNavigate = useCallback(() => {
    if (url.trim()) {
      setIsLoading(true);
      setCurrentUrl(url.trim().startsWith('http') ? url.trim() : `http://${url.trim()}`);
    }
  }, [url]);

  const handleRefresh = useCallback(() => {
    if (iframeRef.current && currentUrl) {
      setIsLoading(true);
      iframeRef.current.src = currentUrl;
    }
  }, [currentUrl, iframeRef]);

  return {
    url,
    setUrl,
    currentUrl,
    setCurrentUrl,
    isLoading,
    setIsLoading,
    handleNavigate,
    handleRefresh,
  };
}
