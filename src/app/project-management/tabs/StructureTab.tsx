'use client';

import { useState, useEffect } from 'react';
import { FolderTree, File, Folder, ChevronRight, ChevronDown, ChevronUp, FolderOpen, RefreshCw, Edit2, Check, X } from 'lucide-react';

interface ProjectPath {
  id: string;
  project_id: string;
  path: string;
  label: string;
  sort_order: number;
  created_at: string;
}

interface TreeNode {
  name: string;
  path: string;
  type: 'directory' | 'file';
  extension?: string;
  description?: string;
  children?: TreeNode[];
  truncated?: boolean;
  error?: string;
}

interface StructureTabProps {
  projectPath: string;
  projectId: string;
}

export default function StructureTab({ projectPath, projectId }: StructureTabProps) {
  const [projectPaths, setProjectPaths] = useState<ProjectPath[]>([]);
  const [selectedPath, setSelectedPath] = useState<ProjectPath | null>(null);
  const [tree, setTree] = useState<TreeNode | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [editingPath, setEditingPath] = useState<string | null>(null);
  const [editDescription, setEditDescription] = useState('');
  const [descriptionCount, setDescriptionCount] = useState(0);

  // Fetch project paths
  useEffect(() => {
    fetchProjectPaths();
  }, [projectId]);

  // Fetch structure when a folder is selected
  useEffect(() => {
    if (selectedPath) {
      fetchStructure(selectedPath.path);
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

  const moveFolder = async (folderId: string, direction: 'up' | 'down') => {
    const currentIndex = projectPaths.findIndex(p => p.id === folderId);
    if (currentIndex === -1) return;
    const swapIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (swapIndex < 0 || swapIndex >= projectPaths.length) return;
    const currentFolder = projectPaths[currentIndex];
    const swapFolder = projectPaths[swapIndex];
    const newPaths = [...projectPaths];
    newPaths[currentIndex] = { ...swapFolder, sort_order: currentFolder.sort_order };
    newPaths[swapIndex] = { ...currentFolder, sort_order: swapFolder.sort_order };
    newPaths.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    setProjectPaths(newPaths);
    try {
      await Promise.all([
        fetch('/api/project-paths', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: currentFolder.id, sort_order: swapFolder.sort_order || swapIndex }) }),
        fetch('/api/project-paths', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: swapFolder.id, sort_order: currentFolder.sort_order || currentIndex }) }),
      ]);
    } catch (error) { console.error('Error moving folder:', error); fetchProjectPaths(); }
  };

  const fetchStructure = async (path: string) => {
    setIsLoading(true);
    try {
      // Remove leading slash for URL path segments
      const cleanPath = path.startsWith('/') ? path.slice(1) : path;
      const response = await fetch(`/api/clair/structure/${cleanPath}?depth=4`);
      const data = await response.json();
      if (data.success) {
        setTree(data.tree);
        setDescriptionCount(data.descriptionCount || 0);
        // Auto-expand first level
        if (data.tree?.children) {
          const firstLevel = data.tree.children
            .filter((c: TreeNode) => c.type === 'directory')
            .map((c: TreeNode) => c.path);
          setExpandedFolders(new Set([data.tree.path, ...firstLevel]));
        }
      }
    } catch (error) {
      console.error('Error fetching structure:', error);
    } finally {
      setIsLoading(false);
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

  const startEditDescription = (node: TreeNode) => {
    setEditingPath(node.path);
    setEditDescription(node.description || '');
  };

  const saveDescription = async (folderPath: string) => {
    if (!selectedPath) return;
    try {
      const cleanPath = selectedPath.path.startsWith('/') ? selectedPath.path.slice(1) : selectedPath.path;
      await fetch(`/api/clair/structure/${cleanPath}/describe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folder_path: folderPath,
          description: editDescription,
        }),
      });
      setEditingPath(null);
      fetchStructure(selectedPath.path);
    } catch (error) {
      console.error('Error saving description:', error);
    }
  };

  const getFileIcon = (extension?: string) => {
    const iconClass = "w-4 h-4";
    const colors: Record<string, string> = {
      '.tsx': 'text-blue-400',
      '.ts': 'text-blue-300',
      '.js': 'text-yellow-400',
      '.jsx': 'text-yellow-300',
      '.css': 'text-pink-400',
      '.json': 'text-green-400',
      '.md': 'text-gray-400',
      '.sql': 'text-orange-400',
      '.sh': 'text-green-300',
    };
    return <File className={`${iconClass} ${colors[extension || ''] || 'text-gray-500'}`} />;
  };

  const renderNode = (node: TreeNode, depth: number = 0) => {
    const isExpanded = expandedFolders.has(node.path);
    const isEditing = editingPath === node.path;
    const hasChildren = node.children && node.children.length > 0;

    return (
      <div key={node.path}>
        <div
          className="flex items-center gap-2 py-1 px-2 hover:bg-gray-700/50 rounded group"
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
        >
          {node.type === 'directory' ? (
            <button
              onClick={() => toggleFolder(node.path)}
              className="text-gray-500 hover:text-white"
            >
              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          ) : (
            <span className="w-4" />
          )}

          {node.type === 'directory' ? (
            <Folder className={`w-4 h-4 ${isExpanded ? 'text-yellow-400' : 'text-yellow-600'}`} />
          ) : (
            getFileIcon(node.extension)
          )}

          <span className="font-mono text-sm text-white">{node.name}</span>

          {node.truncated && (
            <span className="text-xs text-gray-500">(truncated)</span>
          )}

          {/* Description */}
          {node.type === 'directory' && (
            isEditing ? (
              <div className="flex items-center gap-1 ml-2 flex-1">
                <input
                  type="text"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="flex-1 px-2 py-0.5 bg-gray-700 border border-gray-600 rounded text-xs text-white"
                  placeholder="Description..."
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveDescription(node.path);
                    if (e.key === 'Escape') setEditingPath(null);
                  }}
                />
                <button onClick={() => saveDescription(node.path)} className="text-green-400 hover:text-green-300">
                  <Check className="w-3 h-3" />
                </button>
                <button onClick={() => setEditingPath(null)} className="text-gray-500 hover:text-white">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <>
                {node.description && (
                  <span className="text-gray-500 text-xs ml-2">- {node.description}</span>
                )}
                <button
                  onClick={() => startEditDescription(node)}
                  className="ml-auto p-1 text-gray-600 hover:text-white opacity-0 group-hover:opacity-100"
                  title="Add description"
                >
                  <Edit2 className="w-3 h-3" />
                </button>
              </>
            )
          )}
        </div>

        {node.type === 'directory' && isExpanded && hasChildren && (
          <div>
            {node.children!
              .sort((a, b) => {
                if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
                return a.name.localeCompare(b.name);
              })
              .map(child => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  if (isLoading && !tree) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin text-2xl">
          <RefreshCw className="w-6 h-6 text-blue-400" />
        </div>
      </div>
    );
  }

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
              {projectPaths.map((path, index) => (
                <div
                  key={path.id}
                  className={`p-3 cursor-pointer group ${
                    selectedPath?.id === path.id
                      ? 'bg-blue-600/20 border-l-2 border-blue-500'
                      : 'hover:bg-gray-750'
                  }`}
                  onClick={() => setSelectedPath(path)}
                >
                  <div className="flex items-center gap-2">
                    <div className="flex flex-col opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => { e.stopPropagation(); moveFolder(path.id, 'up'); }}
                        disabled={index === 0}
                        className={`p-0.5 rounded ${index === 0 ? 'text-gray-700' : 'text-gray-500 hover:text-white hover:bg-gray-600'}`}
                      ><ChevronUp className="w-3 h-3" /></button>
                      <button
                        onClick={(e) => { e.stopPropagation(); moveFolder(path.id, 'down'); }}
                        disabled={index === projectPaths.length - 1}
                        className={`p-0.5 rounded ${index === projectPaths.length - 1 ? 'text-gray-700' : 'text-gray-500 hover:text-white hover:bg-gray-600'}`}
                      ><ChevronDown className="w-3 h-3" /></button>
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

      {/* Right Panel - File Tree */}
      <div className="flex-1 bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
        {selectedPath && tree ? (
          <>
            <div className="p-3 border-b border-gray-700 flex items-center justify-between">
              <div>
                <h3 className="text-white font-semibold text-sm">{selectedPath.label} Structure</h3>
                <p className="text-gray-500 text-xs font-mono">{selectedPath.path}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500">{descriptionCount} descriptions</span>
                <button
                  onClick={() => fetchStructure(selectedPath.path)}
                  className="p-1 text-gray-400 hover:text-white hover:bg-gray-700 rounded"
                  title="Refresh"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto p-2 max-h-[calc(100vh-300px)]">
              {tree.error ? (
                <div className="text-center py-8 text-red-400">
                  <p className="text-sm">Error: {tree.error}</p>
                </div>
              ) : (
                renderNode(tree)
              )}
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <FolderTree className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Select a folder to view its structure</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
