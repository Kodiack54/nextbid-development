'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface DocWorkerResult {
  success: boolean;
  processed: number;
  results?: Array<{
    session_id: string;
    project: string;
    extracted: {
      decisions: number;
      todos: number;
      topics: number;
    };
  }>;
  timestamp?: string;
  error?: string;
}

interface UseDocWorkerOptions {
  intervalMs?: number;
  enabled?: boolean;
}

export function useDocWorker(options: UseDocWorkerOptions = {}) {
  const { intervalMs = 5 * 60 * 1000, enabled = true } = options; // Default 5 minutes

  const [status, setStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const [lastRun, setLastRun] = useState<Date | null>(null);
  const [lastResult, setLastResult] = useState<DocWorkerResult | null>(null);
  const [totalProcessed, setTotalProcessed] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const runWorker = useCallback(async (force = false) => {
    if (status === 'running') return;

    setStatus('running');
    console.log('[DocWorker Hook] Starting documentation worker...');

    try {
      const response = await fetch('/api/doc-worker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force_all: force }),
      });

      const result: DocWorkerResult = await response.json();

      if (result.success) {
        setStatus('success');
        setLastResult(result);
        setTotalProcessed(prev => prev + (result.processed || 0));
        console.log('[DocWorker Hook] Completed. Processed:', result.processed);
      } else {
        setStatus('error');
        setLastResult(result);
        console.error('[DocWorker Hook] Error:', result.error);
      }

      setLastRun(new Date());

      // Reset to idle after a moment
      setTimeout(() => setStatus('idle'), 3000);

    } catch (error: any) {
      console.error('[DocWorker Hook] Failed:', error);
      setStatus('error');
      setLastResult({ success: false, processed: 0, error: error.message });
      setTimeout(() => setStatus('idle'), 3000);
    }
  }, [status]);

  // Set up interval
  useEffect(() => {
    if (!enabled) return;

    // Run immediately on mount (after a short delay)
    const initialTimeout = setTimeout(() => {
      runWorker();
    }, 10000); // 10 second delay on initial load

    // Then run every intervalMs
    intervalRef.current = setInterval(() => {
      runWorker();
    }, intervalMs);

    return () => {
      clearTimeout(initialTimeout);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [enabled, intervalMs, runWorker]);

  return {
    status,
    lastRun,
    lastResult,
    totalProcessed,
    triggerNow: () => runWorker(false),
    triggerForceAll: () => runWorker(true),
    nextRunIn: lastRun
      ? Math.max(0, intervalMs - (Date.now() - lastRun.getTime()))
      : intervalMs,
  };
}
