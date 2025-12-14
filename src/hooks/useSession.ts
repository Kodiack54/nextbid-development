'use client';

import { useState, useEffect, useCallback } from 'react';

interface Message {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  input_tokens?: number;
  output_tokens?: number;
  cost_usd?: number;
  model?: string;
  created_at?: string;
}

interface Session {
  id: string;
  user_id: string;
  project_id?: string;
  title: string;
  status: 'active' | 'ended' | 'archived';
  started_at: string;
  ended_at?: string;
  message_count: number;
  total_tokens: number;
  total_cost_usd: number;
  summary?: string;
}

interface SessionSummary {
  summary: string;
  key_points: string[];
  action_items: string[];
  decisions: string[];
  files: string[];
  context_for_next_session: string;
}

interface UseSessionReturn {
  session: Session | null;
  messages: Message[];
  isLoading: boolean;
  error: string | null;
  startSession: (userId: string, projectId?: string) => Promise<void>;
  addMessage: (message: Message) => Promise<void>;
  endSession: () => Promise<void>;
  summarizeSession: () => Promise<SessionSummary | null>;
  loadSession: (sessionId: string) => Promise<void>;
}

export function useSession(): UseSessionReturn {
  const [session, setSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Start a new session
  const startSession = useCallback(async (userId: string, projectId?: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          project_id: projectId,
          title: `Session ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setSession(data.session);
        setMessages([]);
      } else {
        setError(data.error || 'Failed to start session');
      }
    } catch (err) {
      setError('Failed to start session');
      console.error('Start session error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load an existing session
  const loadSession = useCallback(async (sessionId: string) => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch session
      const sessionRes = await fetch(`/api/sessions?session_id=${sessionId}`);
      const sessionData = await sessionRes.json();

      // Fetch messages
      const messagesRes = await fetch(`/api/sessions/messages?session_id=${sessionId}`);
      const messagesData = await messagesRes.json();

      if (sessionData.success && messagesData.success) {
        setSession(sessionData.sessions[0] || null);
        setMessages(messagesData.messages || []);
      }
    } catch (err) {
      setError('Failed to load session');
      console.error('Load session error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Add a message to the current session
  const addMessage = useCallback(async (message: Message) => {
    // Add to local state immediately
    setMessages(prev => [...prev, message]);

    // If we have an active session, persist to database
    if (session?.id) {
      try {
        await fetch('/api/sessions/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: session.id,
            role: message.role,
            content: message.content,
            input_tokens: message.input_tokens || 0,
            output_tokens: message.output_tokens || 0,
            cost_usd: message.cost_usd || 0,
            model: message.model,
          }),
        });
      } catch (err) {
        console.error('Failed to save message:', err);
        // Don't set error - message is still in local state
      }
    }
  }, [session?.id]);

  // End the current session
  const endSession = useCallback(async () => {
    if (!session?.id) return;

    try {
      await fetch('/api/sessions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: session.id,
          status: 'ended',
        }),
      });

      setSession(prev => prev ? { ...prev, status: 'ended' } : null);
    } catch (err) {
      console.error('Failed to end session:', err);
    }
  }, [session?.id]);

  // Summarize the current session using OpenAI
  const summarizeSession = useCallback(async (): Promise<SessionSummary | null> => {
    if (!session?.id && messages.length === 0) {
      setError('No session to summarize');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: session?.id,
          messages: session?.id ? undefined : messages, // Use messages if no session
        }),
      });

      const data = await response.json();
      if (data.success) {
        // Update local session with summary
        if (session) {
          setSession(prev => prev ? { ...prev, summary: data.summary } : null);
        }

        return {
          summary: data.summary,
          key_points: data.key_points || [],
          action_items: data.action_items || [],
          decisions: data.decisions || [],
          files: data.files || [],
          context_for_next_session: data.context_for_next_session || '',
        };
      } else {
        setError(data.error || 'Failed to summarize');
        return null;
      }
    } catch (err) {
      setError('Failed to summarize session');
      console.error('Summarize error:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [session, messages]);

  return {
    session,
    messages,
    isLoading,
    error,
    startSession,
    addMessage,
    endSession,
    summarizeSession,
    loadSession,
  };
}
