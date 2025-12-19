'use client';

import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, X, Save, BookOpen, Code, Database, Globe, AlertTriangle, Folder } from 'lucide-react';

interface Convention {
  id: string;
  project_path: string;
  convention_type: string;
  name: string;
  description?: string;
  example?: string;
  created_at: string;
}

interface ConventionsTabProps {
  projectPath: string;
  projectId: string;
}

const CATEGORIES = [
  { id: 'all', label: 'All', icon: BookOpen },
  { id: 'naming', label: 'Naming Conventions', icon: Code },
  { id: 'structure', label: 'File Structure', icon: Folder },
  { id: 'database', label: 'Database Patterns', icon: Database },
  { id: 'api', label: 'API Patterns', icon: Globe },
  { id: 'component', label: 'Component Patterns', icon: Code },
  { id: 'quirk', label: 'Quirks & Gotchas', icon: AlertTriangle },
];

export default function ConventionsTab({ projectPath, projectId }: ConventionsTabProps) {
  const [conventions, setConventions] = useState<Convention[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    convention_type: 'naming',
    name: '',
    description: '',
    example: '',
  });

  useEffect(() => {
    fetchConventions();
  }, [projectPath]);

  const fetchConventions = async () => {
    try {
      const res = await fetch(`/api/conventions?project_path=${encodeURIComponent(projectPath)}`);
      const data = await res.json();
      if (data.success) {
        setConventions(data.conventions || []);
      }
    } catch (error) {
      console.error('Error fetching conventions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.name.trim()) return;

    try {
      const url = editingId 
        ? `/api/conventions/${editingId}` 
        : '/api/conventions';
      
      const res = await fetch(url, {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_path: projectPath,
          ...formData,
        }),
      });

      const data = await res.json();
      if (data.success) {
        fetchConventions();
        resetForm();
      }
    } catch (error) {
      console.error('Error saving convention:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this convention?')) return;

    try {
      const res = await fetch(`/api/conventions/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        fetchConventions();
      }
    } catch (error) {
      console.error('Error deleting convention:', error);
    }
  };

  const startEdit = (convention: Convention) => {
    setEditingId(convention.id);
    setFormData({
      convention_type: convention.convention_type || 'naming',
      name: convention.name,
      description: convention.description || '',
      example: convention.example || '',
    });
    setShowAddForm(true);
  };

  const resetForm = () => {
    setShowAddForm(false);
    setEditingId(null);
    setFormData({ convention_type: 'naming', name: '', description: '', example: '' });
  };

  const filteredConventions = activeCategory === 'all' 
    ? conventions 
    : conventions.filter(c => c.convention_type === activeCategory);

  const getCounts = () => {
    const counts: Record<string, number> = { all: conventions.length };
    CATEGORIES.slice(1).forEach(cat => {
      counts[cat.id] = conventions.filter(c => c.convention_type === cat.id).length;
    });
    return counts;
  };

  const counts = getCounts();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin text-2xl">⚙️</div>
      </div>
    );
  }

  return (
    <div className="p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Coding Conventions</h2>
          <p className="text-sm text-gray-400">
            Help Claude understand project patterns and maintain consistency
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg"
        >
          <Plus className="w-4 h-4" />
          Add Convention
        </button>
      </div>

      {/* Category Tabs */}
      <div className="flex flex-wrap gap-2 mb-4">
        {CATEGORIES.map(cat => {
          const Icon = cat.icon;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                activeCategory === cat.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              {cat.label}
              <span className="ml-1 px-1.5 py-0.5 bg-black/20 rounded text-xs">
                {counts[cat.id] || 0}
              </span>
            </button>
          );
        })}
      </div>

      {/* Add/Edit Form */}
      {showAddForm && (
        <div className="mb-4 p-4 bg-gray-800 rounded-lg border border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white font-medium">
              {editingId ? 'Edit Convention' : 'Add Convention'}
            </h3>
            <button onClick={resetForm} className="text-gray-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Category</label>
              <select
                value={formData.convention_type}
                onChange={(e) => setFormData({ ...formData, convention_type: e.target.value })}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-white text-sm"
              >
                {CATEGORIES.slice(1).map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Pattern/Rule Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Component files use PascalCase"
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-white text-sm"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Explain the convention..."
                rows={2}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-white text-sm"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Example</label>
              <textarea
                value={formData.example}
                onChange={(e) => setFormData({ ...formData, example: e.target.value })}
                placeholder="Code example..."
                rows={2}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-white text-sm font-mono"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={resetForm}
                className="px-4 py-2 text-gray-400 hover:text-white text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded"
              >
                <Save className="w-4 h-4" />
                {editingId ? 'Update' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Conventions List */}
      {filteredConventions.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No conventions documented yet.</p>
          <p className="text-sm mt-1">Add conventions to help Claude maintain consistency.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredConventions.map(conv => (
            <div key={conv.id} className="p-4 bg-gray-800 rounded-lg border border-gray-700">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 bg-gray-700 text-gray-300 text-xs rounded">
                      {CATEGORIES.find(c => c.id === conv.convention_type)?.label || conv.convention_type}
                    </span>
                  </div>
                  <h4 className="text-white font-medium">{conv.name}</h4>
                  {conv.description && (
                    <p className="text-gray-400 text-sm mt-1">{conv.description}</p>
                  )}
                  {conv.example && (
                    <pre className="mt-2 p-2 bg-gray-900 rounded text-sm text-gray-300 font-mono overflow-x-auto">
                      {conv.example}
                    </pre>
                  )}
                </div>
                <div className="flex items-center gap-1 ml-4">
                  <button
                    onClick={() => startEdit(conv)}
                    className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(conv.id)}
                    className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded"
                  >
                    <Trash2 className="w-4 h-4" />
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
