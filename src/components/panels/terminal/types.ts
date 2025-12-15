// Types for the Claude Terminal component

export interface ChatLogMessage {
  id: string;
  source: 'claude' | 'chad';
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

// Simple message format for AI Team Chat
export interface ConversationMessage {
  id: string;
  user_id: string;
  user_name: string;
  content: string;
  created_at: string;
}

// Susan's startup context - full memory briefing
export interface SusanContext {
  greeting: string | null;
  lastSession: {
    id: string;
    projectPath: string;
    startedAt: string;
    endedAt: string;
    summary: string | null;
  } | null;
  recentMessages: Array<{ role: string; content: string; created_at: string }>;
  relevantKnowledge: Array<{ category: string; title: string; summary: string }>;
  todos: Array<{ id: string; title: string; description: string; priority: string; status: string }>;
  projectInfo: { name: string; path: string; databases: string[] } | null;
  ports: Array<{ port: number; service: string; description: string }>;
  schemas: Array<{ table_name: string; prefix: string; description: string }>;
  fileStructure: { directories: Array<{ path: string; description: string }>; keyFiles: Array<{ path: string; description: string }> } | null;
}

export interface ClaudeTerminalProps {
  projectPath?: string;
  wsUrl?: string;
  onMessage?: (message: ChatLogMessage) => void;
  sendRef?: React.MutableRefObject<((message: string) => void) | null>;
  connectRef?: React.MutableRefObject<(() => void) | null>;
  onConversationMessage?: (message: ConversationMessage) => void;
  onConnectionChange?: (connected: boolean) => void;
}
