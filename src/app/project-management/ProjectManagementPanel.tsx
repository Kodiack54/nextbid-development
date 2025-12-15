'use client';

import { useState, useEffect } from 'react';
import { Plus, ArrowLeft, Server, ChevronRight, Settings } from 'lucide-react';
import { Project, TabType, TABS } from './types';
import ProjectHeader from './components/ProjectHeader';
import ProjectTabs from './components/ProjectTabs';
import ProjectForm from './components/ProjectForm';

// Tab Components
import TodosTab from './tabs/TodosTab';
import DocsTab from './tabs/DocsTab';
import TablesTab from './tabs/TablesTab';
import SchemasTab from './tabs/SchemasTab';
import CodeChangesTab from './tabs/CodeChangesTab';
import NotepadTab from './tabs/NotepadTab';
import BugsTab from './tabs/BugsTab';

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

  useEffect(() => {
    fetchProjects();
  }, []);

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

  const renderTabContent = () => {
    if (!selectedProject) return null;
    const projectPath = selectedProject.server_path || '';

    switch (activeTab) {
      case 'todos':
        return <TodosTab projectPath={projectPath} />;
      case 'docs':
        return <DocsTab projectPath={projectPath} />;
      case 'tables':
        return <TablesTab projectPath={projectPath} tablePrefix={selectedProject.table_prefix} />;
      case 'schemas':
        return <SchemasTab projectPath={projectPath} />;
      case 'code-changes':
        return <CodeChangesTab projectPath={projectPath} />;
      case 'notepad':
        return <NotepadTab projectPath={projectPath} />;
      case 'bugs':
        return <BugsTab projectPath={projectPath} />;
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
        <div className="flex-1 overflow-auto space-y-1">
          {projects.map(project => (
            <div
              key={project.id}
              onClick={() => handleSelectProject(project)}
              className="flex items-center justify-between p-2 bg-gray-800 hover:bg-gray-750 border border-gray-700 hover:border-blue-500 rounded cursor-pointer group transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                {/* Logo/Initial */}
                {project.logo_url ? (
                  <img src={project.logo_url} alt="" className="w-8 h-8 rounded object-cover" />
                ) : (
                  <div className="w-8 h-8 rounded bg-blue-600/20 flex items-center justify-center text-blue-400 text-sm font-bold flex-shrink-0">
                    {project.name.charAt(0).toUpperCase()}
                  </div>
                )}

                {/* Info */}
                <div className="min-w-0">
                  <div className="text-white font-medium text-sm truncate">{project.name}</div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    {project.droplet_name && <span>{project.droplet_name}</span>}
                    {project.port_dev && <span className="text-blue-400">:{project.port_dev}</span>}
                  </div>
                </div>
              </div>

              {/* Arrow */}
              <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-blue-400 flex-shrink-0" />
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
