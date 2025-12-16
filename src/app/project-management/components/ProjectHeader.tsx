'use client';

import { Settings, Server, GitBranch, FolderOpen, ExternalLink } from 'lucide-react';
import { Project } from '../types';

interface ProjectHeaderProps {
  project: Project;
  onEdit: () => void;
}

export default function ProjectHeader({ project, onEdit }: ProjectHeaderProps) {
  return (
    <div className="flex items-start justify-between">
      <div className="flex items-start gap-4">
        {/* Logo */}
        {project.logo_url ? (
          <img
            src={project.logo_url}
            alt={project.name}
            className="w-16 h-16 rounded-lg object-cover"
          />
        ) : (
          <div className="w-16 h-16 rounded-lg bg-blue-600/20 flex items-center justify-center text-blue-400 text-2xl font-bold">
            {project.name.charAt(0).toUpperCase()}
          </div>
        )}

        {/* Info */}
        <div>
          <h1 className="text-2xl font-bold text-white">{project.name}</h1>
          {project.description && (
            <p className="text-gray-400 mt-1">{project.description}</p>
          )}

          {/* Meta Info */}
          <div className="flex flex-wrap items-center gap-4 mt-3">
            {/* Droplet */}
            {project.droplet_name && (
              <div className="flex items-center gap-2 text-gray-400 text-sm">
                <Server className="w-4 h-4 text-gray-500" />
                <span>{project.droplet_name}</span>
                {project.droplet_ip && (
                  <span className="text-gray-600">({project.droplet_ip})</span>
                )}
              </div>
            )}

            {/* Server Path */}
            {project.server_path && (
              <div className="flex items-center gap-2 text-gray-400 text-sm">
                <FolderOpen className="w-4 h-4 text-gray-500" />
                <span className="font-mono text-xs">{project.server_path}</span>
              </div>
            )}

            {/* Git */}
            {project.git_repo && (
              <a
                href={project.git_repo}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-gray-400 hover:text-blue-400 text-sm transition-colors"
              >
                <GitBranch className="w-4 h-4" />
                <span>Repository</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>

          {/* Ports Row */}
          <div className="flex items-center gap-3 mt-3">
            {project.port_dev && (
              <a
                href={`http://${project.droplet_ip || 'localhost'}:${project.port_dev}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1 bg-blue-600/20 text-blue-400 rounded text-sm hover:bg-blue-600/30 transition-colors flex items-center gap-1"
              >
                Dev: {project.port_dev}
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
            {project.port_test && (
              <a
                href={`http://${project.droplet_ip || 'localhost'}:${project.port_test}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1 bg-yellow-600/20 text-yellow-400 rounded text-sm hover:bg-yellow-600/30 transition-colors flex items-center gap-1"
              >
                Test: {project.port_test}
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
            {project.port_prod && (
              <a
                href={`http://${project.droplet_ip || 'localhost'}:${project.port_prod}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1 bg-green-600/20 text-green-400 rounded text-sm hover:bg-green-600/30 transition-colors flex items-center gap-1"
              >
                Prod: {project.port_prod}
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
            {project.build_number && (
              <span className="px-3 py-1 bg-gray-700 text-gray-400 rounded text-sm">
                Build #{project.build_number}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Edit Button */}
      <button
        onClick={onEdit}
        className="flex items-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
      >
        <Settings className="w-4 h-4" />
        Edit
      </button>
    </div>
  );
}
