'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Move, Minimize2, Maximize2, X, RefreshCw,
  ChevronDown, ChevronRight, AlertCircle, CheckCircle2,
  Clock, Calendar, GitBranch, Target
} from 'lucide-react';

interface Phase {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'in_progress' | 'testing' | 'complete';
  sort_order: number;
  started_at: string | null;
  completed_at: string | null;
  project_name: string;
  project_slug: string;
  dependencies: Array<{
    depends_on_phase_id: string;
    dependency_type: string;
    dep_phase_name: string;
    dep_phase_status: string;
    dep_project_name: string;
  }> | null;
  blocked_count: number;
  // Time estimates (to be added later)
  estimated_days?: number;
  target_date?: string;
}

interface Project {
  id: string;
  name: string;
  slug: string;
  phases: Phase[];
  stats: {
    total_phases: number;
    completed: number;
    in_progress: number;
    blocked: number;
  };
}

interface Tradeline {
  name: string;
  slug: string;
  status: string;
  discovery_count: number;
  error_count: number;
}

interface RoadmapData {
  projects: Project[];
  tradelines: Tradeline[];
  current_focus: Array<{
    project: { name: string };
    phase: { name: string };
    rationale: string;
  }>;
  summary: {
    total_projects: number;
    active_projects: number;
    total_phases: number;
    completed_phases: number;
    blocked_phases: number;
    live_tradelines: number;
  };
}

interface RoadmapPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function RoadmapPanel({ isOpen, onClose }: RoadmapPanelProps) {
  const [position, setPosition] = useState({ x: 100, y: 50 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isMinimized, setIsMinimized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<RoadmapData | null>(null);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const panelRef = useRef<HTMLDivElement>(null);

  // Fetch roadmap data from Ryan
  const fetchRoadmap = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/ryan/status');
      const result = await response.json();
      if (result.success) {
        setData(result);
        // Auto-expand projects with in-progress phases
        const activeProjects = result.projects
          .filter((p: Project) => p.stats.in_progress > 0)
          .map((p: Project) => p.id);
        setExpandedProjects(new Set(activeProjects));
      }
    } catch (error) {
      console.error('Failed to fetch roadmap:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchRoadmap();
    }
  }, [isOpen]);

  // Dragging handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      setPosition({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y,
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  const toggleProject = (projectId: string) => {
    setExpandedProjects(prev => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'complete':
        return <CheckCircle2 className="w-4 h-4 text-green-400" />;
      case 'in_progress':
        return <Clock className="w-4 h-4 text-yellow-400 animate-pulse" />;
      case 'testing':
        return <Target className="w-4 h-4 text-blue-400" />;
      default:
        return <div className="w-4 h-4 rounded-full border-2 border-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'complete': return 'bg-green-500/20 border-green-500';
      case 'in_progress': return 'bg-yellow-500/20 border-yellow-500';
      case 'testing': return 'bg-blue-500/20 border-blue-500';
      default: return 'bg-gray-500/10 border-gray-600';
    }
  };

  if (!isOpen) return null;

  return (
    <div
      ref={panelRef}
      className="fixed z-50 bg-gray-900 border border-gray-600 rounded-lg shadow-2xl flex flex-col"
      style={{
        left: position.x,
        top: position.y,
        width: isMinimized ? '300px' : '600px',
        height: isMinimized ? 'auto' : '700px',
        maxHeight: '85vh',
      }}
    >
      {/* Header */}
      <div
        className="px-4 py-3 border-b border-gray-700 flex items-center justify-between cursor-move bg-gray-800 rounded-t-lg"
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center gap-3">
          <Move size={14} className="text-gray-500" />
          <span className="font-semibold text-white">Project Roadmap</span>
          {data && (
            <span className="text-xs text-gray-400">
              {data.summary.completed_phases}/{data.summary.total_phases} phases
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={fetchRoadmap}
            className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white"
            title="Refresh"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white"
          >
            {isMinimized ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
          </button>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-red-400"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <RefreshCw className="w-6 h-6 text-blue-400 animate-spin" />
            </div>
          ) : data ? (
            <div className="p-4 space-y-4">
              {/* Current Focus */}
              {data.current_focus?.length > 0 && (
                <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                  <div className="flex items-center gap-2 text-yellow-400 font-medium text-sm mb-1">
                    <Target size={14} />
                    Current Focus
                  </div>
                  <div className="text-white text-sm">
                    {data.current_focus[0].project?.name} - {data.current_focus[0].phase?.name}
                  </div>
                  {data.current_focus[0].rationale && (
                    <div className="text-gray-400 text-xs mt-1">
                      {data.current_focus[0].rationale}
                    </div>
                  )}
                </div>
              )}

              {/* Summary Stats */}
              <div className="grid grid-cols-4 gap-2">
                <div className="p-2 bg-gray-800 rounded text-center">
                  <div className="text-lg font-bold text-white">{data.summary.active_projects}</div>
                  <div className="text-xs text-gray-400">Active</div>
                </div>
                <div className="p-2 bg-gray-800 rounded text-center">
                  <div className="text-lg font-bold text-green-400">{data.summary.completed_phases}</div>
                  <div className="text-xs text-gray-400">Done</div>
                </div>
                <div className="p-2 bg-gray-800 rounded text-center">
                  <div className="text-lg font-bold text-yellow-400">
                    {data.projects.reduce((acc, p) => acc + p.stats.in_progress, 0)}
                  </div>
                  <div className="text-xs text-gray-400">In Progress</div>
                </div>
                <div className="p-2 bg-gray-800 rounded text-center">
                  <div className="text-lg font-bold text-blue-400">{data.summary.live_tradelines}</div>
                  <div className="text-xs text-gray-400">Tradelines</div>
                </div>
              </div>

              {/* Projects with Phases */}
              <div className="space-y-2">
                {data.projects.map(project => (
                  <div key={project.id} className="border border-gray-700 rounded-lg overflow-hidden">
                    {/* Project Header */}
                    <button
                      onClick={() => toggleProject(project.id)}
                      className="w-full px-3 py-2 bg-gray-800 hover:bg-gray-750 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        {expandedProjects.has(project.id) ? (
                          <ChevronDown size={16} className="text-gray-400" />
                        ) : (
                          <ChevronRight size={16} className="text-gray-400" />
                        )}
                        <span className="font-medium text-white">{project.name}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-green-400">{project.stats.completed}</span>
                        <span className="text-gray-500">/</span>
                        <span className="text-gray-400">{project.stats.total_phases}</span>
                        {project.stats.in_progress > 0 && (
                          <span className="px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 rounded">
                            {project.stats.in_progress} active
                          </span>
                        )}
                      </div>
                    </button>

                    {/* Phases */}
                    {expandedProjects.has(project.id) && (
                      <div className="px-3 py-2 space-y-2 bg-gray-900/50">
                        {project.phases
                          .sort((a, b) => a.sort_order - b.sort_order)
                          .map((phase, idx) => (
                            <div
                              key={phase.id}
                              className={`p-2 rounded border-l-2 ${getStatusColor(phase.status)}`}
                            >
                              <div className="flex items-start gap-2">
                                {getStatusIcon(phase.status)}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-500">Stage {idx + 1}</span>
                                    <span className="font-medium text-white text-sm">{phase.name}</span>
                                  </div>
                                  {phase.description && (
                                    <p className="text-xs text-gray-400 mt-0.5">{phase.description}</p>
                                  )}

                                  {/* Dependencies */}
                                  {phase.dependencies && phase.dependencies.length > 0 && (
                                    <div className="mt-1 flex flex-wrap gap-1">
                                      {phase.dependencies.map((dep, i) => (
                                        <span
                                          key={i}
                                          className={`text-xs px-1.5 py-0.5 rounded flex items-center gap-1 ${
                                            dep.dep_phase_status === 'complete'
                                              ? 'bg-green-500/20 text-green-400'
                                              : 'bg-red-500/20 text-red-400'
                                          }`}
                                        >
                                          <GitBranch size={10} />
                                          {dep.dep_project_name}: {dep.dep_phase_name}
                                        </span>
                                      ))}
                                    </div>
                                  )}

                                  {/* Blocked indicator */}
                                  {phase.blocked_count > 0 && (
                                    <div className="mt-1 flex items-center gap-1 text-xs text-red-400">
                                      <AlertCircle size={12} />
                                      Blocked by {phase.blocked_count} dependency
                                    </div>
                                  )}

                                  {/* Time estimate (placeholder - to be added) */}
                                  {phase.estimated_days && (
                                    <div className="mt-1 flex items-center gap-1 text-xs text-gray-500">
                                      <Calendar size={12} />
                                      Est. {phase.estimated_days} days
                                      {phase.target_date && ` • Due: ${phase.target_date}`}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Tradelines Section */}
              {data.tradelines.length > 0 && (
                <div className="border border-gray-700 rounded-lg p-3">
                  <h3 className="text-sm font-medium text-white mb-2">Tradelines</h3>
                  <div className="space-y-1">
                    {data.tradelines.map(tl => (
                      <div key={tl.slug} className="flex items-center justify-between text-sm">
                        <span className="text-gray-300">{tl.name}</span>
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          tl.status === 'live'
                            ? 'bg-green-500/20 text-green-400'
                            : tl.status === 'testing'
                            ? 'bg-blue-500/20 text-blue-400'
                            : 'bg-gray-500/20 text-gray-400'
                        }`}>
                          {tl.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              <div className="text-center">
                <AlertCircle className="w-8 h-8 mx-auto mb-2" />
                <p>Failed to load roadmap</p>
                <button
                  onClick={fetchRoadmap}
                  className="mt-2 text-blue-400 hover:text-blue-300 text-sm"
                >
                  Retry
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
