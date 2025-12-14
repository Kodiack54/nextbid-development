'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface Project {
  id: string;
  name: string;
}

interface FileItem {
  id: string | null;
  name: string;
  path: string;
  url: string;
  isFolder: boolean;
  metadata?: {
    size?: number;
    mimetype?: string;
  };
  created_at?: string;
}

interface FilesPanelProps {
  project: Project | null;
}

export function FilesPanel({ project }: FilesPanelProps) {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [currentPath, setCurrentPath] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);
  const [movingFile, setMovingFile] = useState<FileItem | null>(null);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // Fetch files when project or path changes
  const fetchFiles = useCallback(async () => {
    if (!project) return;

    setLoading(true);
    try {
      const folder = currentPath.join('/');
      const res = await fetch(`/api/files?project_id=${project.id}&folder=${folder}`);
      const data = await res.json();

      if (data.success) {
        // Filter out .keep files and sort folders first
        const filteredFiles = (data.files || [])
          .filter((f: FileItem) => f.name !== '.keep')
          .sort((a: FileItem, b: FileItem) => {
            if (a.isFolder && !b.isFolder) return -1;
            if (!a.isFolder && b.isFolder) return 1;
            return a.name.localeCompare(b.name);
          });
        setFiles(filteredFiles);
      }
    } catch (error) {
      console.error('Failed to fetch files:', error);
    } finally {
      setLoading(false);
    }
  }, [project, currentPath]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  // Handle file upload (supports files with relative paths for folder uploads)
  const handleUpload = async (filesToUpload: FileList | File[], preservePaths = false) => {
    if (!project) return;

    setUploading(true);
    const baseFolder = currentPath.join('/');
    const fileArray = Array.from(filesToUpload);
    let uploaded = 0;

    try {
      for (const file of fileArray) {
        uploaded++;
        setUploadProgress(`${uploaded}/${fileArray.length}: ${file.name}`);

        // Get relative path if available (for folder uploads)
        const relativePath = (file as any).webkitRelativePath || '';
        let targetFolder = baseFolder;

        if (preservePaths && relativePath) {
          // Extract folder path from relative path (remove filename)
          const pathParts = relativePath.split('/');
          pathParts.pop(); // Remove filename
          if (pathParts.length > 0) {
            targetFolder = baseFolder ? `${baseFolder}/${pathParts.join('/')}` : pathParts.join('/');
          }
        }

        const formData = new FormData();
        formData.append('file', file);
        formData.append('project_id', project.id);
        formData.append('folder', targetFolder);

        await fetch('/api/files', {
          method: 'POST',
          body: formData,
        });
      }

      await fetchFiles();
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  };

  // Handle drag & drop (supports folders)
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);

    const items = e.dataTransfer.items;
    const allFiles: File[] = [];

    // Process dropped items to get all files (including from folders)
    const processEntry = async (entry: FileSystemEntry, path = ''): Promise<void> => {
      if (entry.isFile) {
        const fileEntry = entry as FileSystemFileEntry;
        return new Promise((resolve) => {
          fileEntry.file((file) => {
            // Attach the relative path to the file
            Object.defineProperty(file, 'webkitRelativePath', {
              value: path ? `${path}/${file.name}` : file.name,
              writable: false,
            });
            allFiles.push(file);
            resolve();
          });
        });
      } else if (entry.isDirectory) {
        const dirEntry = entry as FileSystemDirectoryEntry;
        const dirReader = dirEntry.createReader();
        return new Promise((resolve) => {
          dirReader.readEntries(async (entries) => {
            for (const subEntry of entries) {
              await processEntry(subEntry, path ? `${path}/${entry.name}` : entry.name);
            }
            resolve();
          });
        });
      }
    };

    if (items && items.length > 0) {
      const entries: FileSystemEntry[] = [];
      for (let i = 0; i < items.length; i++) {
        const entry = items[i].webkitGetAsEntry();
        if (entry) entries.push(entry);
      }

      for (const entry of entries) {
        await processEntry(entry);
      }

      if (allFiles.length > 0) {
        handleUpload(allFiles, true);
      }
    } else if (e.dataTransfer.files.length > 0) {
      handleUpload(e.dataTransfer.files);
    }
  };

  // Move file to a different folder
  const handleMoveFile = async (file: FileItem, targetFolder: string) => {
    if (!project) return;

    try {
      // Download the file first
      const response = await fetch(file.url);
      const blob = await response.blob();
      const newFile = new File([blob], file.name, { type: blob.type });

      // Upload to new location
      const formData = new FormData();
      formData.append('file', newFile);
      formData.append('project_id', project.id);
      formData.append('folder', targetFolder);

      await fetch('/api/files', {
        method: 'POST',
        body: formData,
      });

      // Delete from old location
      await fetch(`/api/files?path=${encodeURIComponent(file.path)}`, {
        method: 'DELETE',
      });

      setMovingFile(null);
      setSelectedFile(null);
      await fetchFiles();
    } catch (error) {
      console.error('Failed to move file:', error);
    }
  };

  // Create new folder
  const handleCreateFolder = async () => {
    if (!project || !newFolderName.trim()) return;

    try {
      await fetch('/api/files/folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: project.id,
          folder_path: currentPath.join('/'),
          folder_name: newFolderName.trim(),
        }),
      });

      setNewFolderName('');
      setShowNewFolder(false);
      await fetchFiles();
    } catch (error) {
      console.error('Failed to create folder:', error);
    }
  };

  // Delete file
  const handleDelete = async (file: FileItem) => {
    if (!confirm(`Delete ${file.name}?`)) return;

    try {
      await fetch(`/api/files?path=${encodeURIComponent(file.path)}`, {
        method: 'DELETE',
      });
      setSelectedFile(null);
      await fetchFiles();
    } catch (error) {
      console.error('Failed to delete:', error);
    }
  };

  // Navigate to folder
  const navigateToFolder = (folderName: string) => {
    setCurrentPath([...currentPath, folderName]);
    setSelectedFile(null);
  };

  // Navigate up
  const navigateUp = () => {
    setCurrentPath(currentPath.slice(0, -1));
    setSelectedFile(null);
  };

  // Get file icon
  const getFileIcon = (file: FileItem) => {
    if (file.isFolder) return '📁';

    const ext = file.name.split('.').pop()?.toLowerCase();
    const icons: Record<string, string> = {
      md: '📝',
      txt: '📄',
      json: '📋',
      js: '🟨',
      ts: '🔷',
      tsx: '⚛️',
      jsx: '⚛️',
      css: '🎨',
      html: '🌐',
      png: '🖼️',
      jpg: '🖼️',
      jpeg: '🖼️',
      gif: '🖼️',
      svg: '🖼️',
      webp: '🖼️',
      pdf: '📕',
      zip: '📦',
      sql: '🗃️',
    };

    return icons[ext || ''] || '📄';
  };

  // Check if file is previewable image
  const isImage = (file: FileItem) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    return ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext || '');
  };

  if (!project) {
    return <p className="text-gray-500 text-sm">Select a project first</p>;
  }

  return (
    <div className="h-full flex flex-col text-sm">
      {/* Toolbar */}
      <div className="flex items-center gap-1 mb-2 pb-2 border-b border-gray-700 flex-wrap">
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="px-2 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 text-white text-xs rounded"
          title="Upload files"
        >
          {uploading ? 'Uploading...' : 'Files'}
        </button>
        <button
          onClick={() => folderInputRef.current?.click()}
          disabled={uploading}
          className="px-2 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 text-white text-xs rounded"
          title="Upload entire folder"
        >
          Folder
        </button>
        <button
          onClick={() => setShowNewFolder(true)}
          className="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded"
          title="Create new folder"
        >
          + Folder
        </button>
        <button
          onClick={fetchFiles}
          disabled={loading}
          className="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded"
        >
          {loading ? '...' : 'Refresh'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && handleUpload(e.target.files)}
        />
        <input
          ref={folderInputRef}
          type="file"
          multiple
          // @ts-ignore - webkitdirectory is a non-standard attribute
          webkitdirectory=""
          directory=""
          className="hidden"
          onChange={(e) => e.target.files && handleUpload(e.target.files, true)}
        />
      </div>

      {/* Upload Progress */}
      {uploadProgress && (
        <div className="text-xs text-blue-400 mb-2 truncate">
          Uploading: {uploadProgress}
        </div>
      )}

      {/* Breadcrumb */}
      <div className="flex items-center gap-1 text-xs text-gray-400 mb-2">
        <button
          onClick={() => setCurrentPath([])}
          className="hover:text-white"
        >
          {project.name}
        </button>
        {currentPath.map((part, i) => (
          <span key={i} className="flex items-center gap-1">
            <span>/</span>
            <button
              onClick={() => setCurrentPath(currentPath.slice(0, i + 1))}
              className="hover:text-white"
            >
              {part}
            </button>
          </span>
        ))}
      </div>

      {/* New Folder Input */}
      {showNewFolder && (
        <div className="flex items-center gap-1 mb-2">
          <input
            type="text"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder="Folder name"
            className="flex-1 px-2 py-1 bg-gray-800 border border-gray-600 rounded text-xs text-white"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreateFolder();
              if (e.key === 'Escape') setShowNewFolder(false);
            }}
          />
          <button
            onClick={handleCreateFolder}
            className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white text-xs rounded"
          >
            Create
          </button>
          <button
            onClick={() => setShowNewFolder(false)}
            className="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Drop Zone / File List */}
      <div
        className={`flex-1 overflow-auto rounded border-2 border-dashed transition-colors ${
          dragOver ? 'border-blue-500 bg-blue-500/10' : 'border-transparent'
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        {/* Back button */}
        {currentPath.length > 0 && (
          <button
            onClick={navigateUp}
            className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-gray-700 rounded text-gray-400"
          >
            <span>⬆️</span>
            <span>..</span>
          </button>
        )}

        {/* Files */}
        {loading ? (
          <div className="text-center text-gray-500 py-4">Loading...</div>
        ) : files.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <p>No files yet</p>
            <p className="text-xs mt-1">Drag & drop files here or click Upload</p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {files.map((file) => (
              <div
                key={file.path}
                className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer ${
                  selectedFile?.path === file.path ? 'bg-blue-600' : 'hover:bg-gray-700'
                }`}
                onClick={() => {
                  if (file.isFolder) {
                    navigateToFolder(file.name);
                  } else {
                    setSelectedFile(file);
                  }
                }}
                onDoubleClick={() => {
                  if (!file.isFolder && isImage(file)) {
                    setPreviewFile(file);
                  } else if (!file.isFolder) {
                    window.open(file.url, '_blank');
                  }
                }}
              >
                <span>{getFileIcon(file)}</span>
                <span className="flex-1 truncate text-gray-200">{file.name}</span>
                {file.metadata?.size && (
                  <span className="text-gray-500 text-[10px]">
                    {formatSize(file.metadata.size)}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Selected File Actions */}
      {selectedFile && !selectedFile.isFolder && (
        <div className="mt-2 pt-2 border-t border-gray-700">
          <div className="flex items-center gap-1 flex-wrap">
            <button
              onClick={() => window.open(selectedFile.url, '_blank')}
              className="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded"
            >
              Open
            </button>
            {isImage(selectedFile) && (
              <button
                onClick={() => setPreviewFile(selectedFile)}
                className="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded"
              >
                Preview
              </button>
            )}
            <button
              onClick={() => {
                navigator.clipboard.writeText(selectedFile.url);
              }}
              className="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded"
            >
              Copy URL
            </button>
            <button
              onClick={() => setMovingFile(selectedFile)}
              className="px-2 py-1 bg-yellow-600 hover:bg-yellow-700 text-white text-xs rounded"
            >
              Move
            </button>
            <button
              onClick={() => handleDelete(selectedFile)}
              className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded"
            >
              Delete
            </button>
          </div>

          {/* Move destination selector */}
          {movingFile && (
            <div className="mt-2 p-2 bg-gray-800 rounded border border-gray-600">
              <div className="text-xs text-gray-400 mb-2">Move "{movingFile.name}" to:</div>
              <div className="space-y-1 max-h-32 overflow-auto">
                {currentPath.length > 0 && (
                  <button
                    onClick={() => handleMoveFile(movingFile, currentPath.slice(0, -1).join('/'))}
                    className="w-full text-left px-2 py-1 text-xs text-gray-300 hover:bg-gray-700 rounded"
                  >
                    .. (parent folder)
                  </button>
                )}
                <button
                  onClick={() => handleMoveFile(movingFile, '')}
                  className="w-full text-left px-2 py-1 text-xs text-gray-300 hover:bg-gray-700 rounded"
                >
                  / (root)
                </button>
                {files.filter(f => f.isFolder).map(folder => (
                  <button
                    key={folder.path}
                    onClick={() => handleMoveFile(movingFile, `${currentPath.join('/')}${currentPath.length ? '/' : ''}${folder.name}`)}
                    className="w-full text-left px-2 py-1 text-xs text-gray-300 hover:bg-gray-700 rounded flex items-center gap-1"
                  >
                    <span>📁</span> {folder.name}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setMovingFile(null)}
                className="mt-2 px-2 py-1 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded w-full"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}

      {/* Image Preview Modal */}
      {previewFile && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"
          onClick={() => setPreviewFile(null)}
        >
          <div className="max-w-4xl max-h-[90vh] p-4">
            <img
              src={previewFile.url}
              alt={previewFile.name}
              className="max-w-full max-h-full object-contain rounded"
            />
            <div className="text-center mt-2 text-white text-sm">
              {previewFile.name}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
