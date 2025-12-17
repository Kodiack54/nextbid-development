'use client';

import { useState, useEffect } from 'react';
import { FolderOpen, ChevronUp, ChevronDown, RefreshCw } from 'lucide-react';

export interface ProjectPath {
  id: string;
  project_id: string;
  path: string;
  label: string;
  sort_order: number;
  created_at: string;
}

interface ProjectFolderSelectorProps {
  projectId: string;
  projectPath: string;
  selectedPath: ProjectPath | null;
  onSelectPath: (path: ProjectPath) => void;
  onPathsLoaded?: (paths: ProjectPath[]) => void;
}

export default function ProjectFolderSelector({
  projectId,
  projectPath,
  selectedPath,
  onSelectPath,
  onPathsLoaded,
}: ProjectFolderSelectorProps) {
  const [projectPaths, setProjectPaths] = useState<ProjectPath[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchProjectPaths();
  }, [projectId]);

  const fetchProjectPaths = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/project-paths?project_id=${projectId}`);
      const data = await response.json();
      if (data.success) {
        const paths = data.paths || [];
        setProjectPaths(paths);
        onPathsLoaded?.(paths);

        // Auto-select first or matching path
        if (!selectedPath) {
          const mainPath = paths.find((p: ProjectPath) => p.path === projectPath);
          if (mainPath) {
            onSelectPath(mainPath);
          } else if (paths.length > 0) {
            onSelectPath(paths[0]);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching project paths:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const moveFolder = async (folderId: string, direction: 'up' | 'down') => {
    const currentIndex = projectPaths.findIndex(p => p.id === folderId);
    if (currentIndex === -1) return;

    const swapIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (swapIndex < 0 || swapIndex >= projectPaths.length) return;

    const currentFolder = projectPaths[currentIndex];
    const swapFolder = projectPaths[swapIndex];

    // Optimistic update
    const newPaths = [...projectPaths];
    newPaths[currentIndex] = { ...swapFolder, sort_order: currentFolder.sort_order };
    newPaths[swapIndex] = { ...currentFolder, sort_order: swapFolder.sort_order };
    newPaths.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    setProjectPaths(newPaths);

    try {
      await Promise.all([
        fetch('/api/project-paths', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: currentFolder.id, sort_order: swapFolder.sort_order || swapIndex }),
        }),
        fetch('/api/project-paths', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: swapFolder.id, sort_order: currentFolder.sort_order || currentIndex }),
        }),
      ]);
    } catch (error) {
      console.error('Error moving folder:', error);
      fetchProjectPaths(); // Revert on error
    }
  };

  if (isLoading) {
    return (
      <div className="w-64 flex-shrink-0 bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
        <div className="p-3 border-b border-gray-700">
          <h3 className="text-white font-semibold text-sm">Project Folders</h3>
        </div>
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="w-5 h-5 text-blue-400 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="w-64 flex-shrink-0 bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
      <div className="p-3 border-b border-gray-700">
        <h3 className="text-white font-semibold text-sm">Project Folders</h3>
      </div>

      <div className="overflow-y-auto max-h-[calc(100vh-300px)]">
        {projectPaths.length === 0 ? (
          <div className="p-4 text-center text-gray-500 text-sm">
            <FolderOpen className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No folders linked</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-700">
            {projectPaths.map((path, index) => (
              <div
                key={path.id}
                className={`p-3 cursor-pointer group ${
                  selectedPath?.id === path.id
                    ? 'bg-blue-600/20 border-l-2 border-blue-500'
                    : 'hover:bg-gray-750'
                }`}
                onClick={() => onSelectPath(path)}
              >
                <div className="flex items-center gap-2">
                  {/* Move buttons */}
                  <div className="flex flex-col opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => { e.stopPropagation(); moveFolder(path.id, 'up'); }}
                      disabled={index === 0}
                      className={`p-0.5 rounded ${index === 0 ? 'text-gray-700 cursor-not-allowed' : 'text-gray-500 hover:text-white hover:bg-gray-600'}`}
                      title="Move up"
                    >
                      <ChevronUp className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); moveFolder(path.id, 'down'); }}
                      disabled={index === projectPaths.length - 1}
                      className={`p-0.5 rounded ${index === projectPaths.length - 1 ? 'text-gray-700 cursor-not-allowed' : 'text-gray-500 hover:text-white hover:bg-gray-600'}`}
                      title="Move down"
                    >
                      <ChevronDown className="w-3 h-3" />
                    </button>
                  </div>
                  <FolderOpen className={`w-4 h-4 ${
                    selectedPath?.id === path.id ? 'text-blue-400' : 'text-yellow-400'
                  }`} />
                  <span className="text-white font-medium text-sm flex-1">{path.label}</span>
                </div>
                <p className="text-gray-600 text-[10px] font-mono mt-1 pl-12 truncate">
                  {path.path.split('/').pop()}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
