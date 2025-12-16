'use client';

import { useState, useEffect } from 'react';
import { GitCommit, GitBranch, FileCode, Clock } from 'lucide-react';

// Extended interface to handle both database formats
interface CodeChangeRecord {
  id: string;
  project_path: string;
  commit_hash?: string;
  commit_message?: string;
  author?: string;
  files_changed?: string[];
  file_path?: string;  // Individual file format from catalog
  action?: string;
  summary?: string;
  build_number?: string;
  created_at: string;
}

interface CodeChangesTabProps {
  projectPath: string;
}

export default function CodeChangesTab({ projectPath }: CodeChangesTabProps) {
  const [changes, setChanges] = useState<CodeChangeRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchChanges();
  }, [projectPath]);

  const fetchChanges = async () => {
    try {
      const response = await fetch(`/api/susan/code-changes?project=${encodeURIComponent(projectPath)}`);
      const data = await response.json();
      if (data.success) {
        setChanges(data.changes || []);
      }
    } catch (error) {
      console.error('Error fetching code changes:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Get files list - handle both array and single file formats
  const getFilesChanged = (change: CodeChangeRecord): string[] => {
    if (change.files_changed && Array.isArray(change.files_changed)) {
      return change.files_changed;
    }
    if (change.file_path) {
      return [change.file_path];
    }
    return [];
  };

  // Get display message - use commit_message, summary, or action
  const getMessage = (change: CodeChangeRecord): string => {
    if (change.commit_message) return change.commit_message;
    if (change.summary) return change.summary;
    if (change.action && change.file_path) {
      return `${change.action}: ${change.file_path.split('/').pop()}`;
    }
    return 'Code change';
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
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
        <h2 className="text-lg font-semibold text-white">Code Changes</h2>
        <span className="text-gray-400 text-sm">{changes.length} commits logged</span>
      </div>

      {/* Changes List */}
      {changes.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <GitCommit className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No code changes logged yet</p>
          <p className="text-sm mt-1">Chad will log commits as they happen</p>
        </div>
      ) : (
        <div className="space-y-3">
          {changes.map(change => {
            const filesChanged = getFilesChanged(change);
            const message = getMessage(change);

            return (
              <div
                key={change.id}
                className="bg-gray-800 border border-gray-700 rounded-lg p-4"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="mt-1 w-8 h-8 rounded-full bg-blue-600/20 flex items-center justify-center">
                      <GitCommit className="w-4 h-4 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-white font-medium">{message}</p>
                      <div className="flex items-center gap-3 mt-2 text-sm text-gray-500">
                        {change.commit_hash && (
                          <span className="font-mono text-xs bg-gray-700 px-2 py-0.5 rounded">
                            {change.commit_hash.slice(0, 7)}
                          </span>
                        )}
                        {change.action && !change.commit_hash && (
                          <span className="text-xs bg-purple-700/50 text-purple-300 px-2 py-0.5 rounded">
                            {change.action}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDate(change.created_at)}
                        </span>
                        {change.author && <span>{change.author}</span>}
                      </div>

                      {/* Files Changed */}
                      {filesChanged.length > 0 && (
                        <div className="mt-3">
                          <div className="flex items-center gap-1 text-gray-500 text-xs mb-1">
                            <FileCode className="w-3 h-3" />
                            {filesChanged.length} file{filesChanged.length !== 1 ? 's' : ''} changed
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {filesChanged.slice(0, 5).map((file, i) => (
                              <span
                                key={i}
                                className="text-xs bg-gray-700 text-gray-400 px-2 py-0.5 rounded font-mono"
                              >
                                {file.split('/').pop()}
                              </span>
                            ))}
                            {filesChanged.length > 5 && (
                              <span className="text-xs text-gray-500">
                                +{filesChanged.length - 5} more
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Build Number */}
                  {change.build_number && (
                    <span className="px-2 py-1 bg-green-600/20 text-green-400 rounded text-xs">
                      Build #{change.build_number}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
