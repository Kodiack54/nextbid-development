'use client';

import { useState, useEffect } from 'react';
import { FolderTree, File, Folder, Plus, Edit2, Trash2, Check, X, ChevronRight, ChevronDown } from 'lucide-react';

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
  wip: 'Work in Progress',
};

export default function StructureTab({ projectPath }: StructureTabProps) {
  const [items, setItems] = useState<StructureItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<StructureItem | null>(null);
  const [formData, setFormData] = useState({
    path: '',
    name: '',
    type: 'file' as 'file' | 'folder',
    status: 'active' as StructureItem['status'],
    purpose: '',
    notes: '',
    parent_path: '',
  });

  useEffect(() => {
    fetchStructure();
  }, [projectPath]);

  const fetchStructure = async () => {
    try {
      const response = await fetch(`/api/susan/structures?project=${encodeURIComponent(projectPath)}`);
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
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingItem
        ? `/api/susan/structure/${editingItem.id}`
        : '/api/susan/structure';
      const method = editingItem ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          project_path: projectPath,
        }),
      });

      if (response.ok) {
        fetchStructure();
        resetForm();
      }
    } catch (error) {
      console.error('Error saving structure item:', error);
    }
  };

  const handleDelete = async (item: StructureItem) => {
    if (!confirm(`Delete ${item.type} "${item.name}"?`)) return;
    try {
      await fetch(`/api/susan/structure/${item.id}`, { method: 'DELETE' });
      fetchStructure();
    } catch (error) {
      console.error('Error deleting:', error);
    }
  };

  const handleEdit = (item: StructureItem) => {
    setEditingItem(item);
    setFormData({
      path: item.path,
      name: item.name,
      type: item.type,
      status: item.status,
      purpose: item.purpose || '',
      notes: item.notes || '',
      parent_path: item.parent_path || '',
    });
    setShowForm(true);
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingItem(null);
    setFormData({
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
      // Folders first, then files
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
          className={`flex items-center gap-2 py-1.5 px-2 hover:bg-gray-750 rounded group`}
          style={{ paddingLeft: `${depth * 20 + 8}px` }}
        >
          {/* Expand/Collapse for folders */}
          {item.type === 'folder' ? (
            <button
              onClick={() => toggleFolder(item.path)}
              className="text-gray-500 hover:text-white"
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>
          ) : (
            <span className="w-4" />
          )}

          {/* Icon */}
          {item.type === 'folder' ? (
            <Folder className="w-4 h-4 text-yellow-400" />
          ) : (
            <File className="w-4 h-4 text-gray-400" />
          )}

          {/* Name */}
          <span className={`font-mono text-sm ${
            item.status === 'deprecated' || item.status === 'abandoned'
              ? 'text-gray-500 line-through'
              : 'text-white'
          }`}>
            {item.name}
          </span>

          {/* Status badge */}
          <span className={`px-1.5 py-0.5 rounded text-xs ${STATUS_STYLES[item.status]}`}>
            {STATUS_LABELS[item.status]}
          </span>

          {/* Purpose (truncated) */}
          {item.purpose && (
            <span className="text-gray-500 text-xs truncate max-w-[200px]">
              - {item.purpose}
            </span>
          )}

          {/* Actions */}
          <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100">
            <button
              onClick={() => handleEdit(item)}
              className="p-1 text-gray-500 hover:text-white hover:bg-gray-700 rounded"
            >
              <Edit2 className="w-3 h-3" />
            </button>
            <button
              onClick={() => handleDelete(item)}
              className="p-1 text-gray-500 hover:text-red-400 hover:bg-gray-700 rounded"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Children */}
        {item.type === 'folder' && isExpanded && hasChildren && (
          <div>
            {children.map(child => renderItem(child, depth + 1))}
          </div>
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
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Project Structure</h2>
        <button
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm"
        >
          <Plus className="w-4 h-4" />
          Add Item
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 mb-4">
          <form onSubmit={handleSubmit}>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="Name (e.g., components)"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  required
                  className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                />
                <input
                  type="text"
                  placeholder="Path (e.g., src/components)"
                  value={formData.path}
                  onChange={(e) => setFormData(prev => ({ ...prev, path: e.target.value }))}
                  required
                  className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:outline-none font-mono text-sm"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <select
                  value={formData.type}
                  onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as 'file' | 'folder' }))}
                  className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                >
                  <option value="file">File</option>
                  <option value="folder">Folder</option>
                </select>

                <select
                  value={formData.status}
                  onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as StructureItem['status'] }))}
                  className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                >
                  <option value="active">Active</option>
                  <option value="wip">Work in Progress</option>
                  <option value="deprecated">Deprecated</option>
                  <option value="abandoned">Abandoned</option>
                </select>

                <input
                  type="text"
                  placeholder="Parent path (optional)"
                  value={formData.parent_path}
                  onChange={(e) => setFormData(prev => ({ ...prev, parent_path: e.target.value }))}
                  className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:outline-none font-mono text-sm"
                />
              </div>

              <input
                type="text"
                placeholder="Purpose (what is this for?)"
                value={formData.purpose}
                onChange={(e) => setFormData(prev => ({ ...prev, purpose: e.target.value }))}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:outline-none"
              />

              <textarea
                placeholder="Notes (additional details, warnings, etc.)"
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                rows={2}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:outline-none resize-none"
              />

              <div className="flex gap-2">
                <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg">
                  {editingItem ? 'Update' : 'Add'}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 text-gray-400 hover:text-white"
                >
                  Cancel
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Status Legend */}
      <div className="flex items-center gap-4 mb-4 text-xs">
        {Object.entries(STATUS_LABELS).map(([key, label]) => (
          <span key={key} className={`px-2 py-0.5 rounded ${STATUS_STYLES[key as keyof typeof STATUS_STYLES]}`}>
            {label}
          </span>
        ))}
      </div>

      {/* Structure Tree */}
      {items.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <FolderTree className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No structure documented yet</p>
          <p className="text-sm mt-1">Add folders and files to track what's in this project</p>
        </div>
      ) : (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-2">
          {buildTree().map(item => renderItem(item))}
        </div>
      )}
    </div>
  );
}
