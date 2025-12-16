'use client';

import { useState, useEffect } from 'react';
import { FolderTree, File, Folder, Plus, Edit2, Trash2, Check, X, ChevronRight, ChevronDown, FolderOpen, Save } from 'lucide-react';

interface ProjectPath {
  id: string;
  project_id: string;
  path: string;
  label: string;
  created_at: string;
}

interface StructureItem {
  id: string;
  project_path: string;
  path: string;
  name: string;
  type: 'file' | 'folder';
  status: 'active' | 'deprecated' | 'abandoned' | 'wip';
  purpose?: string;
  notes?: string;
  parent_path?: string;
  created_at: string;
  updated_at: string;
}

interface StructureTabProps {
  projectPath: string;
  projectId: string;
}

const STATUS_STYLES = {
  active: 'bg-green-600/20 text-green-400',
  deprecated: 'bg-yellow-600/20 text-yellow-400',
  abandoned: 'bg-red-600/20 text-red-400',
  wip: 'bg-blue-600/20 text-blue-400',
};

const STATUS_LABELS = {
  active: 'Active',
  deprecated: 'Deprecated',
  abandoned: 'Abandoned',
  wip: 'WIP',
};

export default function StructureTab({ projectPath, projectId }: StructureTabProps) {
  // Project paths (folders belonging to this project)
  const [projectPaths, setProjectPaths] = useState<ProjectPath[]>([]);
  const [selectedPath, setSelectedPath] = useState<ProjectPath | null>(null);
  const [showAddPath, setShowAddPath] = useState(false);
  const [editingPath, setEditingPath] = useState<ProjectPath | null>(null);
  const [pathFormData, setPathFormData] = useState({ path: '', label: '' });

  // Structure items for the selected folder
  const [items, setItems] = useState<StructureItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [showItemForm, setShowItemForm] = useState(false);
  const [editingItem, setEditingItem] = useState<StructureItem | null>(null);
  const [itemFormData, setItemFormData] = useState({
    path: '',
    name: '',
    type: 'file' as 'file' | 'folder',
    status: 'active' as StructureItem['status'],
    purpose: '',
    notes: '',
    parent_path: '',
  });

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
        // Auto-select the main project path if it exists
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

  const fetchStructure = async (path: string) => {
    try {
      const response = await fetch(`/api/susan/structures?project=${encodeURIComponent(path)}`);
      const data = await response.json();
      if (data.success) {
        setItems(data.structures || []);
        // Auto-expand root folders
        const rootFolders = (data.structures || [])
          .filter((s: StructureItem) => s.type === 'folder' && !s.parent_path)
          .map((s: StructureItem) => s.path);
        setExpandedFolders(new Set(rootFolders));
      }
    } catch (error) {
      console.error('Error fetching structure:', error);
    }
  };

  // Project Path CRUD
  const handleAddPath = async () => {
    if (!pathFormData.path || !pathFormData.label) return;
    try {
      const response = await fetch('/api/project-paths', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          ...pathFormData,
        }),
      });
      if (response.ok) {
        fetchProjectPaths();
        resetPathForm();
      }
    } catch (error) {
      console.error('Error adding path:', error);
    }
  };

  const handleUpdatePath = async () => {
    if (!editingPath) return;
    try {
      const response = await fetch('/api/project-paths', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingPath.id,
          label: pathFormData.label,
        }),
      });
      if (response.ok) {
        fetchProjectPaths();
        resetPathForm();
      }
    } catch (error) {
      console.error('Error updating path:', error);
    }
  };

  const handleDeletePath = async (path: ProjectPath) => {
    if (!confirm(`Remove "${path.label}" from this project?`)) return;
    try {
      await fetch(`/api/project-paths?id=${path.id}`, { method: 'DELETE' });
      fetchProjectPaths();
      if (selectedPath?.id === path.id) {
        setSelectedPath(null);
        setItems([]);
      }
    } catch (error) {
      console.error('Error deleting path:', error);
    }
  };

  const startEditPath = (path: ProjectPath) => {
    setEditingPath(path);
    setPathFormData({ path: path.path, label: path.label });
    setShowAddPath(true);
  };

  const resetPathForm = () => {
    setShowAddPath(false);
    setEditingPath(null);
    setPathFormData({ path: '', label: '' });
  };

  // Structure Item CRUD
  const handleSubmitItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPath) return;

    try {
      const url = editingItem
        ? `/api/susan/structure/${editingItem.id}`
        : '/api/susan/structure';
      const method = editingItem ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...itemFormData,
          project_path: selectedPath.path,
        }),
      });

      if (response.ok) {
        fetchStructure(selectedPath.path);
        resetItemForm();
      }
    } catch (error) {
      console.error('Error saving structure item:', error);
    }
  };

  const handleDeleteItem = async (item: StructureItem) => {
    if (!confirm(`Delete ${item.type} "${item.name}"?`)) return;
    try {
      await fetch(`/api/susan/structure/${item.id}`, { method: 'DELETE' });
      if (selectedPath) fetchStructure(selectedPath.path);
    } catch (error) {
      console.error('Error deleting:', error);
    }
  };

  const handleEditItem = (item: StructureItem) => {
    setEditingItem(item);
    setItemFormData({
      path: item.path,
      name: item.name,
      type: item.type,
      status: item.status,
      purpose: item.purpose || '',
      notes: item.notes || '',
      parent_path: item.parent_path || '',
    });
    setShowItemForm(true);
  };

  const resetItemForm = () => {
    setShowItemForm(false);
    setEditingItem(null);
    setItemFormData({
      path: '',
      name: '',
      type: 'file',
      status: 'active',
      purpose: '',
      notes: '',
      parent_path: '',
    });
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

  // Build tree structure
  const buildTree = () => {
    const rootItems = items.filter(item => !item.parent_path);
    return rootItems.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  };

  const getChildren = (parentPath: string) => {
    return items
      .filter(item => item.parent_path === parentPath)
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
  };

  const renderItem = (item: StructureItem, depth: number = 0) => {
    const children = getChildren(item.path);
    const hasChildren = children.length > 0;
    const isExpanded = expandedFolders.has(item.path);

    return (
      <div key={item.id}>
        <div
          className="flex items-center gap-2 py-1.5 px-2 hover:bg-gray-700 rounded group"
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
        >
          {item.type === 'folder' ? (
            <button onClick={() => toggleFolder(item.path)} className="text-gray-500 hover:text-white">
              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          ) : (
            <span className="w-4" />
          )}

          {item.type === 'folder' ? (
            <Folder className="w-4 h-4 text-yellow-400" />
          ) : (
            <File className="w-4 h-4 text-gray-400" />
          )}

          <span className={`font-mono text-sm ${
            item.status === 'deprecated' || item.status === 'abandoned'
              ? 'text-gray-500 line-through'
              : 'text-white'
          }`}>
            {item.name}
          </span>

          <span className={`px-1.5 py-0.5 rounded text-[10px] ${STATUS_STYLES[item.status]}`}>
            {STATUS_LABELS[item.status]}
          </span>

          {item.purpose && (
            <span className="text-gray-500 text-xs truncate max-w-[150px]">
              - {item.purpose}
            </span>
          )}

          <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100">
            <button
              onClick={() => handleEditItem(item)}
              className="p-1 text-gray-500 hover:text-white hover:bg-gray-600 rounded"
            >
              <Edit2 className="w-3 h-3" />
            </button>
            <button
              onClick={() => handleDeleteItem(item)}
              className="p-1 text-gray-500 hover:text-red-400 hover:bg-gray-600 rounded"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>

        {item.type === 'folder' && isExpanded && hasChildren && (
          <div>{children.map(child => renderItem(child, depth + 1))}</div>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin text-2xl">⏳</div>
      </div>
    );
  }

  return (
    <div className="flex h-full gap-4">
      {/* Left Panel - Project Folders */}
      <div className="w-64 flex-shrink-0 bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
        <div className="p-3 border-b border-gray-700 flex items-center justify-between">
          <h3 className="text-white font-semibold text-sm">Project Folders</h3>
          <button
            onClick={() => { resetPathForm(); setShowAddPath(true); }}
            className="p-1 text-blue-400 hover:bg-gray-700 rounded"
            title="Add folder"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Add/Edit Path Form */}
        {showAddPath && (
          <div className="p-3 border-b border-gray-700 bg-gray-750 space-y-2">
            <input
              type="text"
              placeholder="Label (e.g. Chad)"
              value={pathFormData.label}
              onChange={(e) => setPathFormData(p => ({ ...p, label: e.target.value }))}
              className="w-full px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-white text-sm"
            />
            {!editingPath && (
              <input
                type="text"
                placeholder="Path (e.g. /var/www/NextBid_Dev/chad-5401)"
                value={pathFormData.path}
                onChange={(e) => setPathFormData(p => ({ ...p, path: e.target.value }))}
                className="w-full px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-white text-sm font-mono"
              />
            )}
            <div className="flex gap-2">
              <button
                onClick={editingPath ? handleUpdatePath : handleAddPath}
                className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm"
              >
                {editingPath ? 'Update' : 'Add'}
              </button>
              <button
                onClick={resetPathForm}
                className="px-3 py-1.5 text-gray-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Folder List */}
        <div className="overflow-y-auto max-h-[calc(100vh-300px)]">
          {projectPaths.length === 0 ? (
            <div className="p-4 text-center text-gray-500 text-sm">
              <FolderOpen className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No folders linked</p>
              <p className="text-xs mt-1">Add folders that belong to this project</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-700">
              {projectPaths.map(path => (
                <div
                  key={path.id}
                  className={`p-3 cursor-pointer group ${
                    selectedPath?.id === path.id
                      ? 'bg-blue-600/20 border-l-2 border-blue-500'
                      : 'hover:bg-gray-750'
                  }`}
                  onClick={() => setSelectedPath(path)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FolderOpen className={`w-4 h-4 ${
                        selectedPath?.id === path.id ? 'text-blue-400' : 'text-yellow-400'
                      }`} />
                      <span className="text-white font-medium text-sm">{path.label}</span>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                      <button
                        onClick={(e) => { e.stopPropagation(); startEditPath(path); }}
                        className="p-1 text-gray-400 hover:text-white hover:bg-gray-600 rounded"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeletePath(path); }}
                        className="p-1 text-gray-400 hover:text-red-400 hover:bg-gray-600 rounded"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
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

      {/* Right Panel - Structure */}
      <div className="flex-1 bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
        {selectedPath ? (
          <>
            {/* Header */}
            <div className="p-3 border-b border-gray-700 flex items-center justify-between">
              <div>
                <h3 className="text-white font-semibold text-sm">{selectedPath.label} Structure</h3>
                <p className="text-gray-500 text-xs font-mono">{selectedPath.path}</p>
              </div>
              <button
                onClick={() => { resetItemForm(); setShowItemForm(true); }}
                className="flex items-center gap-1 px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm"
              >
                <Plus className="w-4 h-4" />
                Add Item
              </button>
            </div>

            {/* Item Form */}
            {showItemForm && (
              <div className="p-3 border-b border-gray-700 bg-gray-750">
                <form onSubmit={handleSubmitItem} className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Name"
                      value={itemFormData.name}
                      onChange={(e) => setItemFormData(p => ({ ...p, name: e.target.value }))}
                      required
                      className="px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                    />
                    <input
                      type="text"
                      placeholder="Path (e.g. src/routes)"
                      value={itemFormData.path}
                      onChange={(e) => setItemFormData(p => ({ ...p, path: e.target.value }))}
                      required
                      className="px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-white text-sm font-mono"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <select
                      value={itemFormData.type}
                      onChange={(e) => setItemFormData(p => ({ ...p, type: e.target.value as 'file' | 'folder' }))}
                      className="px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                    >
                      <option value="file">File</option>
                      <option value="folder">Folder</option>
                    </select>
                    <select
                      value={itemFormData.status}
                      onChange={(e) => setItemFormData(p => ({ ...p, status: e.target.value as StructureItem['status'] }))}
                      className="px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                    >
                      <option value="active">Active</option>
                      <option value="wip">WIP</option>
                      <option value="deprecated">Deprecated</option>
                      <option value="abandoned">Abandoned</option>
                    </select>
                    <input
                      type="text"
                      placeholder="Parent path"
                      value={itemFormData.parent_path}
                      onChange={(e) => setItemFormData(p => ({ ...p, parent_path: e.target.value }))}
                      className="px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-white text-sm font-mono"
                    />
                  </div>
                  <input
                    type="text"
                    placeholder="Purpose - what is this for?"
                    value={itemFormData.purpose}
                    onChange={(e) => setItemFormData(p => ({ ...p, purpose: e.target.value }))}
                    className="w-full px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                  />
                  <div className="flex gap-2">
                    <button type="submit" className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm">
                      {editingItem ? 'Update' : 'Add'}
                    </button>
                    <button type="button" onClick={resetItemForm} className="px-3 py-1.5 text-gray-400 hover:text-white">
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Status Legend */}
            <div className="px-3 py-2 border-b border-gray-700 flex items-center gap-3 text-xs">
              {Object.entries(STATUS_LABELS).map(([key, label]) => (
                <span key={key} className={`px-2 py-0.5 rounded ${STATUS_STYLES[key as keyof typeof STATUS_STYLES]}`}>
                  {label}
                </span>
              ))}
            </div>

            {/* Structure Tree */}
            <div className="overflow-y-auto p-2 max-h-[calc(100vh-350px)]">
              {items.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <FolderTree className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No structure documented</p>
                  <p className="text-xs mt-1">Add files and folders to document this project</p>
                </div>
              ) : (
                <div>{buildTree().map(item => renderItem(item))}</div>
              )}
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <FolderOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Select a folder to view its structure</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
