'use client';

import { useState, useEffect } from 'react';
import { Plus, FileText, X, Edit2, Eye } from 'lucide-react';
import { Doc } from '../types';

interface DocsTabProps {
  projectPath: string;
}

export default function DocsTab({ projectPath }: DocsTabProps) {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDoc, setSelectedDoc] = useState<Doc | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingDoc, setEditingDoc] = useState<Doc | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    category: 'general',
  });

  useEffect(() => {
    fetchDocs();
  }, [projectPath]);

  const fetchDocs = async () => {
    try {
      const response = await fetch(`/api/susan/docs?project=${encodeURIComponent(projectPath)}`);
      const data = await response.json();
      if (data.success) {
        setDocs(data.docs || []);
      }
    } catch (error) {
      console.error('Error fetching docs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingDoc
        ? `/api/susan/doc/${editingDoc.id}`
        : '/api/susan/doc';
      const method = editingDoc ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          project_path: projectPath,
        }),
      });

      if (response.ok) {
        fetchDocs();
        setShowForm(false);
        setEditingDoc(null);
        setFormData({ title: '', content: '', category: 'general' });
      }
    } catch (error) {
      console.error('Error saving doc:', error);
    }
  };

  const handleEdit = (doc: Doc) => {
    setEditingDoc(doc);
    setFormData({
      title: doc.title,
      content: doc.content,
      category: doc.category,
    });
    setShowForm(true);
  };

  const handleDelete = async (doc: Doc) => {
    if (!confirm('Delete this document?')) return;
    try {
      await fetch(`/api/susan/doc/${doc.id}`, { method: 'DELETE' });
      if (selectedDoc?.id === doc.id) setSelectedDoc(null);
      fetchDocs();
    } catch (error) {
      console.error('Error deleting doc:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin text-2xl">⏳</div>
      </div>
    );
  }

  // Doc viewer mode
  if (selectedDoc) {
    return (
      <div>
        <button
          onClick={() => setSelectedDoc(null)}
          className="flex items-center gap-2 text-gray-400 hover:text-white mb-4"
        >
          ← Back to docs
        </button>
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-white">{selectedDoc.title}</h2>
            <div className="flex gap-2">
              <button
                onClick={() => handleEdit(selectedDoc)}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleDelete(selectedDoc)}
                className="p-2 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          <span className="px-2 py-0.5 bg-blue-600/20 text-blue-400 rounded text-xs mb-4 inline-block">
            {selectedDoc.category}
          </span>
          <div className="prose prose-invert max-w-none mt-4">
            <pre className="whitespace-pre-wrap text-gray-300 font-sans">{selectedDoc.content}</pre>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Documentation</h2>
        <button
          onClick={() => {
            setEditingDoc(null);
            setFormData({ title: '', content: '', category: 'general' });
            setShowForm(true);
          }}
          className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm"
        >
          <Plus className="w-4 h-4" />
          Add Doc
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
                  placeholder="Document title"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  required
                  className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                />
                <select
                  value={formData.category}
                  onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                  className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                >
                  <option value="general">General</option>
                  <option value="setup">Setup</option>
                  <option value="api">API</option>
                  <option value="architecture">Architecture</option>
                  <option value="deployment">Deployment</option>
                </select>
              </div>
              <textarea
                placeholder="Document content"
                value={formData.content}
                onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                required
                rows={10}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:outline-none resize-none font-mono text-sm"
              />
              <div className="flex gap-2">
                <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg">
                  {editingDoc ? 'Update' : 'Create'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingDoc(null);
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

      {/* Doc List */}
      {docs.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No documentation yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {docs.map(doc => (
            <div
              key={doc.id}
              onClick={() => setSelectedDoc(doc)}
              className="bg-gray-800 border border-gray-700 rounded-lg p-4 hover:border-blue-500 transition-colors cursor-pointer group"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-white font-medium">{doc.title}</h3>
                  <span className="px-2 py-0.5 bg-blue-600/20 text-blue-400 rounded text-xs mt-1 inline-block">
                    {doc.category}
                  </span>
                </div>
                <Eye className="w-4 h-4 text-gray-500 group-hover:text-blue-400" />
              </div>
              <p className="text-gray-500 text-sm mt-2 line-clamp-2">{doc.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
