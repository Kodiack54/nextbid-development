'use client';

import { useState, useEffect } from 'react';
import { RefreshCw, ChevronDown, ChevronRight, CheckCircle2, Clock, Target, AlertCircle, Plus, Edit2, Trash2 } from 'lucide-react';

interface Phase {
  id: string;
  name: string;
  description: string;
  status: string;
  sort_order: number;
}

interface Todo {
  id: string;
  title: string;
  description: string;
  status: 'open' | 'pending' | 'in_progress' | 'completed' | 'flagged';
  priority: string;
  phase_id: string | null;
  created_at: string;
}

interface TodosTabProps {
  projectPath: string;
  projectId: string;
  parentId?: string;
}

export default function TodosTab({ projectPath, projectId, parentId }: TodosTabProps) {
  const [phases, setPhases] = useState<Phase[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  // Fetch phases from parent project and todos for this project
  useEffect(() => {
    fetchData();
  }, [projectId, parentId]);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // First get parent_id if not provided
      let actualParentId = parentId;
      if (!actualParentId) {
        const projectRes = await fetch(`/api/projects/${projectId}`);
        const projectData = await projectRes.json();
        actualParentId = projectData.project?.parent_id;
      }

      // Fetch phases from parent (or current project if it IS the parent)
      const phaseProjectId = actualParentId || projectId;
      const phasesRes = await fetch(`/api/project-phases?project_id=${phaseProjectId}`);
      const phasesData = await phasesRes.json();

      if (phasesData.success && phasesData.phases) {
        const sortedPhases = phasesData.phases.sort((a: Phase, b: Phase) =>
          (a.sort_order || 0) - (b.sort_order || 0)
        );
        setPhases(sortedPhases);
        // Auto-expand all phases initially
        setExpandedPhases(new Set(sortedPhases.map((p: Phase) => p.id)));
      }

      // Fetch todos for THIS project
      const todosRes = await fetch(`/api/ai-todos?project_id=${projectId}`);
      const todosData = await todosRes.json();

      if (todosData.success) {
        setTodos(todosData.todos || []);
      }
    } catch (err) {
      console.error('Error fetching todos data:', err);
      setError('Failed to load todos');
    } finally {
      setIsLoading(false);
    }
  };

  const togglePhase = (phaseId: string) => {
    setExpandedPhases(prev => {
      const next = new Set(prev);
      if (next.has(phaseId)) {
        next.delete(phaseId);
      } else {
        next.add(phaseId);
      }
      return next;
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-4 h-4 text-green-400" />;
      case 'in_progress':
        return <Clock className="w-4 h-4 text-yellow-400" />;
      case 'flagged':
        return <AlertCircle className="w-4 h-4 text-red-400" />;
      default:
        return <div className="w-4 h-4 rounded-full border-2 border-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500/20 border-green-500';
      case 'in_progress': return 'bg-yellow-500/20 border-yellow-500';
      case 'flagged': return 'bg-red-500/20 border-red-500';
      default: return 'bg-gray-500/10 border-gray-600';
    }
  };

  const getPriorityBadge = (priority: string) => {
    const colors: Record<string, string> = {
      high: 'bg-red-500/20 text-red-400',
      medium: 'bg-yellow-500/20 text-yellow-400',
      low: 'bg-blue-500/20 text-blue-400'
    };
    return colors[priority] || 'bg-gray-500/20 text-gray-400';
  };

  // Group todos by phase
  const getTodosByPhase = (phaseId: string) => {
    return todos.filter(t => t.phase_id === phaseId && t.status !== 'completed');
  };

  const getUnassignedTodos = () => {
    return todos.filter(t => !t.phase_id && t.status !== 'completed');
  };

  const getCompletedTodos = () => {
    return todos.filter(t => t.status === 'completed');
  };

  // Count todos per phase
  const getPhaseStats = (phaseId: string) => {
    const phaseTodos = todos.filter(t => t.phase_id === phaseId);
    return {
      total: phaseTodos.length,
      completed: phaseTodos.filter(t => t.status === 'completed').length,
      active: phaseTodos.filter(t => t.status !== 'completed').length
    };
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-6 h-6 text-blue-400 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12 text-red-400">
        <AlertCircle className="w-6 h-6 mr-2" />
        {error}
      </div>
    );
  }

  const unassignedTodos = getUnassignedTodos();
  const completedTodos = getCompletedTodos();

  return (
    <div className="h-full overflow-auto p-4">
      {/* Header with stats */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Project Todos</h2>
          <p className="text-sm text-gray-400">
            {todos.filter(t => t.status !== 'completed').length} active, {completedTodos.length} completed
          </p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        <div className="p-2 bg-gray-800 rounded text-center">
          <div className="text-lg font-bold text-white">{phases.length}</div>
          <div className="text-xs text-gray-400">Phases</div>
        </div>
        <div className="p-2 bg-gray-800 rounded text-center">
          <div className="text-lg font-bold text-blue-400">{todos.filter(t => t.status === 'open' || t.status === 'pending').length}</div>
          <div className="text-xs text-gray-400">Open</div>
        </div>
        <div className="p-2 bg-gray-800 rounded text-center">
          <div className="text-lg font-bold text-yellow-400">{todos.filter(t => t.status === 'in_progress').length}</div>
          <div className="text-xs text-gray-400">In Progress</div>
        </div>
        <div className="p-2 bg-gray-800 rounded text-center">
          <div className="text-lg font-bold text-green-400">{completedTodos.length}</div>
          <div className="text-xs text-gray-400">Completed</div>
        </div>
      </div>

      {/* Phases with Todos */}
      <div className="space-y-2">
        {phases.map((phase) => {
          const phaseTodos = getTodosByPhase(phase.id);
          const stats = getPhaseStats(phase.id);
          const isExpanded = expandedPhases.has(phase.id);

          return (
            <div key={phase.id} className="border border-gray-700 rounded-lg overflow-hidden">
              {/* Phase Header */}
              <button
                onClick={() => togglePhase(phase.id)}
                className="w-full px-3 py-2 bg-gray-800 hover:bg-gray-750 flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  {isExpanded ? (
                    <ChevronDown size={16} className="text-gray-400" />
                  ) : (
                    <ChevronRight size={16} className="text-gray-400" />
                  )}
                  <span className="font-medium text-white">{phase.name}</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-green-400">{stats.completed}</span>
                  <span className="text-gray-500">/</span>
                  <span className="text-gray-400">{stats.total}</span>
                  {stats.active > 0 && (
                    <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded">
                      {stats.active} active
                    </span>
                  )}
                </div>
              </button>

              {/* Todos in Phase */}
              {isExpanded && (
                <div className="px-3 py-2 space-y-2 bg-gray-900/50">
                  {phaseTodos.length === 0 ? (
                    <p className="text-gray-500 text-sm text-center py-2">No todos in this phase</p>
                  ) : (
                    phaseTodos.map((todo) => (
                      <div
                        key={todo.id}
                        className={`p-2 rounded border-l-2 ${getStatusColor(todo.status)}`}
                      >
                        <div className="flex items-start gap-2">
                          {getStatusIcon(todo.status)}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-white text-sm">{todo.title}</span>
                              {todo.priority && (
                                <span className={`text-xs px-1.5 py-0.5 rounded ${getPriorityBadge(todo.priority)}`}>
                                  {todo.priority}
                                </span>
                              )}
                            </div>
                            {todo.description && (
                              <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{todo.description}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Unassigned Section */}
        {unassignedTodos.length > 0 && (
          <div className="border border-gray-700 rounded-lg overflow-hidden border-dashed">
            <button
              onClick={() => togglePhase('unassigned')}
              className="w-full px-3 py-2 bg-gray-800/50 hover:bg-gray-750 flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                {expandedPhases.has('unassigned') ? (
                  <ChevronDown size={16} className="text-gray-400" />
                ) : (
                  <ChevronRight size={16} className="text-gray-400" />
                )}
                <span className="font-medium text-gray-400">Unassigned</span>
              </div>
              <span className="px-1.5 py-0.5 bg-gray-500/20 text-gray-400 rounded text-xs">
                {unassignedTodos.length} items
              </span>
            </button>

            {expandedPhases.has('unassigned') && (
              <div className="px-3 py-2 space-y-2 bg-gray-900/30">
                {unassignedTodos.map((todo) => (
                  <div
                    key={todo.id}
                    className={`p-2 rounded border-l-2 ${getStatusColor(todo.status)}`}
                  >
                    <div className="flex items-start gap-2">
                      {getStatusIcon(todo.status)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-white text-sm">{todo.title}</span>
                          {todo.priority && (
                            <span className={`text-xs px-1.5 py-0.5 rounded ${getPriorityBadge(todo.priority)}`}>
                              {todo.priority}
                            </span>
                          )}
                        </div>
                        {todo.description && (
                          <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{todo.description}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Completed Section */}
        {completedTodos.length > 0 && (
          <div className="border border-gray-700 rounded-lg overflow-hidden opacity-75">
            <button
              onClick={() => togglePhase('completed')}
              className="w-full px-3 py-2 bg-gray-800/50 hover:bg-gray-750 flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                {expandedPhases.has('completed') ? (
                  <ChevronDown size={16} className="text-gray-400" />
                ) : (
                  <ChevronRight size={16} className="text-gray-400" />
                )}
                <CheckCircle2 size={16} className="text-green-400" />
                <span className="font-medium text-gray-400">Completed</span>
              </div>
              <span className="px-1.5 py-0.5 bg-green-500/20 text-green-400 rounded text-xs">
                {completedTodos.length} done
              </span>
            </button>

            {expandedPhases.has('completed') && (
              <div className="px-3 py-2 space-y-2 bg-gray-900/30">
                {completedTodos.slice(0, 10).map((todo) => (
                  <div
                    key={todo.id}
                    className="p-2 rounded border-l-2 bg-green-500/10 border-green-500"
                  >
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-400" />
                      <span className="text-gray-400 text-sm line-through">{todo.title}</span>
                    </div>
                  </div>
                ))}
                {completedTodos.length > 10 && (
                  <p className="text-xs text-gray-500 text-center">
                    +{completedTodos.length - 10} more completed
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Empty State */}
      {todos.length === 0 && phases.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <Target className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-lg font-medium">No phases or todos yet</p>
          <p className="text-sm mt-1">Phases will be inherited from the parent project</p>
        </div>
      )}
    </div>
  );
}
