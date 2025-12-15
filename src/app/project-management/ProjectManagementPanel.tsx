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
import DatabaseTab from './tabs/DatabaseTab';
import StructureTab from './tabs/StructureTab';
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
      case 'database':
        return <DatabaseTab projectPath={projectPath} tablePrefix={selectedProject.table_prefix} />;
      case 'structure':
        return <StructureTab projectPath={projectPath} />;
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
        <div className="flex-1 overflow-auto space-y-2">
          {projects.map(project => (
            <div
              key={project.id}
              onClick={() => handleSelectProject(project)}
              className="p-3 bg-gray-800 hover:bg-gray-750 border border-gray-700 hover:border-blue-500 rounded cursor-pointer group transition-colors"
            >
              <div className="flex items-start gap-3">
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
                    {project.git_repository && (
                      <span className="text-gray-500 truncate max-w-[200px]">
                        {project.git_repository.replace('https://github.com/', '')}
                      </span>
                    )}
                  </div>
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
