'use client';

import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Save, X, FolderGit2, Server, Image, ExternalLink } from 'lucide-react';
import { Project } from '../../types';

interface ProjectManagerPanelProps {
  onSelectProject?: (project: Project) => void;
  onProjectsChange?: () => void;
}

export function ProjectManagerPanel({ onSelectProject, onProjectsChange }: ProjectManagerPanelProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState<Partial<Project>>({});
  const [nextPorts, setNextPorts] = useState({ dev: 5100, test: 5000, prod: 8000 });

  useEffect(() => {
    loadProjects();
  }, []);

  async function loadProjects() {
    try {
      const res = await fetch('/api/projects');
      const data = await res.json();
      if (data.success) {
        setProjects(data.projects || []);
        // Calculate next available ports
        const maxDev = Math.max(...(data.projects || []).map((p: Project) => p.port_dev || 0), 5099);
        const maxTest = Math.max(...(data.projects || []).map((p: Project) => p.port_test || 0), 4999);
        const maxProd = Math.max(...(data.projects || []).map((p: Project) => p.port_prod || 0), 7999);
        setNextPorts({ dev: maxDev + 1, test: maxTest + 1, prod: maxProd + 1 });
      }
    } catch (err) {
      console.error('Failed to load projects:', err);
    } finally {
      setLoading(false);
    }
  }

  function startEdit(project: Project) {
    setEditingId(project.id);
    setFormData({ ...project });
  }

  function cancelEdit() {
    setEditingId(null);
    setFormData({});
  }

  function startAdd() {
    setShowAddForm(true);
    setFormData({
      name: '',
      slug: '',
      description: '',
      droplet_name: 'Dev',
      droplet_ip: '161.35.229.220',
      server_path: '/var/www/NextBid_Dev/',
      port_dev: nextPorts.dev,
      port_test: nextPorts.test,
      port_prod: nextPorts.prod,
      git_repo: '',
      table_prefix: '',
      is_active: true,
    });
  }

  async function saveProject() {
    if (!formData.name || !formData.slug) {
      alert('Name and slug are required');
      return;
    }

    try {
      const isNew = !editingId;
      const url = isNew ? '/api/projects' : `/api/projects/${editingId}`;
      const res = await fetch(url, {
        method: isNew ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (data.success) {
        await loadProjects(); onProjectsChange?.();
        setEditingId(null);
        setShowAddForm(false);
        setFormData({});
      } else {
        alert(data.error || 'Failed to save');
      }
    } catch (err) {
      console.error('Error saving project:', err);
    }
  }

  async function deleteProject(id: string, name: string) {
    if (!confirm(`Delete project "${name}"? This cannot be undone.`)) return;

    try {
      const res = await fetch(`/api/projects?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        await loadProjects(); onProjectsChange?.();
      } else {
        alert(data.error || 'Failed to delete');
      }
    } catch (err) {
      console.error('Error deleting project:', err);
    }
  }

  function handleInputChange(field: keyof Project, value: string | number | boolean) {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Auto-generate slug from name
    if (field === 'name' && !editingId) {
      const slug = String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      setFormData(prev => ({ ...prev, slug }));
    }
  }

  const ProjectForm = ({ isNew = false }: { isNew?: boolean }) => (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Project Name *</label>
          <input
            type="text"
            value={formData.name || ''}
            onChange={e => handleInputChange('name', e.target.value)}
            className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm"
            placeholder="NextSource"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Slug *</label>
          <input
            type="text"
            value={formData.slug || ''}
            onChange={e => handleInputChange('slug', e.target.value)}
            className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm"
            placeholder="source"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs text-gray-400 mb-1">Description</label>
        <input
          type="text"
          value={formData.description || ''}
          onChange={e => handleInputChange('description', e.target.value)}
          className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm"
          placeholder="Source management system"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Droplet Name</label>
          <input
            type="text"
            value={formData.droplet_name || ''}
            onChange={e => handleInputChange('droplet_name', e.target.value)}
            className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm"
            placeholder="Dev"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Droplet IP</label>
          <input
            type="text"
            value={formData.droplet_ip || ''}
            onChange={e => handleInputChange('droplet_ip', e.target.value)}
            className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm"
            placeholder="161.35.229.220"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs text-gray-400 mb-1">Server Path</label>
        <input
          type="text"
          value={formData.server_path || ''}
          onChange={e => handleInputChange('server_path', e.target.value)}
          className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm font-mono"
          placeholder="/var/www/NextBid_Dev/source-dev-5102"
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Dev Port</label>
          <input
            type="number"
            value={formData.port_dev || ''}
            onChange={e => handleInputChange('port_dev', parseInt(e.target.value))}
            className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Test Port</label>
          <input
            type="number"
            value={formData.port_test || ''}
            onChange={e => handleInputChange('port_test', parseInt(e.target.value))}
            className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Prod Port</label>
          <input
            type="number"
            value={formData.port_prod || ''}
            onChange={e => handleInputChange('port_prod', parseInt(e.target.value))}
            className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Git Repository</label>
          <input
            type="text"
            value={formData.git_repo || ''}
            onChange={e => handleInputChange('git_repo', e.target.value)}
            className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm"
            placeholder="https://github.com/..."
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Table Prefix</label>
          <input
            type="text"
            value={formData.table_prefix || ''}
            onChange={e => handleInputChange('table_prefix', e.target.value)}
            className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm"
            placeholder="nextsource"
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button
          onClick={() => { setEditingId(null); setShowAddForm(false); setFormData({}); }}
          className="px-3 py-1.5 text-gray-400 hover:text-white text-sm flex items-center gap-1"
        >
          <X className="w-4 h-4" /> Cancel
        </button>
        <button
          onClick={saveProject}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm flex items-center gap-1"
        >
          <Save className="w-4 h-4" /> {isNew ? 'Create Project' : 'Save Changes'}
        </button>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400">
        Loading projects...
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <FolderGit2 className="w-5 h-5 text-blue-400" />
          <h2 className="text-white font-semibold">Project Manager</h2>
          <span className="text-gray-500 text-sm">({projects.length})</span>
        </div>
        <button
          onClick={startAdd}
          className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded text-sm flex items-center gap-1"
        >
          <Plus className="w-4 h-4" /> Add Project
        </button>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div className="p-4 border-b border-gray-700">
          <h3 className="text-white font-medium mb-3">New Project</h3>
          <ProjectForm isNew />
        </div>
      )}

      {/* Project List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {projects.map(project => (
          <div key={project.id} className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
            {editingId === project.id ? (
              <div className="p-4">
                <ProjectForm />
              </div>
            ) : (
              <div className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    {project.logo_url ? (
                      <img src={project.logo_url} alt="" className="w-10 h-10 rounded" />
                    ) : (
                      <div className="w-10 h-10 bg-gray-700 rounded flex items-center justify-center">
                        <Server className="w-5 h-5 text-gray-500" />
                      </div>
                    )}
                    <div>
                      <h3 className="text-white font-medium">{project.name}</h3>
                      <p className="text-gray-500 text-sm">{project.slug}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => startEdit(project)}
                      className="p-1.5 text-gray-400 hover:text-blue-400 hover:bg-gray-700 rounded"
                      title="Edit"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteProject(project.id, project.name)}
                      className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {project.description && (
                  <p className="text-gray-400 text-sm mt-2">{project.description}</p>
                )}

                <div className="grid grid-cols-3 gap-4 mt-3 text-sm">
                  <div>
                    <span className="text-gray-500">Droplet:</span>
                    <span className="text-gray-300 ml-2">{project.droplet_name}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Ports:</span>
                    <span className="text-gray-300 ml-2">
                      {project.port_dev}/{project.port_test}/{project.port_prod}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Prefix:</span>
                    <span className="text-gray-300 ml-2">{project.table_prefix || '-'}</span>
                  </div>
                </div>

                {project.git_repo && (
                  <div className="mt-2 flex items-center gap-2">
                    <FolderGit2 className="w-4 h-4 text-gray-500" />
                    <a
                      href={project.git_repo}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 text-sm hover:underline flex items-center gap-1"
                    >
                      {project.git_repo.replace('https://github.com/', '')}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}

                <div className="mt-3 pt-3 border-t border-gray-700">
                  <code className="text-xs text-gray-500 font-mono">{project.server_path}</code>
                </div>
              </div>
            )}
          </div>
        ))}

        {projects.length === 0 && !showAddForm && (
          <div className="text-center text-gray-500 py-8">
            <Server className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No projects yet</p>
            <button
              onClick={startAdd}
              className="mt-2 text-blue-400 hover:underline"
            >
              Create your first project
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default ProjectManagerPanel;
