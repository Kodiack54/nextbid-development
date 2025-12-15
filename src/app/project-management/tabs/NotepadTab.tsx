'use client';

import { useState, useEffect } from 'react';
import { Plus, StickyNote, X, Edit2, Save } from 'lucide-react';
import { Note } from '../types';

interface NotepadTabProps {
  projectPath: string;
}

export default function NotepadTab({ projectPath }: NotepadTabProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchNotes();
  }, [projectPath]);

  const fetchNotes = async () => {
    try {
      const response = await fetch(`/api/susan/notes?project=${encodeURIComponent(projectPath)}`);
      const data = await response.json();
      if (data.success) {
        setNotes(data.notes || []);
      }
    } catch (error) {
      console.error('Error fetching notes:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const url = editingNote
        ? `/api/susan/note/${editingNote.id}`
        : '/api/susan/note';
      const method = editingNote ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          project_path: projectPath,
        }),
      });

      if (response.ok) {
        fetchNotes();
        setShowForm(false);
        setEditingNote(null);
        setFormData({ title: '', content: '' });
      }
    } catch (error) {
      console.error('Error saving note:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (note: Note) => {
    setEditingNote(note);
    setFormData({
      title: note.title,
      content: note.content,
    });
    setShowForm(true);
  };

  const handleDelete = async (note: Note) => {
    if (!confirm('Delete this note?')) return;
    try {
      await fetch(`/api/susan/note/${note.id}`, { method: 'DELETE' });
      fetchNotes();
    } catch (error) {
      console.error('Error deleting note:', error);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
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
        <h2 className="text-lg font-semibold text-white">Notepad</h2>
        <button
          onClick={() => {
            setEditingNote(null);
            setFormData({ title: '', content: '' });
            setShowForm(true);
          }}
          className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm"
        >
          <Plus className="w-4 h-4" />
          New Note
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 mb-4">
          <form onSubmit={handleSubmit}>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Note title"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                required
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:outline-none"
              />
              <textarea
                placeholder="Write your notes here..."
                value={formData.content}
                onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                required
                rows={8}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:outline-none resize-none"
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {isSaving ? 'Saving...' : editingNote ? 'Update Note' : 'Save Note'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingNote(null);
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

      {/* Notes List */}
      {notes.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <StickyNote className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No notes yet</p>
          <p className="text-sm mt-1">Jot down thoughts, ideas, and reminders</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {notes.map(note => (
            <div
              key={note.id}
              className="bg-gray-800 border border-gray-700 rounded-lg p-4 group"
            >
              <div className="flex items-start justify-between mb-2">
                <h3 className="text-white font-medium">{note.title}</h3>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleEdit(note)}
                    className="p-1.5 text-gray-500 hover:text-white hover:bg-gray-700 rounded"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => handleDelete(note)}
                    className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-gray-700 rounded"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>
              <p className="text-gray-400 text-sm whitespace-pre-wrap line-clamp-4">
                {note.content}
              </p>
              <div className="mt-3 pt-2 border-t border-gray-700">
                <span className="text-gray-600 text-xs">
                  Updated {formatDate(note.updated_at)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
