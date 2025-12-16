'use client';

import { Settings, Server, GitBranch, ChevronUp, ChevronDown } from 'lucide-react';
import { Project } from '../types';

interface ProjectCardProps {
  project: Project;
  onClick: () => void;
  onEdit: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  isFirst?: boolean;
  isLast?: boolean;
}

export default function ProjectCard({ project, onClick, onEdit, onMoveUp, onMoveDown, isFirst, isLast }: ProjectCardProps) {
  return (
    <div
      className="bg-gray-800 border border-gray-700 rounded-lg p-4 hover:border-blue-500 transition-colors cursor-pointer group"
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          {project.logo_url ? (
            <img
              src={project.logo_url}
              alt={project.name}
              className="w-10 h-10 rounded-lg object-cover"
            />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-blue-600/20 flex items-center justify-center text-blue-400 text-lg font-bold">
              {project.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <h3 className="text-white font-semibold">{project.name}</h3>
            <span className="text-gray-500 text-xs">{project.slug}</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {/* Move buttons */}
          <div className="flex flex-col opacity-0 group-hover:opacity-100 transition-all">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onMoveUp?.();
              }}
              disabled={isFirst}
              className={`p-0.5 rounded ${isFirst ? 'text-gray-600 cursor-not-allowed' : 'text-gray-500 hover:text-white hover:bg-gray-700'}`}
              title="Move up"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onMoveDown?.();
              }}
              disabled={isLast}
              className={`p-0.5 rounded ${isLast ? 'text-gray-600 cursor-not-allowed' : 'text-gray-500 hover:text-white hover:bg-gray-700'}`}
              title="Move down"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="p-1.5 text-gray-500 hover:text-white hover:bg-gray-700 rounded opacity-0 group-hover:opacity-100 transition-all"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Description */}
      {project.description && (
        <p className="text-gray-400 text-sm mb-3 line-clamp-2">{project.description}</p>
      )}

      {/* Info Grid */}
      <div className="space-y-2 text-sm">
        {/* Droplet */}
        {project.droplet_name && (
          <div className="flex items-center gap-2 text-gray-400">
            <Server className="w-4 h-4 text-gray-500" />
            <span>{project.droplet_name}</span>
            {project.droplet_ip && (
              <span className="text-gray-600">({project.droplet_ip})</span>
            )}
          </div>
        )}

        {/* Ports */}
        <div className="flex items-center gap-2">
          {project.port_dev && (
            <span className="px-2 py-0.5 bg-blue-600/20 text-blue-400 rounded text-xs">
              Dev: {project.port_dev}
            </span>
          )}
          {project.port_test && (
            <span className="px-2 py-0.5 bg-yellow-600/20 text-yellow-400 rounded text-xs">
              Test: {project.port_test}
            </span>
          )}
          {project.port_prod && (
            <span className="px-2 py-0.5 bg-green-600/20 text-green-400 rounded text-xs">
              Prod: {project.port_prod}
            </span>
          )}
        </div>

        {/* Git & Build */}
        <div className="flex items-center justify-between">
          {project.git_repo && (
            <div className="flex items-center gap-1 text-gray-500">
              <GitBranch className="w-3 h-3" />
              <span className="text-xs truncate max-w-[150px]">
                {project.git_repo.split('/').pop()?.replace('.git', '')}
              </span>
            </div>
          )}
          {project.build_number && (
            <span className="text-xs text-gray-600">
              Build #{project.build_number}
            </span>
          )}
        </div>
      </div>

      {/* Status Indicator */}
      <div className="mt-3 pt-3 border-t border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${project.is_active ? 'bg-green-500' : 'bg-gray-500'}`} />
          <span className="text-xs text-gray-500">
            {project.is_active ? 'Active' : 'Inactive'}
          </span>
        </div>
        <span className="text-xs text-gray-600">
          Click to view
        </span>
      </div>
    </div>
  );
}
