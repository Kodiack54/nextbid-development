'use client';

import { useState, useEffect } from 'react';
import { Plus, Bug, X, AlertTriangle, CheckCircle, Clock, Search } from 'lucide-react';
import { Bug as BugType } from '../types';

interface BugsTabProps {
  projectPath: string;
}

const SEVERITY_STYLES = {
  low: 'bg-gray-600/20 text-gray-400 border-gray-600',
  medium: 'bg-yellow-600/20 text-yellow-400 border-yellow-600',
  high: 'bg-orange-600/20 text-orange-400 border-orange-600',
  critical: 'bg-red-600/20 text-red-400 border-red-600',
};

const STATUS_STYLES = {
  open: 'bg-red-600/20 text-red-400',
  investigating: 'bg-yellow-600/20 text-yellow-400',
  fixed: 'bg-green-600/20 text-green-400',
  wont_fix: 'bg-gray-600/20 text-gray-500',
  duplicate: 'bg-purple-600/20 text-purple-400',
};

const STATUS_ICONS = {
  open: <AlertTriangle className="w-3 h-3" />,
  investigating: <Search className="w-3 h-3" />,
  fixed: <CheckCircle className="w-3 h-3" />,
  wont_fix: <X className="w-3 h-3" />,
  duplicate: <Bug className="w-3 h-3" />,
};

export default function BugsTab({ projectPath }: BugsTabProps) {
  const [bugs, setBugs] = useState<BugType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingBug, setEditingBug] = useState<BugType | null>(null);
  const [filter, setFilter] = useState<'all' | 'open' | 'fixed'>('all');
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    severity: 'medium' as BugType['severity'],
    status: 'open' as BugType['status'],
    steps_to_reproduce: '',
    expected_behavior: '',
    actual_behavior: '',
    environment: 'dev',
    related_file: '',
  });

  useEffect(() => {
    fetchBugs();
  }, [projectPath]);

  const fetchBugs = async () => {
    try {
      const response = await fetch(`/api/susan/bugs?project=${encodeURIComponent(projectPath)}`);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingBug
        ? `/api/susan/bug/${editingBug.id}`
        : '/api/susan/bug';
      const method = editingBug ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          project_path: projectPath,
          reported_by: 'manual',
        }),
      });

      if (response.ok) {
        fetchBugs();
        setShowForm(false);
        setEditingBug(null);
        resetForm();
      }
    } catch (error) {
      console.error('Error saving bug:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      severity: 'medium',
      status: 'open',
      steps_to_reproduce: '',
      expected_behavior: '',
      actual_behavior: '',
      environment: 'dev',
      related_file: '',
    });
  };

  const handleEdit = (bug: BugType) => {
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
    });
    setShowForm(true);
  };

  const handleStatusChange = async (bug: BugType, newStatus: BugType['status']) => {
    try {
      await fetch(`/api/susan/bug/${bug.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          resolved_at: newStatus === 'fixed' ? new Date().toISOString() : null,
        }),
      });
      fetchBugs();
    } catch (error) {
      console.error('Error updating bug:', error);
    }
  };

  const handleDelete = async (bug: BugType) => {
    if (!confirm('Delete this bug report?')) return;
    try {
      await fetch(`/api/susan/bug/${bug.id}`, { method: 'DELETE' });
      fetchBugs();
    } catch (error) {
      console.error('Error deleting bug:', error);
    }
  };

  const filteredBugs = bugs.filter(bug => {
    if (filter === 'all') return true;
    if (filter === 'open') return ['open', 'investigating'].includes(bug.status);
    if (filter === 'fixed') return bug.status === 'fixed';
    return true;
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
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
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold text-white">Bug Reports</h2>
          <div className="flex items-center gap-1 bg-gray-800 rounded-lg p-1">
            {(['all', 'open', 'fixed'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 rounded text-sm transition-colors ${
                  filter === f
                    ? 'bg-gray-700 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={() => {
            setEditingBug(null);
            resetForm();
            setShowForm(true);
          }}
          className="flex items-center gap-2 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm"
        >
          <Bug className="w-4 h-4" />
          Report Bug
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 mb-4">
          <form onSubmit={handleSubmit}>
            <div className="space-y-3">
              <div className="flex gap-3">
                <input
                  type="text"
                  placeholder="Bug title"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  required
                  className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-red-500 focus:outline-none"
                />
                <select
                  value={formData.severity}
                  onChange={(e) => setFormData(prev => ({ ...prev, severity: e.target.value as BugType['severity'] }))}
                  className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-red-500 focus:outline-none"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
                <select
                  value={formData.environment}
                  onChange={(e) => setFormData(prev => ({ ...prev, environment: e.target.value }))}
                  className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-red-500 focus:outline-none"
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
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-red-500 focus:outline-none resize-none"
              />

              <div className="grid grid-cols-2 gap-3">
                <textarea
                  placeholder="Steps to reproduce"
                  value={formData.steps_to_reproduce}
                  onChange={(e) => setFormData(prev => ({ ...prev, steps_to_reproduce: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-red-500 focus:outline-none resize-none"
                />
                <div className="space-y-3">
                  <textarea
                    placeholder="Expected behavior"
                    value={formData.expected_behavior}
                    onChange={(e) => setFormData(prev => ({ ...prev, expected_behavior: e.target.value }))}
                    rows={1}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-red-500 focus:outline-none resize-none"
                  />
                  <textarea
                    placeholder="Actual behavior"
                    value={formData.actual_behavior}
                    onChange={(e) => setFormData(prev => ({ ...prev, actual_behavior: e.target.value }))}
                    rows={1}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-red-500 focus:outline-none resize-none"
                  />
                </div>
              </div>

              <input
                type="text"
                placeholder="Related file (optional)"
                value={formData.related_file}
                onChange={(e) => setFormData(prev => ({ ...prev, related_file: e.target.value }))}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-red-500 focus:outline-none font-mono text-sm"
              />

              <div className="flex gap-2">
                <button type="submit" className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg">
                  {editingBug ? 'Update Bug' : 'Submit Bug'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingBug(null);
                  }}
                  className="px-4 py-2 text-gray-400 hover:text-white"
                >
                  Cancel
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Bug List */}
      {filteredBugs.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Bug className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>{filter === 'all' ? 'No bugs reported yet' : `No ${filter} bugs`}</p>
          <p className="text-sm mt-1">Tiffany will report bugs when she tests</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredBugs.map(bug => (
            <div
              key={bug.id}
              className={`bg-gray-800 border rounded-lg p-4 ${SEVERITY_STYLES[bug.severity].split(' ')[2]}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-0.5 rounded text-xs flex items-center gap-1 ${STATUS_STYLES[bug.status]}`}>
                      {STATUS_ICONS[bug.status]}
                      {bug.status.replace('_', ' ')}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-xs ${SEVERITY_STYLES[bug.severity].split(' ').slice(0, 2).join(' ')}`}>
                      {bug.severity}
                    </span>
                    {bug.environment && (
                      <span className="px-2 py-0.5 bg-gray-700 text-gray-400 rounded text-xs">
                        {bug.environment}
                      </span>
                    )}
                  </div>
                  <h3 className="text-white font-medium">{bug.title}</h3>
                  {bug.description && (
                    <p className="text-gray-400 text-sm mt-1">{bug.description}</p>
                  )}
                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDate(bug.created_at)}
                    </span>
                    {bug.reported_by && <span>by {bug.reported_by}</span>}
                    {bug.related_file && (
                      <span className="font-mono bg-gray-700 px-1 rounded">
                        {bug.related_file.split('/').pop()}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {bug.status !== 'fixed' && (
                    <button
                      onClick={() => handleStatusChange(bug, 'fixed')}
                      className="p-1.5 text-gray-500 hover:text-green-400 hover:bg-gray-700 rounded"
                      title="Mark as fixed"
                    >
                      <CheckCircle className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => handleEdit(bug)}
                    className="p-1.5 text-gray-500 hover:text-white hover:bg-gray-700 rounded"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => handleDelete(bug)}
                    className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-gray-700 rounded"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
