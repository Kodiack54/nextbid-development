'use client';

import type { Project, Environment } from '../../../types';

interface BrowserStatusBarProps {
  currentUrl: string;
  project: Project | null;
  env: Environment;
}

export function BrowserStatusBar({ currentUrl, project, env }: BrowserStatusBarProps) {
  return (
    <div className="px-3 py-1 border-t border-gray-700 bg-gray-800 flex items-center justify-between text-xs text-gray-500">
      <span>{currentUrl || 'No URL loaded'}</span>
      <span>
        {project ? `${project.droplet_name} · localhost:${project[env.portKey]}` : 'No project selected'}
      </span>
    </div>
  );
}
