'use client';

import { RefObject } from 'react';
import { Play } from 'lucide-react';
import type { Project, Environment, DevServerStatus } from '../../../types';

interface BrowserFrameProps {
  project: Project | null;
  env: Environment;
  serverStatus: DevServerStatus;
  serverError: string | null;
  currentUrl: string;
  isServerLoading: boolean;
  iframeRef: RefObject<HTMLIFrameElement | null>;
  onStartServer: () => void;
  onLoad: () => void;
}

export function BrowserFrame({
  project,
  env,
  serverStatus,
  serverError,
  currentUrl,
  isServerLoading,
  iframeRef,
  onStartServer,
  onLoad,
}: BrowserFrameProps) {
  // No project selected
  if (!project) {
    return (
      <div className="flex-1 bg-gray-900 flex items-center justify-center text-gray-500">
        <div className="text-center">
          <div className="text-4xl mb-4">🌐</div>
          <p>Select a project to preview</p>
        </div>
      </div>
    );
  }

  // Server stopped
  if (serverStatus === 'stopped') {
    return (
      <div className="flex-1 bg-gray-900 flex items-center justify-center text-gray-500">
        <div className="text-center">
          <div className="text-4xl mb-4">⏸️</div>
          <p className="text-lg mb-2">Server not running</p>
          <p className="text-sm text-gray-600 mb-4">
            Click "Start" to run {project.name} on port {project[env.portKey]}
          </p>
          <button
            onClick={onStartServer}
            disabled={isServerLoading || env.id === 'prod'}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded-lg text-white flex items-center gap-2 mx-auto"
          >
            <Play className="w-5 h-5" />
            {isServerLoading ? 'Starting...' : 'Start Dev Server'}
          </button>
        </div>
      </div>
    );
  }

  // Server starting
  if (serverStatus === 'starting') {
    return (
      <div className="flex-1 bg-gray-900 flex items-center justify-center text-gray-500">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-spin">⚙️</div>
          <p className="text-lg mb-2">Starting server...</p>
          <p className="text-sm text-gray-600">
            Running npm run dev on port {project[env.portKey]}
          </p>
        </div>
      </div>
    );
  }

  // Server error
  if (serverStatus === 'error') {
    return (
      <div className="flex-1 bg-gray-900 flex items-center justify-center text-gray-500">
        <div className="text-center max-w-md">
          <div className="text-4xl mb-4">❌</div>
          <p className="text-lg mb-2 text-red-400">Server Error</p>
          <p className="text-sm text-gray-400 mb-4">
            {serverError || 'Unknown error occurred'}
          </p>
          <button
            onClick={onStartServer}
            disabled={isServerLoading}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded-lg text-white"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Server running with URL
  if (currentUrl) {
    return (
      <div className="flex-1 bg-white relative">
        <iframe
          ref={iframeRef}
          src={currentUrl}
          className="w-full h-full border-0"
          onLoad={onLoad}
          onError={onLoad}
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
          title="Browser Preview"
        />
      </div>
    );
  }

  // Server running but no URL
  return (
    <div className="flex-1 bg-gray-900 flex items-center justify-center text-gray-500">
      <div className="text-center">
        <div className="text-4xl mb-4">🌐</div>
        <p>Enter a URL and click Go</p>
      </div>
    </div>
  );
}
