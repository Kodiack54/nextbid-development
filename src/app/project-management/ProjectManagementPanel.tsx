'use client';

import { useState, useEffect } from 'react';
import { Plus, ArrowLeft, Server, ChevronRight, Settings, ChevronUp, ChevronDown, CheckSquare, BookOpen, Clock, AlertCircle } from 'lucide-react';
import { Project, TabType, TABS } from './types';
import ProjectHeader from './components/ProjectHeader';
import ProjectTabs from './components/ProjectTabs';
import ProjectForm from './components/ProjectForm';

// Tab Components
import TodosTab from './tabs/TodosTab';
import DocsTab from './tabs/DocsTab';
import DatabaseTab from './tabs/DatabaseTab';
import StructureTab from './tabs/StructureTab';
import NotepadTab from './tabs/NotepadTab';
import BugsTab from './tabs/BugsTab';
import ConventionsTab from './tabs/ConventionsTab';
import KnowledgeTab from './tabs/KnowledgeTab';

interface ProjectSummary {
  sessions: { pending: number; processed: number; total: number };
  todos: { pending: number; completed: number; total: number };
  knowledge: number;
  bugs: number;
  code_changes: number;
  last_activity: string | null;
}

interface ProjectManagementPanelProps {
  onProjectsChange?: () => void;
}

export default function ProjectManagementPanel({ onProjectsChange }: ProjectManagementPanelProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('todos');
  const [isLoading, setIsLoading] = useState(true);
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [projectSummaries, setProjectSummaries] = useState<Record<string, ProjectSummary>>({});

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    if (projects.length > 0) {
      fetchProjectSummaries();
    }
  }, [projects]);

  const fetchProjects = async () => {
    try {
      const response = await fetch('/api/projects');
      const data = await response.json();
      if (data.success) {
        setProjects(data.projects);
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchProjectSummaries = async () => {
    try {
      const response = await fetch('/api/projects/summary');
      const data = await response.json();
      if (data.success && data.summaries) {
        setProjectSummaries(data.summaries);
      }
    } catch (error) {
      console.error('Error fetching project summaries:', error);
    }
  };

  const formatTimeAgo = (dateStr: string | null) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const handleSelectProject = (project: Project) => {
    setSelectedProject(project);
    setActiveTab('todos');
  };

  const handleBackToList = () => {
    setSelectedProject(null);
  };

  const handleEditProject = (project: Project) => {
    setEditingProject(project);
    setShowProjectForm(true);
  };

  const handleAddProject = () => {
    setEditingProject(null);
    setShowProjectForm(true);
  };

  const handleFormClose = () => {
    setShowProjectForm(false);
    setEditingProject(null);
  };

  const handleFormSave = () => {
    fetchProjects();
    onProjectsChange?.();
    handleFormClose();
  };

  // Move project up or down in the list
  const handleMoveProject = async (projectId: string, direction: 'up' | 'down') => {
    const currentIndex = projects.findIndex(p => p.id === projectId);
    if (currentIndex === -1) return;

    const swapIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (swapIndex < 0 || swapIndex >= projects.length) return;

    const currentProject = projects[currentIndex];
    const swapProject = projects[swapIndex];

    try {
      await Promise.all([
        fetch('/api/projects', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: currentProject.id, sort_order: swapProject.sort_order }),
        }),
        fetch('/api/projects', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: swapProject.id, sort_order: currentProject.sort_order }),
        }),
      ]);
      fetchProjects();
      onProjectsChange?.();
    } catch (error) {
      console.error('Error moving project:', error);
    }
  };

  const renderTabContent = () => {
    if (!selectedProject) return null;
    const projectPath = selectedProject.server_path || '';

    switch (activeTab) {
      case 'todos':
        return <TodosTab projectPath={projectPath} projectId={selectedProject.id} />;
      case 'knowledge':
        return <KnowledgeTab projectPath={projectPath} projectId={selectedProject.id} />;
      case 'docs':
        return <DocsTab projectPath={projectPath} projectId={selectedProject.id} />;
      case 'database':
        return <DatabaseTab projectPath={projectPath} projectId={selectedProject.id} />;
      case 'structure':
        return <StructureTab projectPath={projectPath} projectId={selectedProject.id} />;
      
      case 'conventions':
        return <ConventionsTab projectPath={projectPath} projectId={selectedProject.id} />;
      case 'notepad':
        return <NotepadTab projectPath={projectPath} />;
      case 'bugs':
        return <BugsTab projectPath={projectPath} projectId={selectedProject.id} />;
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin text-2xl">⚙️</div>
      </div>
    );
  }

  // Detail View - when a project is selected
  if (selectedProject) {
    return (
      <div className="flex flex-col h-full">
        {/* Back button */}
        <button
          onClick={handleBackToList}
          className="flex items-center gap-2 text-gray-400 hover:text-white mb-3 text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          All Projects
        </button>

        {/* Project Header */}
        <div className="mb-3 pb-3 border-b border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">{selectedProject.name}</h2>
              {selectedProject.description && (
                <p className="text-gray-400 text-sm">{selectedProject.description}</p>
              )}
              <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                {selectedProject.droplet_name && (
                  <span className="flex items-center gap-1">
                    <Server className="w-3 h-3" />
                    {selectedProject.droplet_name}
                  </span>
                )}
                {selectedProject.port_dev && (
                  <span className="px-2 py-0.5 bg-blue-600/20 text-blue-400 rounded">
                    Dev: {selectedProject.port_dev}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={() => handleEditProject(selectedProject)}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <ProjectTabs activeTab={activeTab} onTabChange={setActiveTab} />

        {/* Tab Content */}
        <div className="flex-1 overflow-auto mt-3">
          {renderTabContent()}
        </div>

        {/* Project Form Modal */}
        {showProjectForm && (
          <ProjectForm
            project={editingProject}
            onClose={handleFormClose}
            onSave={handleFormSave}
          />
        )}
      </div>
    );
  }

  // List View - all projects
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-gray-400 text-sm">{projects.length} projects</span>
        <button
          onClick={handleAddProject}
          className="flex items-center gap-1 px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm"
        >
          <Plus className="w-3 h-3" />
          Add
        </button>
      </div>

      {/* Project List */}
      {projects.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <div className="text-4xl mb-2">📁</div>
          <p>No projects yet</p>
        </div>
      ) : (
        <div className="flex-1 overflow-auto space-y-2">
          {projects.map((project, index) => (
            <div
              key={project.id}
              onClick={() => handleSelectProject(project)}
              className="p-3 bg-gray-800 hover:bg-gray-750 border border-gray-700 hover:border-blue-500 rounded cursor-pointer group transition-colors"
            >
              <div className="flex items-start gap-3">
                {/* Move buttons */}
                <div className="flex flex-col opacity-0 group-hover:opacity-100 transition-all flex-shrink-0">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleMoveProject(project.id, 'up'); }}
                    disabled={index === 0}
                    className={`p-0.5 rounded ${index === 0 ? 'text-gray-600 cursor-not-allowed' : 'text-gray-500 hover:text-white hover:bg-gray-700'}`}
                    title="Move up"
                  >
                    <ChevronUp className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleMoveProject(project.id, 'down'); }}
                    disabled={index === projects.length - 1}
                    className={`p-0.5 rounded ${index === projects.length - 1 ? 'text-gray-600 cursor-not-allowed' : 'text-gray-500 hover:text-white hover:bg-gray-700'}`}
                    title="Move down"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </div>

                {/* Logo/Initial */}
                {project.logo_url ? (
                  <img src={project.logo_url} alt="" className="w-10 h-10 rounded object-cover flex-shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded bg-blue-600/20 flex items-center justify-center text-blue-400 font-bold flex-shrink-0">
                    {project.name.charAt(0).toUpperCase()}
                  </div>
                )}

                {/* Main Info */}
                <div className="flex-1 min-w-0">
                  {/* Name & Description */}
                  <div className="flex items-center gap-2">
                    <span className="text-white font-medium">{project.name}</span>
                    <span className="text-gray-600 text-xs">({project.slug})</span>
                    <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-blue-400 ml-auto flex-shrink-0" />
                  </div>
                  {project.description && (
                    <p className="text-gray-400 text-sm mt-0.5 truncate">{project.description}</p>
                  )}

                  {/* At-a-glance Info Row */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs">
                    {/* Droplet */}
                    {project.droplet_name && (
                      <span className="flex items-center gap-1 text-gray-400">
                        <Server className="w-3 h-3" />
                        {project.droplet_name}
                        {project.droplet_ip && <span className="text-gray-600">({project.droplet_ip})</span>}
                      </span>
                    )}

                    {/* Ports */}
                    {(project.port_dev || project.port_test || project.port_prod) && (
                      <span className="flex items-center gap-1">
                        {project.port_dev && <span className="px-1.5 py-0.5 bg-blue-600/20 text-blue-400 rounded">Dev:{project.port_dev}</span>}
                        {project.port_test && <span className="px-1.5 py-0.5 bg-yellow-600/20 text-yellow-400 rounded">Test:{project.port_test}</span>}
                        {project.port_prod && <span className="px-1.5 py-0.5 bg-green-600/20 text-green-400 rounded">Prod:{project.port_prod}</span>}
                      </span>
                    )}

                    {/* Build Number */}
                    {project.build_number && (
                      <span className="text-gray-500">
                        Build: <span className="text-gray-300">{project.build_number}</span>
                      </span>
                    )}

                    {/* Git Repo */}
                    {project.git_repo && (
                      <span className="text-gray-500 truncate max-w-[200px]">
                        {project.git_repo.replace('https://github.com/', '')}
                      </span>
                    )}
                  </div>

                  {/* At-a-glance Stats Row */}
                  {projectSummaries[project.id] && (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 pt-2 border-t border-gray-700/50 text-xs">
                      {/* Todos */}
                      {projectSummaries[project.id].todos.total > 0 && (
                        <span className="flex items-center gap-1 text-gray-400">
                          <CheckSquare className="w-3 h-3" />
                          <span className="text-yellow-400">{projectSummaries[project.id].todos.pending}</span>
                          <span className="text-gray-600">/</span>
                          <span className="text-green-400">{projectSummaries[project.id].todos.completed}</span>
                          <span className="text-gray-600">todos</span>
                        </span>
                      )}

                      {/* Knowledge */}
                      {projectSummaries[project.id].knowledge > 0 && (
                        <span className="flex items-center gap-1 text-gray-400">
                          <BookOpen className="w-3 h-3" />
                          <span className="text-purple-400">{projectSummaries[project.id].knowledge}</span>
                          <span className="text-gray-600">knowledge</span>
                        </span>
                      )}

                      {/* Bugs */}
                      {projectSummaries[project.id].bugs > 0 && (
                        <span className="flex items-center gap-1 text-gray-400">
                          <AlertCircle className="w-3 h-3" />
                          <span className="text-red-400">{projectSummaries[project.id].bugs}</span>
                          <span className="text-gray-600">bugs</span>
                        </span>
                      )}

                      {/* Pending Sessions */}
                      {projectSummaries[project.id].sessions.pending > 0 && (
                        <span className="flex items-center gap-1 px-1.5 py-0.5 bg-yellow-600/10 text-yellow-400 rounded">
                          {projectSummaries[project.id].sessions.pending} pending
                        </span>
                      )}

                      {/* Last Activity */}
                      {projectSummaries[project.id].last_activity && (
                        <span className="flex items-center gap-1 text-gray-500 ml-auto">
                          <Clock className="w-3 h-3" />
                          {formatTimeAgo(projectSummaries[project.id].last_activity)}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Project Form Modal */}
      {showProjectForm && (
        <ProjectForm
          project={editingProject}
          onClose={handleFormClose}
          onSave={handleFormSave}
        />
      )}
    </div>
  );
}
