'use client';

import { useState, useEffect, useCallback } from 'react';

interface StorageStats {
  summary: {
    totalStorage: number;
    totalFiles: number;
    bucketCount: number;
  };
  buckets: Array<{
    name: string;
    fileCount: number;
    totalSize: number;
    byType: Record<string, { count: number; size: number }>;
  }>;
  largestFiles: Array<{
    name: string;
    size: number;
    path: string;
    bucket: string;
  }>;
  byType: Record<string, { count: number; size: number }>;
  warnings: string[];
}

export function StorageMonitorPanel() {
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedBucket, setExpandedBucket] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/storage-stats');
      const data = await res.json();
      if (data.success) {
        setStats(data);
      } else {
        setError(data.error || 'Failed to load stats');
      }
    } catch (err) {
      setError('Failed to fetch storage stats');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const getTypeIcon = (type: string): string => {
    const icons: Record<string, string> = {
      image: '🖼️',
      document: '📄',
      text: '📝',
      archive: '📦',
      video: '🎬',
      audio: '🎵',
      log: '📋',
      other: '📎',
    };
    return icons[type] || '📎';
  };

  const getTypeColor = (type: string): string => {
    const colors: Record<string, string> = {
      image: 'bg-purple-500',
      document: 'bg-blue-500',
      text: 'bg-green-500',
      archive: 'bg-yellow-500',
      video: 'bg-red-500',
      audio: 'bg-pink-500',
      log: 'bg-orange-500',
      other: 'bg-gray-500',
    };
    return colors[type] || 'bg-gray-500';
  };

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center h-32 text-gray-500">
        Loading storage stats...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-center">
        <p className="text-red-400 mb-2">{error}</p>
        <button
          onClick={fetchStats}
          className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!stats) return null;

  const totalMB = stats.summary.totalStorage / (1024 * 1024);
  const quotaMB = 1024; // 1GB assumed quota - adjust as needed
  const usagePercent = Math.min((totalMB / quotaMB) * 100, 100);

  return (
    <div className="h-full flex flex-col text-sm overflow-auto">
      {/* Header with refresh */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-gray-400">Storage Monitor</span>
        <button
          onClick={fetchStats}
          disabled={loading}
          className="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded"
        >
          {loading ? '...' : 'Refresh'}
        </button>
      </div>

      {/* Warnings */}
      {stats.warnings.length > 0 && (
        <div className="mb-3 p-2 bg-yellow-900/30 border border-yellow-600/50 rounded">
          <div className="text-yellow-400 text-xs font-medium mb-1">Warnings</div>
          {stats.warnings.map((warning, i) => (
            <div key={i} className="text-yellow-300 text-xs flex items-center gap-1">
              <span>⚠️</span> {warning}
            </div>
          ))}
        </div>
      )}

      {/* Total Usage Bar */}
      <div className="mb-4">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-white font-medium">Total Storage</span>
          <span className="text-gray-400">
            {formatSize(stats.summary.totalStorage)} / {quotaMB >= 1024 ? `${quotaMB/1024}GB` : `${quotaMB}MB`}
          </span>
        </div>
        <div className="h-3 bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all ${
              usagePercent > 80 ? 'bg-red-500' : usagePercent > 50 ? 'bg-yellow-500' : 'bg-green-500'
            }`}
            style={{ width: `${usagePercent}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-gray-500 mt-1">
          <span>{stats.summary.totalFiles} files</span>
          <span>{stats.summary.bucketCount} buckets</span>
        </div>
      </div>

      {/* By Type Breakdown */}
      <div className="mb-4">
        <div className="text-xs text-gray-400 mb-2">By File Type</div>
        <div className="space-y-1">
          {Object.entries(stats.byType)
            .sort((a, b) => b[1].size - a[1].size)
            .map(([type, data]) => {
              const percent = stats.summary.totalStorage > 0
                ? (data.size / stats.summary.totalStorage) * 100
                : 0;
              return (
                <div key={type} className="flex items-center gap-2">
                  <span className="w-5 text-center">{getTypeIcon(type)}</span>
                  <span className="w-16 text-gray-300 text-xs capitalize">{type}</span>
                  <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${getTypeColor(type)}`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  <span className="w-16 text-right text-gray-500 text-[10px]">
                    {formatSize(data.size)}
                  </span>
                  <span className="w-8 text-right text-gray-600 text-[10px]">
                    {data.count}
                  </span>
                </div>
              );
            })}
        </div>
      </div>

      {/* Largest Files */}
      <div className="mb-4">
        <div className="text-xs text-gray-400 mb-2">Largest Files</div>
        <div className="space-y-1">
          {stats.largestFiles.slice(0, 5).map((file, i) => (
            <div
              key={i}
              className="flex items-center gap-2 px-2 py-1 bg-gray-800 rounded text-xs"
            >
              <span className={`w-5 text-center ${file.size > 10 * 1024 * 1024 ? 'text-red-400' : 'text-gray-400'}`}>
                {file.size > 10 * 1024 * 1024 ? '🔴' : '📄'}
              </span>
              <span className="flex-1 truncate text-gray-300" title={file.path}>
                {file.name}
              </span>
              <span className="text-gray-500 text-[10px]">{file.bucket}</span>
              <span className={`font-mono ${file.size > 10 * 1024 * 1024 ? 'text-red-400' : 'text-gray-400'}`}>
                {formatSize(file.size)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Per-Bucket Breakdown */}
      <div>
        <div className="text-xs text-gray-400 mb-2">Buckets</div>
        <div className="space-y-1">
          {stats.buckets.map((bucket) => (
            <div key={bucket.name}>
              <button
                onClick={() => setExpandedBucket(expandedBucket === bucket.name ? null : bucket.name)}
                className="w-full flex items-center gap-2 px-2 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-xs"
              >
                <span>🪣</span>
                <span className="flex-1 text-left text-gray-300">{bucket.name}</span>
                <span className="text-gray-500">{bucket.fileCount} files</span>
                <span className="text-gray-400 font-mono">{formatSize(bucket.totalSize)}</span>
                <span className="text-gray-600">{expandedBucket === bucket.name ? '▼' : '▶'}</span>
              </button>

              {expandedBucket === bucket.name && (
                <div className="ml-4 mt-1 p-2 bg-gray-900 rounded text-[11px]">
                  {Object.entries(bucket.byType)
                    .sort((a, b) => b[1].size - a[1].size)
                    .map(([type, data]) => (
                      <div key={type} className="flex items-center gap-2 py-0.5">
                        <span>{getTypeIcon(type)}</span>
                        <span className="text-gray-400 capitalize">{type}</span>
                        <span className="flex-1" />
                        <span className="text-gray-500">{data.count}</span>
                        <span className="text-gray-400 w-16 text-right">{formatSize(data.size)}</span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
