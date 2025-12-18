'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Project } from '../types';

interface Client {
  id: string;
  name: string;
  slug: string;
}

interface ProjectFormProps {
  project: Project | null;
  onClose: () => void;
  onSave: () => void;
}

export default function ProjectForm({ project, onClose, onSave }: ProjectFormProps) {
  const [clients, setClients] = useState<Client[]>([]);
  const [formData, setFormData] = useState({
    name: project?.name || '',
    slug: project?.slug || '',
    description: project?.description || '',
    client_id: project?.client_id || '',
    droplet_name: project?.droplet_name || '',
    droplet_ip: project?.droplet_ip || '',
    server_path: project?.server_path || '',
    port_dev: project?.port_dev?.toString() || '',
    port_test: project?.port_test?.toString() || '',
    port_prod: project?.port_prod?.toString() || '',
    git_repo: project?.git_repo || '',
    table_prefix: project?.table_prefix || '',
    logo_url: project?.logo_url || '',
    is_active: project?.is_active ?? true,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    try {
      const response = await fetch('/api/clients');
      const data = await response.json();
      if (data.success) {
        setClients(data.clients);
      }
    } catch (err) {
      console.error('Failed to fetch clients:', err);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError('');

    try {
      const payload = {
        ...formData,
        client_id: formData.client_id || null,
        port_dev: formData.port_dev ? parseInt(formData.port_dev) : null,
        port_test: formData.port_test ? parseInt(formData.port_test) : null,
        port_prod: formData.port_prod ? parseInt(formData.port_prod) : null,
      };

      const url = project ? `/api/projects/${project.id}` : '/api/projects';
      const method = project ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (data.success) {
        onSave();
      } else {
        setError(data.error || 'Failed to save project');
      }
    } catch (err) {
      setError('Failed to save project');
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 border border-gray-700 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <h2 className="text-xl font-semibold text-white">
            {project ? 'Edit Project' : 'Add Project'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[calc(90vh-130px)]">
          {error && (
            <div className="mb-4 p-3 bg-red-600/20 border border-red-500/50 text-red-400 rounded-lg">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            {/* Client Selector - Full Width at Top */}
            <div className="col-span-2">
              <label className="block text-sm text-gray-400 mb-1">Client</label>
              <select
                name="client_id"
                value={formData.client_id}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:outline-none"
              >
                <option value="">-- No Client --</option>
                {clients.map(client => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Name */}
            <div>
              <label className="block text-sm text-gray-400 mb-1">Name *</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:outline-none"
              />
            </div>

            {/* Slug */}
            <div>
              <label className="block text-sm text-gray-400 mb-1">Slug *</label>
              <input
                type="text"
                name="slug"
                value={formData.slug}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:outline-none"
              />
            </div>

            {/* Description - Full Width */}
            <div className="col-span-2">
              <label className="block text-sm text-gray-400 mb-1">Description</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={2}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:outline-none resize-none"
              />
            </div>

            {/* Droplet Name */}
            <div>
              <label className="block text-sm text-gray-400 mb-1">Droplet Name</label>
              <input
                type="text"
                name="droplet_name"
                value={formData.droplet_name}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:outline-none"
              />
            </div>

            {/* Droplet IP */}
            <div>
              <label className="block text-sm text-gray-400 mb-1">Droplet IP</label>
              <input
                type="text"
                name="droplet_ip"
                value={formData.droplet_ip}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:outline-none"
              />
            </div>

            {/* Server Path - Full Width */}
            <div className="col-span-2">
              <label className="block text-sm text-gray-400 mb-1">Server Path</label>
              <input
                type="text"
                name="server_path"
                value={formData.server_path}
                onChange={handleChange}
                placeholder="/var/www/project-name"
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:outline-none font-mono text-sm"
              />
            </div>

            {/* Ports */}
            <div>
              <label className="block text-sm text-gray-400 mb-1">Dev Port</label>
              <input
                type="number"
                name="port_dev"
                value={formData.port_dev}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Test Port</label>
              <input
                type="number"
                name="port_test"
                value={formData.port_test}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Prod Port</label>
              <input
                type="number"
                name="port_prod"
                value={formData.port_prod}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:outline-none"
              />
            </div>

            {/* Table Prefix */}
            <div>
              <label className="block text-sm text-gray-400 mb-1">Table Prefix</label>
              <input
                type="text"
                name="table_prefix"
                value={formData.table_prefix}
                onChange={handleChange}
                placeholder="project_"
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:outline-none"
              />
            </div>

            {/* Git Repository - Full Width */}
            <div className="col-span-2">
              <label className="block text-sm text-gray-400 mb-1">Git Repository</label>
              <input
                type="text"
                name="git_repo"
                value={formData.git_repo}
                onChange={handleChange}
                placeholder="https://github.com/org/repo"
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:outline-none"
              />
            </div>

            {/* Logo URL - Full Width */}
            <div className="col-span-2">
              <label className="block text-sm text-gray-400 mb-1">Logo URL</label>
              <input
                type="text"
                name="logo_url"
                value={formData.logo_url}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:outline-none"
              />
            </div>

            {/* Active Toggle */}
            <div className="col-span-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="is_active"
                  checked={formData.is_active}
                  onChange={handleChange}
                  className="w-4 h-4 rounded bg-gray-700 border-gray-600 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-gray-400">Active Project</span>
              </label>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-700">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSaving}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 transition-colors"
          >
            {isSaving ? 'Saving...' : project ? 'Update Project' : 'Create Project'}
          </button>
        </div>
      </div>
    </div>
  );
}
