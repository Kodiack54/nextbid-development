'use client';

import { FileText, Save } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface Session {
  id: string;
  status: string;
}

interface ChatLogPanelProps {
  messages: Message[];
  streamingContent: string;
  isSending: boolean;
  session: Session | null;
  onSummarize: () => void;
  onEndSession: () => void;
  isSummarizing: boolean;
}

export function ChatLogPanel({
  messages,
  streamingContent,
  isSending,
  session,
  onSummarize,
  onEndSession,
  isSummarizing,
}: ChatLogPanelProps) {
  return (
    <div className="flex flex-col h-full -m-3">
      {/* Header with actions */}
      <div className="px-3 py-2 border-b border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">{messages.length} messages</span>
          {session && (
            <span className="text-xs text-green-400 bg-green-900/30 px-1.5 py-0.5 rounded">
              Active
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onSummarize}
            disabled={isSummarizing || messages.length < 2}
            className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white disabled:opacity-50"
            title="Summarize Session"
          >
            {isSummarizing ? (
              <span className="animate-spin text-xs">⏳</span>
            ) : (
              <FileText size={14} />
            )}
          </button>
          <button
            onClick={onEndSession}
            disabled={!session || messages.length < 2}
            className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-orange-400 disabled:opacity-50"
            title="End Session & Summarize"
          >
            <Save size={14} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-auto p-3 space-y-2">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`text-xs p-2 rounded ${
              msg.role === 'user'
                ? 'bg-blue-900/30 border-l-2 border-blue-500'
                : 'bg-gray-800/50 border-l-2 border-gray-600'
            }`}
          >
            <div className={`font-medium mb-1 ${msg.role === 'user' ? 'text-blue-400' : 'text-gray-400'}`}>
              {msg.role === 'user' ? 'You' : 'Claude'}
            </div>
            <div className="text-gray-300 whitespace-pre-wrap break-words">
              {msg.content.length > 300 ? msg.content.substring(0, 300) + '...' : msg.content}
            </div>
          </div>
        ))}

        {isSending && streamingContent && (
          <div className="text-xs p-2 rounded bg-gray-800/50 border-l-2 border-gray-600">
            <div className="font-medium mb-1 text-gray-400">Claude</div>
            <div className="text-gray-300">
              {streamingContent.length > 300 ? streamingContent.substring(0, 300) + '...' : streamingContent}
              <span className="inline-block w-1 h-3 bg-blue-500 animate-pulse ml-1" />
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-2 border-t border-gray-700 text-xs text-gray-500 text-center">
        Session log for continuity
      </div>
    </div>
  );
}
