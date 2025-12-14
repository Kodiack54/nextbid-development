'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface WorkerStatus {
  isRunning: boolean;
  lastRun: Date | null;
  lastResult: {
    success: boolean;
    results?: Array<{
      project_id: string;
      messages_processed: number;
      docs_updated: string[];
    }>;
    error?: string;
    duration_ms?: number;
  } | null;
  runCount: number;
  errors: string[];
}

interface UseCatalogerWorkerOptions {
  intervalMs?: number;      // How often to run (default: 45 seconds)
  enabled?: boolean;        // Whether to auto-run
  onUpdate?: (result: WorkerStatus['lastResult']) => void;
}

/**
 * Hook to run the cataloger worker on an interval
 * This keeps project docs up to date in real-time
 */
export function useCatalogerWorker(options: UseCatalogerWorkerOptions = {}) {
  const {
    intervalMs = 45000, // 45 seconds default
    enabled = true,
    onUpdate
  } = options;

  const [status, setStatus] = useState<WorkerStatus>({
    isRunning: false,
    lastRun: null,
    lastResult: null,
    runCount: 0,
    errors: []
  });

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isRunningRef = useRef(false);

  const runWorker = useCallback(async () => {
    // Prevent concurrent runs
    if (isRunningRef.current) {
      console.log('[Cataloger] Skipping - already running');
      return;
    }

    isRunningRef.current = true;
    setStatus(prev => ({ ...prev, isRunning: true }));

    try {
      console.log('[Cataloger] Running worker...');

      const response = await fetch('/api/worker-cataloger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const result = await response.json();

      setStatus(prev => ({
        ...prev,
        isRunning: false,
        lastRun: new Date(),
        lastResult: result,
        runCount: prev.runCount + 1,
        errors: result.error
          ? [...prev.errors.slice(-9), result.error] // Keep last 10 errors
          : prev.errors
      }));

      if (result.results?.length > 0) {
        console.log('[Cataloger] Updated:', result.results);
      }

      onUpdate?.(result);

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error('[Cataloger] Error:', errorMsg);

      setStatus(prev => ({
        ...prev,
        isRunning: false,
        lastRun: new Date(),
        lastResult: { success: false, error: errorMsg },
        errors: [...prev.errors.slice(-9), errorMsg]
      }));
    } finally {
      isRunningRef.current = false;
    }
  }, [onUpdate]);

  // Start/stop interval based on enabled flag
  useEffect(() => {
    if (enabled) {
      // Run immediately on mount
      runWorker();

      // Then run on interval
      intervalRef.current = setInterval(runWorker, intervalMs);
      console.log(`[Cataloger] Started with ${intervalMs}ms interval`);

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          console.log('[Cataloger] Stopped');
        }
      };
    }
  }, [enabled, intervalMs, runWorker]);

  // Manual trigger
  const triggerNow = useCallback(() => {
    runWorker();
  }, [runWorker]);

  // Pause/resume
  const pause = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const resume = useCallback(() => {
    if (!intervalRef.current && enabled) {
      intervalRef.current = setInterval(runWorker, intervalMs);
    }
  }, [enabled, intervalMs, runWorker]);

  return {
    status,
    triggerNow,
    pause,
    resume
  };
}
