'use client';

import { useState, useEffect } from 'react';
import { PipelineStatus } from './components/PipelineStatus';
import { BucketCounters } from './components/BucketCounters';
import { SessionsList } from './components/SessionsList';
import { usePipelineStatus } from './hooks/usePipelineStatus';

interface SessionHubPageProps {
  projectId?: string | null;
  userId?: string | null;
}

export default function SessionHubPage({ projectId, userId }: SessionHubPageProps) {
  const [activeTab, setActiveTab] = useState<'pipeline' | 'sessions' | 'buckets'>('pipeline');
  const {
    chadStatus,
    jenStatus,
    susanStatus,
    buckets,
    sessions,
    loading,
    triggerWorker,
    refreshAll,
  } = usePipelineStatus();

  const tabs = [
    { id: 'pipeline', label: 'Pipeline', icon: '⚡' },
    { id: 'sessions', label: 'Sessions', count: sessions.length },
    { id: 'buckets', label: 'Buckets', count: buckets.total },
  ] as const;

  return (
    <div className="h-full flex flex-col bg-gray-900 text-white">
      {/* Header */}
      <div className="px-4 py-3 bg-gray-800 border-b border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold">Session Hub</h1>
          <span className="text-xs text-gray-500">Chad → Jen → Susan Pipeline</span>
        </div>
        <button
          onClick={refreshAll}
          disabled={loading}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 text-white text-sm rounded transition-colors"
        >
          {loading ? 'Refreshing...' : 'Refresh All'}
        </button>
      </div>

      {/* Pipeline Overview - Always visible */}
      <PipelineStatus
        chad={chadStatus}
        jen={jenStatus}
        susan={susanStatus}
        onTriggerWorker={triggerWorker}
      />

      {/* Tabs */}
      <div className="flex border-b border-gray-700 px-4">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'text-white border-b-2 border-blue-500'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {'icon' in tab && <span className="mr-1">{tab.icon}</span>}
            {tab.label}
            {'count' in tab && tab.count > 0 && (
              <span className="ml-2 px-1.5 py-0.5 bg-gray-700 rounded text-xs">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'pipeline' && (
          <div className="p-4">
            <h2 className="text-sm font-medium text-gray-400 mb-3">Pipeline Details</h2>
            <div className="space-y-4">
              {/* Chad Details */}
              <WorkerDetail
                name="Chad"
                port={5401}
                role="Capture & Dump"
                status={chadStatus}
                color="blue"
              />
              {/* Jen Details */}
              <WorkerDetail
                name="Jen"
                port={5407}
                role="Scrub & Flag"
                status={jenStatus}
                color="purple"
              />
              {/* Susan Details */}
              <WorkerDetail
                name="Susan"
                port={5403}
                role="Categorize & Store"
                status={susanStatus}
                color="green"
              />
            </div>
          </div>
        )}

        {activeTab === 'sessions' && (
          <SessionsList sessions={sessions} loading={loading} />
        )}

        {activeTab === 'buckets' && (
          <BucketCounters buckets={buckets} />
        )}
      </div>
    </div>
  );
}

interface WorkerDetailProps {
  name: string;
  port: number;
  role: string;
  status: {
    isRunning: boolean;
    queue: number;
    processed: number;
    lastActivity: string | null;
    error: string | null;
  };
  color: 'blue' | 'purple' | 'green';
}

function WorkerDetail({ name, port, role, status, color }: WorkerDetailProps) {
  const colorClasses = {
    blue: 'border-blue-500 bg-blue-900/20',
    purple: 'border-purple-500 bg-purple-900/20',
    green: 'border-green-500 bg-green-900/20',
  };

  const dotColors = {
    blue: 'bg-blue-400',
    purple: 'bg-purple-400',
    green: 'bg-green-400',
  };

  return (
    <div className={`p-4 rounded-lg border ${colorClasses[color]}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${status.isRunning ? dotColors[color] : 'bg-gray-500'} ${status.isRunning ? 'animate-pulse' : ''}`} />
          <span className="font-medium">{name}</span>
          <span className="text-xs text-gray-500">:{port}</span>
        </div>
        <span className="text-xs text-gray-400">{role}</span>
      </div>

      <div className="grid grid-cols-3 gap-4 text-center">
        <div>
          <div className="text-2xl font-bold">{status.queue}</div>
          <div className="text-xs text-gray-500">In Queue</div>
        </div>
        <div>
          <div className="text-2xl font-bold">{status.processed}</div>
          <div className="text-xs text-gray-500">Processed</div>
        </div>
        <div>
          <div className="text-xs text-gray-400">
            {status.lastActivity ? formatTimeAgo(status.lastActivity) : 'No activity'}
          </div>
          <div className="text-xs text-gray-500">Last Active</div>
        </div>
      </div>

      {status.error && (
        <div className="mt-3 p-2 bg-red-900/30 border border-red-700 rounded text-xs text-red-400">
          {status.error}
        </div>
      )}
    </div>
  );
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);

  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}
