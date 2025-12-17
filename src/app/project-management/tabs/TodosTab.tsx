'use client';

import { useState, useEffect } from 'react';
import { RefreshCw, FolderOpen, FileText, ChevronDown, ChevronRight, Clock } from 'lucide-react';

interface ProjectPath {
  id: string;
  project_id: string;
  path: string;
  label: string;
  created_at: string;
}

interface TodoFolder {
  path: string;
  name: string;
  content: string;
  lastModified?: string;
}

interface TodosTabProps {
  projectPath: string;
  projectId: string;
}

export default function TodosTab({ projectPath, projectId }: TodosTabProps) {
  const [projectPaths, setProjectPaths] = useState<ProjectPath[]>([]);
  const [selectedPath, setSelectedPath] = useState<ProjectPath | null>(null);
  const [folders, setFolders] = useState<Record<string, TodoFolder>>({});
  const [folderCount, setFolderCount] = useState(0);
  const [totalFiles, setTotalFiles] = useState(0);
  const [scannedAt, setScannedAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [isScanning, setIsScanning] = useState(false);

  // Fetch project paths
  useEffect(() => {
    fetchProjectPaths();
  }, [projectId]);

  // Fetch todos when path changes
  useEffect(() => {
    if (selectedPath) {
      fetchTodos(selectedPath.path);
    }
  }, [selectedPath]);

  const fetchProjectPaths = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/project-paths?project_id=${projectId}`);
      const data = await response.json();
      if (data.success) {
        setProjectPaths(data.paths || []);
        const mainPath = data.paths?.find((p: ProjectPath) => p.path === projectPath);
        if (mainPath) {
          setSelectedPath(mainPath);
        } else if (data.paths?.length > 0) {
          setSelectedPath(data.paths[0]);
        }
      }
    } catch (error) {
      console.error('Error fetching project paths:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTodos = async (path: string) => {
    setIsLoading(true);
    try {
      const cleanPath = path.startsWith('/') ? path.slice(1) : path;
      const response = await fetch(`/api/clair/todos/${cleanPath}`);
      const data = await response.json();
      if (data.success) {
        setFolders(data.folders || {});
        setFolderCount(data.folderCount || 0);
        setTotalFiles(data.totalFiles || 0);
        setScannedAt(data.scannedAt);
        setExpandedFolders(new Set(Object.keys(data.folders || {})));
      }
    } catch (error) {
      console.error('Error fetching todos:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const rescan = async () => {
    if (!selectedPath) return;
    setIsScanning(true);
    try {
      const cleanPath = selectedPath.path.startsWith('/') ? selectedPath.path.slice(1) : selectedPath.path;
      await fetch(`/api/clair/todos/${cleanPath}/scan`, { method: 'POST' });
      await fetchTodos(selectedPath.path);
    } catch (error) {
      console.error('Error rescanning:', error);
    } finally {
      setIsScanning(false);
    }
  };

  const toggleFolder = (path: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

  if (isLoading && !selectedPath) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-6 h-6 text-blue-400 animate-spin" />
      </div>
    );
  }

  const folderEntries = Object.entries(folders);

  return (
    <div className="flex h-full gap-4">
      {/* Left Panel - Project Folders */}
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
              {projectPaths.map(path => (
                <div
                  key={path.id}
                  className={`p-3 cursor-pointer ${
                    selectedPath?.id === path.id
                      ? 'bg-blue-600/20 border-l-2 border-blue-500'
                      : 'hover:bg-gray-750'
                  }`}
                  onClick={() => setSelectedPath(path)}
                >
                  <div className="flex items-center gap-2">
                    <FolderOpen className={`w-4 h-4 ${
                      selectedPath?.id === path.id ? 'text-blue-400' : 'text-yellow-400'
                    }`} />
                    <span className="text-white font-medium text-sm">{path.label}</span>
                  </div>
                  <p className="text-gray-600 text-[10px] font-mono mt-1 pl-6 truncate">
                    {path.path.split('/').pop()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - TODOs */}
      <div className="flex-1 bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
        {selectedPath ? (
          <>
            <div className="p-3 border-b border-gray-700 flex items-center justify-between">
              <div>
                <h3 className="text-white font-semibold text-sm">{selectedPath.label} TODOs</h3>
                <p className="text-gray-500 text-xs">
                  {totalFiles} file{totalFiles !== 1 ? 's' : ''} in {folderCount} folder{folderCount !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {scannedAt && (
                  <span className="text-xs text-gray-500 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatDate(scannedAt)}
                  </span>
                )}
                <button
                  onClick={rescan}
                  disabled={isScanning}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded text-sm"
                >
                  <RefreshCw className={`w-4 h-4 ${isScanning ? 'animate-spin' : ''}`} />
                  Rescan
                </button>
              </div>
            </div>

            <div className="overflow-y-auto p-3 max-h-[calc(100vh-300px)]">
              {folderEntries.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <FileText className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No TODO.md files found</p>
                  <p className="text-xs mt-1">Create TODO.md files in subfolders</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {folderEntries.map(([path, folder]) => {
                    const isExpanded = expandedFolders.has(path);
                    return (
                      <div
                        key={path}
                        className="bg-gray-750 border border-gray-700 rounded-lg overflow-hidden"
                      >
                        <div
                          className="p-3 cursor-pointer hover:bg-gray-700 flex items-center gap-3"
                          onClick={() => toggleFolder(path)}
                        >
                          <button className="text-gray-500">
                            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </button>
                          <FileText className="w-4 h-4 text-blue-400" />
                          <span className="text-white font-medium text-sm">{folder.name}</span>
                          <span className="text-gray-600 text-xs font-mono">{path}</span>
                        </div>

                        {isExpanded && (
                          <div className="border-t border-gray-700 p-4 bg-gray-800">
                            <pre className="text-gray-300 text-sm whitespace-pre-wrap font-mono leading-relaxed">
                              {folder.content || '(Empty TODO.md file)'}
                            </pre>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <FolderOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Select a folder to view TODOs</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
