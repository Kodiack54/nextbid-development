'use client';

import { useState, useEffect, useCallback } from 'react';
import type { WorkerStatus, Session, BucketData } from '../types';

// Service URLs
const CHAD_URL = process.env.NEXT_PUBLIC_CHAD_URL || 'http://161.35.229.220:5401';
const JEN_URL = process.env.NEXT_PUBLIC_JEN_URL || 'http://161.35.229.220:5407';
const SUSAN_URL = process.env.NEXT_PUBLIC_SUSAN_URL || 'http://161.35.229.220:5403';

const defaultWorkerStatus: WorkerStatus = {
  isRunning: false,
  queue: 0,
  processed: 0,
  lastActivity: null,
  error: null,
};

const defaultBuckets: BucketData = {
  bugs: 0,
  features: 0,
  todos: 0,
  errors: 0,
  knowledge: 0,
  decisions: 0,
  total: 0,
};

export function usePipelineStatus() {
  const [chadStatus, setChadStatus] = useState<WorkerStatus>(defaultWorkerStatus);
  const [jenStatus, setJenStatus] = useState<WorkerStatus>(defaultWorkerStatus);
  const [susanStatus, setSusanStatus] = useState<WorkerStatus>(defaultWorkerStatus);
  const [buckets, setBuckets] = useState<BucketData>(defaultBuckets);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch Chad status
  const fetchChadStatus = useCallback(async () => {
    try {
      const res = await fetch(`${CHAD_URL}/api/status`);
      const data = await res.json();

      if (data.success) {
        setChadStatus({
          isRunning: data.isRunning || false,
          queue: data.pendingCount || 0,
          processed: data.processedCount || 0,
          lastActivity: data.lastActivity || null,
          error: data.error || null,
        });
      }
    } catch (error) {
      setChadStatus(prev => ({ ...prev, error: 'Unable to connect to Chad' }));
    }
  }, []);

  // Fetch Jen status
  const fetchJenStatus = useCallback(async () => {
    try {
      const res = await fetch(`${JEN_URL}/api/status`);
      const data = await res.json();

      if (data.success) {
        setJenStatus({
          isRunning: data.isRunning || false,
          queue: data.pendingCount || 0,
          processed: data.processedCount || 0,
          lastActivity: data.lastActivity || null,
          error: data.error || null,
        });
      }
    } catch (error) {
      setJenStatus(prev => ({ ...prev, error: 'Unable to connect to Jen' }));
    }
  }, []);

  // Fetch Susan status
  const fetchSusanStatus = useCallback(async () => {
    try {
      const res = await fetch(`${SUSAN_URL}/api/status`);
      const data = await res.json();

      if (data.success) {
        setSusanStatus({
          isRunning: data.isRunning || false,
          queue: data.pendingCount || 0,
          processed: data.processedCount || 0,
          lastActivity: data.lastActivity || null,
          error: data.error || null,
        });
      }
    } catch (error) {
      setSusanStatus(prev => ({ ...prev, error: 'Unable to connect to Susan' }));
    }
  }, []);

  // Fetch sessions from Chad
  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch(`${CHAD_URL}/api/sessions/recent`);
      const data = await res.json();

      if (data.success) {
        setSessions(data.sessions || []);
      }
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
    }
  }, []);

  // Fetch bucket counts from Susan
  const fetchBuckets = useCallback(async () => {
    try {
      const res = await fetch(`${SUSAN_URL}/api/buckets/counts`);
      const data = await res.json();

      if (data.success) {
        const b = data.buckets || {};
        setBuckets({
          bugs: b.bugs || 0,
          features: b.features || 0,
          todos: b.todos || 0,
          errors: b.errors || 0,
          knowledge: b.knowledge || 0,
          decisions: b.decisions || 0,
          total: (b.bugs || 0) + (b.features || 0) + (b.todos || 0) +
                 (b.errors || 0) + (b.knowledge || 0) + (b.decisions || 0),
        });
      }
    } catch (error) {
      console.error('Failed to fetch buckets:', error);
    }
  }, []);

  // Refresh all data
  const refreshAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([
      fetchChadStatus(),
      fetchJenStatus(),
      fetchSusanStatus(),
      fetchSessions(),
      fetchBuckets(),
    ]);
    setLoading(false);
  }, [fetchChadStatus, fetchJenStatus, fetchSusanStatus, fetchSessions, fetchBuckets]);

  // Trigger a specific worker
  const triggerWorker = useCallback(async (worker: 'chad' | 'jen' | 'susan') => {
    const urls: Record<string, string> = {
      chad: CHAD_URL,
      jen: JEN_URL,
      susan: SUSAN_URL,
    };

    try {
      const res = await fetch(`${urls[worker]}/api/trigger`, {
        method: 'POST',
      });
      const data = await res.json();

      if (!data.success) {
        console.error(`Failed to trigger ${worker}:`, data.error);
      }

      // Refresh status after triggering
      setTimeout(refreshAll, 1000);
    } catch (error) {
      console.error(`Failed to trigger ${worker}:`, error);
    }
  }, [refreshAll]);

  // Initial fetch
  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  // Poll every 10 seconds
  useEffect(() => {
    const interval = setInterval(refreshAll, 10000);
    return () => clearInterval(interval);
  }, [refreshAll]);

  return {
    chadStatus,
    jenStatus,
    susanStatus,
    buckets,
    sessions,
    loading,
    triggerWorker,
    refreshAll,
  };
}
