'use client';

import { useState, useEffect } from 'react';
import { Plus, Check, Clock, AlertCircle, X } from 'lucide-react';
import { Todo } from '../types';

interface TodosTabProps {
  projectPath: string;
}

const PRIORITY_STYLES = {
  low: 'bg-gray-600/20 text-gray-400',
  medium: 'bg-yellow-600/20 text-yellow-400',
  high: 'bg-orange-600/20 text-orange-400',
  critical: 'bg-red-600/20 text-red-400',
};

const STATUS_STYLES = {
  pending: 'bg-yellow-600/20 text-yellow-400',
  in_progress: 'bg-blue-600/20 text-blue-400',
  completed: 'bg-green-600/20 text-green-400',
  cancelled: 'bg-gray-600/20 text-gray-500',
};

export default function TodosTab({ projectPath }: TodosTabProps) {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'medium' as Todo['priority'],
    status: 'pending' as Todo['status'],
  });

  useEffect(() => {
    fetchTodos();
  }, [projectPath]);

  const fetchTodos = async () => {
    try {
      const response = await fetch(`/api/susan/todos?project=${encodeURIComponent(projectPath)}`);
      const data = await response.json();
      if (data.success) {
        setTodos(data.todos || []);
      }
    } catch (error) {
      console.error('Error fetching todos:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingTodo
        ? `/api/susan/todo/${editingTodo.id}`
        : '/api/susan/todo';
      const method = editingTodo ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          project_path: projectPath,
        }),
      });

      if (response.ok) {
        fetchTodos();
        setShowForm(false);
        setEditingTodo(null);
        setFormData({ title: '', description: '', priority: 'medium', status: 'pending' });
      }
    } catch (error) {
      console.error('Error saving todo:', error);
    }
  };

  const handleStatusChange = async (todo: Todo, newStatus: Todo['status']) => {
    try {
      await fetch(`/api/susan/todo/${todo.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      fetchTodos();
    } catch (error) {
      console.error('Error updating todo:', error);
    }
  };

  const handleEdit = (todo: Todo) => {
    setEditingTodo(todo);
    setFormData({
      title: todo.title,
      description: todo.description || '',
      priority: todo.priority,
      status: todo.status,
    });
    setShowForm(true);
  };

  const handleDelete = async (todo: Todo) => {
    if (!confirm('Delete this todo?')) return;
    try {
      await fetch(`/api/susan/todo/${todo.id}`, { method: 'DELETE' });
      fetchTodos();
    } catch (error) {
      console.error('Error deleting todo:', error);
    }
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
        <h2 className="text-lg font-semibold text-white">Todos</h2>
        <button
          onClick={() => {
            setEditingTodo(null);
            setFormData({ title: '', description: '', priority: 'medium', status: 'pending' });
            setShowForm(true);
          }}
          className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm"
        >
          <Plus className="w-4 h-4" />
          Add Todo
        </button>
      </div>

      {/* Todo Form */}
      {showForm && (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 mb-4">
          <form onSubmit={handleSubmit}>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Todo title"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                required
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:outline-none"
              />
              <textarea
                placeholder="Description (optional)"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={2}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:outline-none resize-none"
              />
              <div className="flex gap-3">
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value as Todo['priority'] }))}
                  className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                >
                  <option value="low">Low Priority</option>
                  <option value="medium">Medium Priority</option>
                  <option value="high">High Priority</option>
                  <option value="critical">Critical</option>
                </select>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as Todo['status'] }))}
                  className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                >
                  <option value="pending">Pending</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                >
                  {editingTodo ? 'Update' : 'Add'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingTodo(null);
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

      {/* Todo List */}
      {todos.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No todos yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {todos.map(todo => (
            <div
              key={todo.id}
              className={`bg-gray-800 border border-gray-700 rounded-lg p-3 ${
                todo.status === 'completed' ? 'opacity-60' : ''
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => handleStatusChange(todo, todo.status === 'completed' ? 'pending' : 'completed')}
                    className={`mt-0.5 w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                      todo.status === 'completed'
                        ? 'bg-green-600 border-green-600 text-white'
                        : 'border-gray-600 hover:border-green-500'
                    }`}
                  >
                    {todo.status === 'completed' && <Check className="w-3 h-3" />}
                  </button>
                  <div>
                    <h3 className={`text-white font-medium ${todo.status === 'completed' ? 'line-through' : ''}`}>
                      {todo.title}
                    </h3>
                    {todo.description && (
                      <p className="text-gray-400 text-sm mt-1">{todo.description}</p>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`px-2 py-0.5 rounded text-xs ${PRIORITY_STYLES[todo.priority]}`}>
                        {todo.priority}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-xs ${STATUS_STYLES[todo.status]}`}>
                        {todo.status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleEdit(todo)}
                    className="p-1.5 text-gray-500 hover:text-white hover:bg-gray-700 rounded"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => handleDelete(todo)}
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
