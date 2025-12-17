'use client';

import { useState, useEffect } from 'react';
import { Plus, FileText, X, Edit2, Eye, FolderOpen, Search, RefreshCw, Trash2, BookOpen, Layers, Map, FileCode, ChevronUp, ChevronDown } from 'lucide-react';

interface ProjectPath {
  id: string;
  project_id: string;
  path: string;
  label: string;
  sort_order: number;
  created_at: string;
}

interface Doc {
  id: string;
  project_path: string;
  type: 'breakdown' | 'howto' | 'schematic' | 'reference';
  title: string;
  content: string;
  category?: string;
  created_at: string;
  updated_at: string;
}

interface DocsTabProps {
  projectPath: string;
  projectId: string;
}

const TYPE_CONFIG = {
  breakdown: {
    label: 'System Breakdown',
    icon: Layers,
    color: 'bg-blue-600/20 text-blue-400',
    activeColor: 'bg-blue-600 text-white',
    description: 'Architecture and component documentation',
  },
  howto: {
    label: 'How-To Guide',
    icon: BookOpen,
    color: 'bg-green-600/20 text-green-400',
    activeColor: 'bg-green-600 text-white',
    description: 'Step-by-step instructions',
  },
  schematic: {
    label: 'Schematic',
    icon: Map,
    color: 'bg-purple-600/20 text-purple-400',
    activeColor: 'bg-purple-600 text-white',
    description: 'Diagrams, flows, and relationships',
  },
  reference: {
    label: 'Reference',
    icon: FileCode,
    color: 'bg-orange-600/20 text-orange-400',
    activeColor: 'bg-orange-600 text-white',
    description: 'API docs, configurations, constants',
  },
};

type DocType = keyof typeof TYPE_CONFIG;

export default function DocsTab({ projectPath, projectId }: DocsTabProps) {
  const [projectPaths, setProjectPaths] = useState<ProjectPath[]>([]);
  const [selectedPath, setSelectedPath] = useState<ProjectPath | null>(null);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [grouped, setGrouped] = useState<Record<string, Doc[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<DocType>('breakdown');
  const [selectedDoc, setSelectedDoc] = useState<Doc | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingDoc, setEditingDoc] = useState<Doc | null>(null);
  const [formData, setFormData] = useState({
    type: 'breakdown' as DocType,
    title: '',
    content: '',
    category: '',
  });

  useEffect(() => {
    fetchProjectPaths();
  }, [projectId]);

  useEffect(() => {
    if (selectedPath) {
      fetchDocs(selectedPath.path);
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

  const fetchDocs = async (path: string) => {
    setIsLoading(true);
    try {
      const cleanPath = path.startsWith('/') ? path.slice(1) : path;
      const response = await fetch(`/api/clair/docs/${cleanPath}`);
      const data = await response.json();
      if (data.success) {
        setDocs(data.docs || []);
        // Group by type
        const g: Record<string, Doc[]> = {};
        (data.docs || []).forEach((doc: Doc) => {
          if (!g[doc.type]) g[doc.type] = [];
          g[doc.type].push(doc);
        });
        setGrouped(g);
      }
    } catch (error) {
      console.error('Error fetching docs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.title || !formData.content || !selectedPath) return;
    try {
      const cleanPath = selectedPath.path.startsWith('/') ? selectedPath.path.slice(1) : selectedPath.path;
      const url = editingDoc
        ? `/api/clair/docs/${cleanPath}/${editingDoc.id}`
        : `/api/clair/docs/${cleanPath}`;
      const method = editingDoc ? 'PATCH' : 'POST';

      await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      resetForm();
      fetchDocs(selectedPath.path);
    } catch (error) {
      console.error('Error saving doc:', error);
    }
  };

  const handleDelete = async (doc: Doc) => {
    if (!confirm('Delete this document?') || !selectedPath) return;
    try {
      const cleanPath = selectedPath.path.startsWith('/') ? selectedPath.path.slice(1) : selectedPath.path;
      await fetch(`/api/clair/docs/${cleanPath}/${doc.id}`, { method: 'DELETE' });
      if (selectedDoc?.id === doc.id) setSelectedDoc(null);
      fetchDocs(selectedPath.path);
    } catch (error) {
      console.error('Error deleting doc:', error);
    }
  };

  const startEdit = (doc: Doc) => {
    setEditingDoc(doc);
    setFormData({
      type: doc.type as DocType,
      title: doc.title,
      content: doc.content,
      category: doc.category || '',
    });
    setShowForm(true);
    setSelectedDoc(null);
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingDoc(null);
    setFormData({ type: activeTab, title: '', content: '', category: '' });
  };

  const currentDocs = (grouped[activeTab] || []).filter(doc => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return doc.title.toLowerCase().includes(q) || doc.content.toLowerCase().includes(q);
  });

  const config = TYPE_CONFIG[activeTab];
  const Icon = config.icon;

  // Doc viewer mode
  if (selectedDoc) {
    const docConfig = TYPE_CONFIG[selectedDoc.type as DocType];
    const DocIcon = docConfig.icon;
    return (
      <div className="flex h-full gap-4">
        {/* Left Panel - Project Folders */}
        <div className="w-64 flex-shrink-0 bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
          <div className="p-3 border-b border-gray-700">
            <button
              onClick={() => setSelectedDoc(null)}
              className="text-gray-400 hover:text-white text-sm flex items-center gap-1"
            >
              ← Back to docs
            </button>
          </div>
        </div>

        {/* Right Panel - Doc Content */}
        <div className="flex-1 bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
          <div className="p-4 border-b border-gray-700 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className={`px-2 py-0.5 rounded text-xs flex items-center gap-1 ${docConfig.color}`}>
                  <DocIcon className="w-3 h-3" />
                  {docConfig.label}
                </span>
                {selectedDoc.category && (
                  <span className="px-2 py-0.5 bg-gray-700 text-gray-400 rounded text-xs">{selectedDoc.category}</span>
                )}
              </div>
              <h2 className="text-xl font-semibold text-white">{selectedDoc.title}</h2>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => startEdit(selectedDoc)}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleDelete(selectedDoc)}
                className="p-2 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="p-4 overflow-y-auto max-h-[calc(100vh-250px)]">
            <div className="prose prose-invert max-w-none">
              <pre className="whitespace-pre-wrap text-gray-300 font-sans text-sm leading-relaxed">{selectedDoc.content}</pre>
            </div>
          </div>
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
                    selectedPath?.id === path.id ? 'bg-blue-600/20 border-l-2 border-blue-500' : 'hover:bg-gray-750'
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
                    <FolderOpen className={`w-4 h-4 ${selectedPath?.id === path.id ? 'text-blue-400' : 'text-yellow-400'}`} />
                    <span className="text-white font-medium text-sm flex-1">{path.label}</span>
                  </div>
                  <p className="text-gray-600 text-[10px] font-mono mt-1 pl-12 truncate">{path.path.split('/').pop()}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Docs */}
      <div className="flex-1 bg-gray-800 border border-gray-700 rounded-lg overflow-hidden flex flex-col">
        {selectedPath ? (
          <>
            {/* Header with tabs */}
            <div className="border-b border-gray-700">
              <div className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-400" />
                  <h3 className="text-white font-semibold">{selectedPath.label} Documentation</h3>
                  <span className="text-gray-500 text-sm">({docs.length} docs)</span>
                </div>
                <button
                  onClick={() => { setFormData({ ...formData, type: activeTab }); setShowForm(true); }}
                  className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm"
                >
                  <Plus className="w-4 h-4" />
                  Add Doc
                </button>
              </div>

              {/* Type Tabs */}
              <div className="flex px-3 -mb-px">
                {(Object.entries(TYPE_CONFIG) as [DocType, typeof TYPE_CONFIG.breakdown][]).map(([key, cfg]) => {
                  const TabIcon = cfg.icon;
                  const count = grouped[key]?.length || 0;
                  const isActive = activeTab === key;
                  return (
                    <button
                      key={key}
                      onClick={() => setActiveTab(key)}
                      className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                        isActive
                          ? `${cfg.activeColor} border-current`
                          : 'text-gray-400 border-transparent hover:text-white hover:border-gray-600'
                      }`}
                    >
                      <TabIcon className="w-4 h-4" />
                      {cfg.label}
                      <span className={`ml-1 px-1.5 py-0.5 rounded text-xs ${isActive ? 'bg-white/20' : 'bg-gray-700'}`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Tab Description */}
            <div className={`px-4 py-2 text-sm ${config.color} border-b border-gray-700`}>
              <Icon className="w-4 h-4 inline mr-2" />
              {config.description}
            </div>

            {/* Add/Edit Form */}
            {showForm && (
              <div className="p-4 border-b border-gray-700 bg-gray-750 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-white font-medium">{editingDoc ? 'Edit Document' : `New ${TYPE_CONFIG[formData.type].label}`}</h4>
                  <button onClick={resetForm} className="text-gray-500 hover:text-white"><X className="w-4 h-4" /></button>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as DocType }))}
                    className="px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                  >
                    {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
                      <option key={key} value={key}>{cfg.label}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    placeholder="Title"
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    className="px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                  />
                  <input
                    type="text"
                    placeholder="Category (optional)"
                    value={formData.category}
                    onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                    className="px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                  />
                </div>
                <textarea
                  placeholder="Content (markdown supported)..."
                  value={formData.content}
                  onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                  rows={10}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm font-mono resize-none"
                />
                <div className="flex justify-end gap-2">
                  <button onClick={resetForm} className="px-3 py-1.5 text-gray-400 hover:text-white">Cancel</button>
                  <button onClick={handleSubmit} className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm">
                    {editingDoc ? 'Update' : 'Create'}
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
                  placeholder={`Search ${config.label.toLowerCase()}...`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm"
                />
              </div>
            </div>

            {/* Docs Grid */}
            <div className="flex-1 overflow-y-auto p-3">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="w-6 h-6 text-blue-400 animate-spin" />
                </div>
              ) : currentDocs.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Icon className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p>No {config.label.toLowerCase()} documents</p>
                  <p className="text-sm mt-1">{config.description}</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {currentDocs.map(doc => (
                    <div
                      key={doc.id}
                      onClick={() => setSelectedDoc(doc)}
                      className="bg-gray-750 border border-gray-700 rounded-lg p-4 hover:border-blue-500 transition-colors cursor-pointer group"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            {doc.category && (
                              <span className="px-2 py-0.5 bg-gray-700 text-gray-400 rounded text-xs">{doc.category}</span>
                            )}
                          </div>
                          <h3 className="text-white font-medium truncate">{doc.title}</h3>
                          <p className="text-gray-500 text-sm mt-2 line-clamp-2">{doc.content}</p>
                        </div>
                        <Eye className="w-4 h-4 text-gray-500 group-hover:text-blue-400 flex-shrink-0 ml-2" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Select a folder to view docs</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
