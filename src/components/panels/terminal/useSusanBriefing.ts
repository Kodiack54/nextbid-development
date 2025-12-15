// Susan briefing hook - fetches and manages Susan's context

import { useState, useRef, useCallback } from 'react';
import { SUSAN_URL } from './constants';
import type { SusanContext } from './types';

export type MemoryStatus = 'idle' | 'loading' | 'loaded' | 'error';

/**
 * Build context prompt to send to Claude on startup
 * Susan builds the full greeting on server-side, we just use it
 */
export function buildContextPrompt(context: SusanContext): string {
  if (context.greeting) {
    return context.greeting;
  }
  return "Susan couldn't load your memory. Starting fresh - what would you like to work on?";
}

export function useSusanBriefing(projectPath: string) {
  const [memoryStatus, setMemoryStatus] = useState<MemoryStatus>('idle');
  const [susanContext, setSusanContext] = useState<SusanContext | null>(null);
  const susanContextRef = useRef<SusanContext | null>(null);

  const fetchSusanContext = useCallback(async (): Promise<SusanContext | null> => {
    setMemoryStatus('loading');
    try {
      const response = await fetch(
        `${SUSAN_URL}/api/context?project=${encodeURIComponent(projectPath)}`
      );
      if (response.ok) {
        const context = await response.json();
        setSusanContext(context);
        susanContextRef.current = context;
        setMemoryStatus('loaded');
        return context;
      }
    } catch (err) {
      console.log('[ClaudeTerminal] Susan not available:', err);
    }
    setMemoryStatus('error');
    return null;
  }, [projectPath]);

  const reset = useCallback(() => {
    setMemoryStatus('idle');
    setSusanContext(null);
    susanContextRef.current = null;
  }, []);

  return {
    memoryStatus,
    susanContext,
    susanContextRef,
    fetchSusanContext,
    reset,
  };
}
