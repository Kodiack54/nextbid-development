'use client';

import { useState, useEffect } from 'react';
import { Plus, Bug, X, AlertTriangle, CheckCircle, Clock, Search, Archive, FolderOpen, RefreshCw, Edit2, Trash2, ChevronUp, ChevronDown } from 'lucide-react';

interface ProjectPath {
  id: string;
  project_id: string;
  path: string;
  label: string;
  sort_order: number;
  created_at: string;
}

interface BugReport {
  id: string;
  project_path: string;
  title: string;
  description?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'investigating' | 'fixed' | 'wont_fix' | 'duplicate';
  steps_to_reproduce?: string;
  expected_behavior?: string;
  actual_behavior?: string;
  environment?: string;
  related_file?: string;
  reported_by?: string;
  resolved_at?: string;
  resolution_notes?: string;
  created_at: string;
  updated_at: string;
}

interface BugsTabProps {
  projectPath: string;
  projectId: string;
}

const SEVERITY_CONFIG = {
  low: { label: 'Low', color: 'bg-gray-600/20 text-gray-400 border-gray-600' },
  medium: { label: 'Medium', color: 'bg-yellow-600/20 text-yellow-400 border-yellow-600' },
  high: { label: 'High', color: 'bg-orange-600/20 text-orange-400 border-orange-600' },
  critical: { label: 'Critical', color: 'bg-red-600/20 text-red-400 border-red-600' },
};

const STATUS_CONFIG = {
  open: { label: 'Open', color: 'bg-red-600/20 text-red-400', icon: AlertTriangle },
  investigating: { label: 'Investigating', color: 'bg-yellow-600/20 text-yellow-400', icon: Search },
  fixed: { label: 'Fixed', color: 'bg-green-600/20 text-green-400', icon: CheckCircle },
  wont_fix: { label: "Won't Fix", color: 'bg-gray-600/20 text-gray-500', icon: X },
  duplicate: { label: 'Duplicate', color: 'bg-purple-600/20 text-purple-400', icon: Bug },
};

export default function BugsTab({ projectPath, projectId }: BugsTabProps) {
  const [projectPaths, setProjectPaths] = useState<ProjectPath[]>([]);
  const [selectedPath, setSelectedPath] = useState<ProjectPath | null>(null);
  const [bugs, setBugs] = useState<BugReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'open' | 'fixed'>('all');
  const [showForm, setShowForm] = useState(false);
  const [editingBug, setEditingBug] = useState<BugReport | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    severity: 'medium' as BugReport['severity'],
    status: 'open' as BugReport['status'],
    steps_to_reproduce: '',
    expected_behavior: '',
    actual_behavior: '',
    environment: 'dev',
    related_file: '',
    resolution_notes: '',
  });

  useEffect(() => {
    fetchProjectPaths();
  }, [projectId]);

  useEffect(() => {
    if (selectedPath) {
      fetchBugs(selectedPath.path);
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

  const fetchBugs = async (path: string) => {
    setIsLoading(true);
    try {
      const cleanPath = path.startsWith('/') ? path.slice(1) : path;
      const response = await fetch(`/api/clair/bugs/${cleanPath}`);
      const data = await response.json();
      if (data.success) {
        setBugs(data.bugs || []);
      }
    } catch (error) {
      console.error('Error fetching bugs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.title || !selectedPath) return;
    try {
      const cleanPath = selectedPath.path.startsWith('/') ? selectedPath.path.slice(1) : selectedPath.path;
      const url = editingBug
        ? `/api/clair/bugs/${cleanPath}/${editingBug.id}`
        : `/api/clair/bugs/${cleanPath}`;
      const method = editingBug ? 'PATCH' : 'POST';

      await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          reported_by: formData.title ? 'manual' : undefined,
          resolved_at: formData.status === 'fixed' ? new Date().toISOString() : null,
        }),
      });
      resetForm();
      fetchBugs(selectedPath.path);
    } catch (error) {
      console.error('Error saving bug:', error);
    }
  };

  const handleStatusChange = async (bug: BugReport, newStatus: BugReport['status']) => {
    if (!selectedPath) return;
    try {
      const cleanPath = selectedPath.path.startsWith('/') ? selectedPath.path.slice(1) : selectedPath.path;
      await fetch(`/api/clair/bugs/${cleanPath}/${bug.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          resolved_at: newStatus === 'fixed' ? new Date().toISOString() : null,
        }),
      });
      fetchBugs(selectedPath.path);
    } catch (error) {
      console.error('Error updating bug:', error);
    }
  };

  const handleDelete = async (bug: BugReport) => {
    if (!confirm('Delete this bug report?') || !selectedPath) return;
    try {
      const cleanPath = selectedPath.path.startsWith('/') ? selectedPath.path.slice(1) : selectedPath.path;
      await fetch(`/api/clair/bugs/${cleanPath}/${bug.id}`, { method: 'DELETE' });
      fetchBugs(selectedPath.path);
    } catch (error) {
      console.error('Error deleting bug:', error);
    }
  };

  const handleArchive = async (bug: BugReport) => {
    if (!selectedPath) return;
    try {
      const cleanPath = selectedPath.path.startsWith('/') ? selectedPath.path.slice(1) : selectedPath.path;
      await fetch(`/api/clair/bugs/${cleanPath}/${bug.id}/archive`, { method: 'POST' });
      fetchBugs(selectedPath.path);
    } catch (error) {
      console.error('Error archiving bug:', error);
    }
  };

  const startEdit = (bug: BugReport) => {
    setEditingBug(bug);
    setFormData({
      title: bug.title,
      description: bug.description || '',
      severity: bug.severity,
      status: bug.status,
      steps_to_reproduce: bug.steps_to_reproduce || '',
      expected_behavior: bug.expected_behavior || '',
      actual_behavior: bug.actual_behavior || '',
      environment: bug.environment || 'dev',
      related_file: bug.related_file || '',
      resolution_notes: bug.resolution_notes || '',
    });
    setShowForm(true);
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingBug(null);
    setFormData({
      title: '', description: '', severity: 'medium', status: 'open',
      steps_to_reproduce: '', expected_behavior: '', actual_behavior: '',
      environment: 'dev', related_file: '', resolution_notes: '',
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const filteredBugs = bugs.filter(bug => {
    if (filter === 'all') return true;
    if (filter === 'open') return ['open', 'investigating'].includes(bug.status);
    if (filter === 'fixed') return bug.status === 'fixed';
    return true;
  });

  const counts = {
    all: bugs.length,
    open: bugs.filter(b => ['open', 'investigating'].includes(b.status)).length,
    fixed: bugs.filter(b => b.status === 'fixed').length,
  };

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
                    selectedPath?.id === path.id ? 'bg-red-600/20 border-l-2 border-red-500' : 'hover:bg-gray-750'
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
                    <FolderOpen className={`w-4 h-4 ${selectedPath?.id === path.id ? 'text-red-400' : 'text-yellow-400'}`} />
                    <span className="text-white font-medium text-sm flex-1">{path.label}</span>
                  </div>
                  <p className="text-gray-600 text-[10px] font-mono mt-1 pl-12 truncate">{path.path.split('/').pop()}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Bugs */}
      <div className="flex-1 bg-gray-800 border border-gray-700 rounded-lg overflow-hidden flex flex-col">
        {selectedPath ? (
          <>
            {/* Header */}
            <div className="p-3 border-b border-gray-700 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Bug className="w-5 h-5 text-red-400" />
                <h3 className="text-white font-semibold">{selectedPath.label} Bugs</h3>
                <div className="flex items-center gap-1 bg-gray-700 rounded-lg p-0.5">
                  {(['all', 'open', 'fixed'] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => setFilter(f)}
                      className={`px-3 py-1 rounded text-xs transition-colors ${
                        filter === f ? 'bg-gray-600 text-white' : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      {f.charAt(0).toUpperCase() + f.slice(1)} ({counts[f]})
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={() => { resetForm(); setShowForm(true); }}
                className="flex items-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-sm"
              >
                <Bug className="w-4 h-4" />
                Report Bug
              </button>
            </div>

            {/* Form */}
            {showForm && (
              <div className="p-4 border-b border-gray-700 bg-gray-750 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-white font-medium">{editingBug ? 'Edit Bug' : 'New Bug Report'}</h4>
                  <button onClick={resetForm} className="text-gray-500 hover:text-white"><X className="w-4 h-4" /></button>
                </div>
                <div className="flex gap-3">
                  <input
                    type="text"
                    placeholder="Bug title"
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                  />
                  <select
                    value={formData.severity}
                    onChange={(e) => setFormData(prev => ({ ...prev, severity: e.target.value as BugReport['severity'] }))}
                    className="px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                  >
                    {Object.entries(SEVERITY_CONFIG).map(([key, cfg]) => (
                      <option key={key} value={key}>{cfg.label}</option>
                    ))}
                  </select>
                  <select
                    value={formData.environment}
                    onChange={(e) => setFormData(prev => ({ ...prev, environment: e.target.value }))}
                    className="px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                  >
                    <option value="dev">Dev</option>
                    <option value="test">Test</option>
                    <option value="prod">Prod</option>
                  </select>
                </div>
                <textarea
                  placeholder="Description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm resize-none"
                />
                <div className="grid grid-cols-2 gap-3">
                  <textarea
                    placeholder="Steps to reproduce"
                    value={formData.steps_to_reproduce}
                    onChange={(e) => setFormData(prev => ({ ...prev, steps_to_reproduce: e.target.value }))}
                    rows={3}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm resize-none"
                  />
                  <div className="space-y-3">
                    <input
                      type="text"
                      placeholder="Expected behavior"
                      value={formData.expected_behavior}
                      onChange={(e) => setFormData(prev => ({ ...prev, expected_behavior: e.target.value }))}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                    />
                    <input
                      type="text"
                      placeholder="Actual behavior"
                      value={formData.actual_behavior}
                      onChange={(e) => setFormData(prev => ({ ...prev, actual_behavior: e.target.value }))}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                    />
                    <input
                      type="text"
                      placeholder="Related file (optional)"
                      value={formData.related_file}
                      onChange={(e) => setFormData(prev => ({ ...prev, related_file: e.target.value }))}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm font-mono"
                    />
                  </div>
                </div>
                {editingBug && (
                  <textarea
                    placeholder="Resolution notes"
                    value={formData.resolution_notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, resolution_notes: e.target.value }))}
                    rows={2}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm resize-none"
                  />
                )}
                <div className="flex justify-end gap-2">
                  <button onClick={resetForm} className="px-3 py-1.5 text-gray-400 hover:text-white">Cancel</button>
                  <button onClick={handleSubmit} className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-sm">
                    {editingBug ? 'Update' : 'Submit'}
                  </button>
                </div>
              </div>
            )}

            {/* Bug List */}
            <div className="flex-1 overflow-y-auto p-3">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="w-6 h-6 text-red-400 animate-spin" />
                </div>
              ) : filteredBugs.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Bug className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p>{filter === 'all' ? 'No bugs reported' : `No ${filter} bugs`}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredBugs.map(bug => {
                    const severityCfg = SEVERITY_CONFIG[bug.severity];
                    const statusCfg = STATUS_CONFIG[bug.status];
                    const StatusIcon = statusCfg.icon;
                    return (
                      <div key={bug.id} className={`bg-gray-750 border rounded-lg p-3 group ${severityCfg.color.split(' ')[2]}`}>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`px-2 py-0.5 rounded text-xs flex items-center gap-1 ${statusCfg.color}`}>
                                <StatusIcon className="w-3 h-3" />
                                {statusCfg.label}
                              </span>
                              <span className={`px-2 py-0.5 rounded text-xs ${severityCfg.color.split(' ').slice(0, 2).join(' ')}`}>
                                {severityCfg.label}
                              </span>
                              {bug.environment && (
                                <span className="px-2 py-0.5 bg-gray-700 text-gray-400 rounded text-xs">{bug.environment}</span>
                              )}
                            </div>
                            <h3 className="text-white font-medium">{bug.title}</h3>
                            {bug.description && <p className="text-gray-400 text-sm mt-1">{bug.description}</p>}
                            <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                              <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatDate(bug.created_at)}</span>
                              {bug.reported_by && <span>by {bug.reported_by}</span>}
                              {bug.related_file && (
                                <span className="font-mono bg-gray-700 px-1 rounded">{bug.related_file.split('/').pop()}</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            {bug.status !== 'fixed' && (
                              <button
                                onClick={() => handleStatusChange(bug, 'fixed')}
                                className="p-1.5 text-gray-500 hover:text-green-400 hover:bg-gray-700 rounded"
                                title="Mark fixed"
                              >
                                <CheckCircle className="w-4 h-4" />
                              </button>
                            )}
                            {bug.status === 'fixed' && (
                              <button
                                onClick={() => handleArchive(bug)}
                                className="p-1.5 text-gray-500 hover:text-purple-400 hover:bg-gray-700 rounded"
                                title="Archive"
                              >
                                <Archive className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={() => startEdit(bug)}
                              className="p-1.5 text-gray-500 hover:text-white hover:bg-gray-700 rounded"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(bug)}
                              className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-gray-700 rounded"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
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
              <Bug className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Select a folder to view bugs</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
