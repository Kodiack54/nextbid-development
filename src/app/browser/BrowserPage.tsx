'use client';

import { useState, useEffect, useRef } from 'react';
import type { Project, Environment } from '../../types';
import { BrowserHeader } from './components/BrowserHeader';
import { BrowserFrame } from './components/BrowserFrame';
import { BrowserStatusBar } from './components/BrowserStatusBar';
import { useBrowser } from './hooks/useBrowser';
import { useDevServer } from './hooks/useDevServer';

interface BrowserPageProps {
  project: Project | null;
  env: Environment;
  userId?: string;
}

export default function BrowserPage({ project, env, userId }: BrowserPageProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const {
    url,
    setUrl,
    currentUrl,
    setCurrentUrl,
    isLoading,
    setIsLoading,
    handleNavigate,
    handleRefresh,
  } = useBrowser({ project, env, iframeRef });

  const {
    serverStatus,
    serverError,
    isServerLoading,
    handleStartServer,
    handleStopServer,
    handleRestartServer,
    clearError,
  } = useDevServer({ project, env, userId, setCurrentUrl });

  return (
    <div className="flex flex-col h-full">
      <BrowserHeader
        url={url}
        setUrl={setUrl}
        isLoading={isLoading}
        serverStatus={serverStatus}
        isServerLoading={isServerLoading}
        env={env}
        project={project}
        onNavigate={handleNavigate}
        onRefresh={handleRefresh}
        onStartServer={handleStartServer}
        onStopServer={handleStopServer}
        onRestartServer={handleRestartServer}
      />

      {serverError && (
        <div className="px-3 py-2 bg-red-900/50 border-b border-red-700 text-red-300 text-sm flex items-center justify-between">
          <span>Error: {serverError}</span>
          <button onClick={clearError} className="text-red-400 hover:text-red-200">
            ✕
          </button>
        </div>
      )}

      <BrowserFrame
        project={project}
        env={env}
        serverStatus={serverStatus}
        serverError={serverError}
        currentUrl={currentUrl}
        isServerLoading={isServerLoading}
        iframeRef={iframeRef}
        onStartServer={handleStartServer}
        onLoad={() => setIsLoading(false)}
      />

      <BrowserStatusBar
        currentUrl={currentUrl}
        project={project}
        env={env}
      />
    </div>
  );
}
