'use client';

import { useState, useEffect } from 'react';
import { Code2, Plus, Edit2, Trash2, FolderOpen, X, ChevronDown, ChevronRight, ChevronUp, Search, RefreshCw } from 'lucide-react';

interface ProjectPath {
  id: string;
  project_id: string;
  path: string;
  label: string;
  sort_order: number;
  created_at: string;
}

interface Convention {
  id: string;
  project_path: string;
  category: string;
  name: string;
  pattern: string;
  description: string;
  examples?: string[];
  created_at: string;
  updated_at: string;
}

interface CodeChangesTabProps {
  projectPath: string;
  projectId: string;
}

const CATEGORY_CONFIG: Record<string, { label: string; color: string; description: string }> = {
  naming: {
    label: 'Naming Conventions',
    color: 'bg-blue-600/20 text-blue-400',
    description: 'camelCase, PascalCase, snake_case, file naming patterns',
  },
  structure: {
    label: 'File Structure',
    color: 'bg-green-600/20 text-green-400',
    description: 'Directory organization, file placement, component structure',
  },
  database: {
    label: 'Database Patterns',
    color: 'bg-orange-600/20 text-orange-400',
    description: 'Table prefixes, column naming, RLS patterns',
  },
  api: {
    label: 'API Patterns',
    color: 'bg-purple-600/20 text-purple-400',
    description: 'Endpoint naming, request/response formats, error handling',
  },
  component: {
    label: 'Component Patterns',
    color: 'bg-pink-600/20 text-pink-400',
    description: 'React patterns, props, state management',
  },
  quirks: {
    label: 'Quirks & Gotchas',
    color: 'bg-red-600/20 text-red-400',
    description: 'Things that might trip you up, edge cases, workarounds',
  },
};

export default function CodeChangesTab({ projectPath, projectId }: CodeChangesTabProps) {
  const [projectPaths, setProjectPaths] = useState<ProjectPath[]>([]);
  const [selectedPath, setSelectedPath] = useState<ProjectPath | null>(null);
  const [conventions, setConventions] = useState<Convention[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingConvention, setEditingConvention] = useState<Convention | null>(null);
  const [formData, setFormData] = useState({
    category: 'naming',
    name: '',
    pattern: '',
    description: '',
    examples: '',
  });

  useEffect(() => {
    fetchProjectPaths();
  }, [projectId]);

  useEffect(() => {
    if (selectedPath) {
      fetchConventions(selectedPath.path);
    }
  }, [selectedPath]);

  const fetchProjectPaths = async () => {
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

  const fetchConventions = async (path: string) => {
    setIsLoading(true);
    try {
      const cleanPath = path.startsWith('/') ? path.slice(1) : path;
      const response = await fetch(`/api/clair/conventions/${cleanPath}`);
      const data = await response.json();
      if (data.success) {
        setConventions(data.conventions || []);
      }
    } catch (error) {
      console.error('Error fetching conventions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.description || !selectedPath) return;
    try {
      const cleanPath = selectedPath.path.startsWith('/') ? selectedPath.path.slice(1) : selectedPath.path;
      const url = editingConvention
        ? `/api/clair/conventions/${cleanPath}/${editingConvention.id}`
        : `/api/clair/conventions/${cleanPath}`;
      const method = editingConvention ? 'PATCH' : 'POST';

      const payload = {
        ...formData,
        examples: formData.examples ? formData.examples.split('\n').filter(e => e.trim()) : [],
      };

      await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      resetForm();
      fetchConventions(selectedPath.path);
    } catch (error) {
      console.error('Error saving convention:', error);
    }
  };

  const handleDelete = async (convention: Convention) => {
    if (!confirm('Delete this convention?') || !selectedPath) return;
    try {
      const cleanPath = selectedPath.path.startsWith('/') ? selectedPath.path.slice(1) : selectedPath.path;
      await fetch(`/api/clair/conventions/${cleanPath}/${convention.id}`, { method: 'DELETE' });
      fetchConventions(selectedPath.path);
    } catch (error) {
      console.error('Error deleting convention:', error);
    }
  };

  const startEdit = (convention: Convention) => {
    setEditingConvention(convention);
    setFormData({
      category: convention.category,
      name: convention.name,
      pattern: convention.pattern || '',
      description: convention.description,
      examples: convention.examples?.join('\n') || '',
    });
    setShowAddForm(true);
  };

  const resetForm = () => {
    setShowAddForm(false);
    setEditingConvention(null);
    setFormData({ category: 'naming', name: '', pattern: '', description: '', examples: '' });
  };

  const toggleExpand = (id: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const grouped = conventions.reduce((acc, conv) => {
    if (!acc[conv.category]) acc[conv.category] = [];
    acc[conv.category].push(conv);
    return acc;
  }, {} as Record<string, Convention[]>);

  const filteredConventions = conventions.filter(conv => {
    if (activeCategory && conv.category !== activeCategory) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return conv.name.toLowerCase().includes(q) || conv.description.toLowerCase().includes(q);
    }
    return true;
  });

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
                      ? 'bg-cyan-600/20 border-l-2 border-cyan-500'
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
                      selectedPath?.id === path.id ? 'text-cyan-400' : 'text-yellow-400'
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

      {/* Right Panel - Conventions */}
      <div className="flex-1 bg-gray-800 border border-gray-700 rounded-lg overflow-hidden flex flex-col">
        {selectedPath ? (
          <>
            {/* Header */}
            <div className="p-3 border-b border-gray-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Code2 className="w-5 h-5 text-cyan-400" />
                <h3 className="text-white font-semibold">{selectedPath.label} Coding Conventions</h3>
                <span className="text-gray-500 text-sm">({conventions.length} rules)</span>
              </div>
              <button
                onClick={() => setShowAddForm(true)}
                className="flex items-center gap-1 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded text-sm"
              >
                <Plus className="w-4 h-4" />
                Add Convention
              </button>
            </div>

            {/* Info Banner */}
            <div className="px-4 py-2 bg-cyan-900/20 border-b border-gray-700 text-sm text-cyan-300">
              <Code2 className="w-4 h-4 inline mr-2" />
              Coding conventions help Claude understand project patterns and maintain consistency
            </div>

            {/* Category Tabs */}
            <div className="flex px-3 py-2 gap-2 border-b border-gray-700 overflow-x-auto">
              <button
                onClick={() => setActiveCategory(null)}
                className={`px-3 py-1.5 rounded text-xs whitespace-nowrap ${
                  activeCategory === null ? 'bg-cyan-600 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                }`}
              >
                All ({conventions.length})
              </button>
              {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => (
                <button
                  key={key}
                  onClick={() => setActiveCategory(key)}
                  className={`px-3 py-1.5 rounded text-xs whitespace-nowrap ${
                    activeCategory === key ? cfg.color.replace('/20', '') : cfg.color
                  }`}
                >
                  {cfg.label} ({grouped[key]?.length || 0})
                </button>
              ))}
            </div>

            {/* Add/Edit Form */}
            {showAddForm && (
              <div className="p-4 border-b border-gray-700 bg-gray-750 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-white font-medium">
                    {editingConvention ? 'Edit Convention' : 'New Convention'}
                  </h4>
                  <button onClick={resetForm} className="text-gray-500 hover:text-white">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                    className="px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                  >
                    {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => (
                      <option key={key} value={key}>{cfg.label}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    placeholder="Convention name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                  />
                </div>
                <input
                  type="text"
                  placeholder="Pattern (e.g., camelCase, snake_case)"
                  value={formData.pattern}
                  onChange={(e) => setFormData(prev => ({ ...prev, pattern: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm font-mono"
                />
                <textarea
                  placeholder="Description - explain the convention..."
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm resize-none"
                />
                <textarea
                  placeholder="Examples (one per line)"
                  value={formData.examples}
                  onChange={(e) => setFormData(prev => ({ ...prev, examples: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm font-mono resize-none"
                />
                <div className="flex justify-end gap-2">
                  <button onClick={resetForm} className="px-3 py-1.5 text-gray-400 hover:text-white">Cancel</button>
                  <button onClick={handleSubmit} className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded text-sm">
                    {editingConvention ? 'Update' : 'Save'}
                  </button>
                </div>
              </div>
            )}

            {/* Search */}
            <div className="p-3 border-b border-gray-700">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  placeholder="Search conventions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 text-sm"
                />
              </div>
            </div>

            {/* Conventions List */}
            <div className="flex-1 overflow-y-auto p-3">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="w-6 h-6 text-cyan-400 animate-spin" />
                </div>
              ) : filteredConventions.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Code2 className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p>No conventions documented</p>
                  <p className="text-sm mt-1">Add naming, patterns, and quirks for Claude to follow</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredConventions.map(conv => {
                    const cfg = CATEGORY_CONFIG[conv.category] || CATEGORY_CONFIG.quirks;
                    const isExpanded = expandedItems.has(conv.id);
                    return (
                      <div key={conv.id} className="bg-gray-750 border border-gray-700 rounded-lg overflow-hidden group">
                        <div
                          className="p-3 cursor-pointer hover:bg-gray-700 flex items-start gap-3"
                          onClick={() => toggleExpand(conv.id)}
                        >
                          <button className="text-gray-500 mt-0.5">
                            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </button>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-0.5 rounded text-xs ${cfg.color}`}>{cfg.label}</span>
                              <span className="text-white font-medium">{conv.name}</span>
                              {conv.pattern && (
                                <code className="text-xs bg-gray-700 px-1.5 py-0.5 rounded text-cyan-300 font-mono">
                                  {conv.pattern}
                                </code>
                              )}
                            </div>
                            {!isExpanded && (
                              <p className="text-gray-400 text-sm truncate mt-1">{conv.description}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                            <button
                              onClick={(e) => { e.stopPropagation(); startEdit(conv); }}
                              className="p-1 text-gray-500 hover:text-white hover:bg-gray-600 rounded"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDelete(conv); }}
                              className="p-1 text-gray-500 hover:text-red-400 hover:bg-gray-600 rounded"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="px-10 pb-3 border-t border-gray-700 pt-3 space-y-3">
                            <p className="text-gray-300 text-sm">{conv.description}</p>
                            {conv.examples && conv.examples.length > 0 && (
                              <div>
                                <p className="text-xs text-gray-500 mb-1">Examples:</p>
                                <div className="bg-gray-800 rounded p-2 space-y-1">
                                  {conv.examples.map((ex, i) => (
                                    <code key={i} className="block text-xs text-cyan-300 font-mono">{ex}</code>
                                  ))}
                                </div>
                              </div>
                            )}
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
              <Code2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Select a folder to view conventions</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
