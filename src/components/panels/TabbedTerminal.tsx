'use client';

import { useState } from 'react';
import { User, Bot } from 'lucide-react';
import { ClaudeTerminal } from './ClaudeTerminal';
import { ServerClaudeViewer } from './ServerClaudeViewer';
import type { ConversationMessage } from './ClaudeTerminal';

interface TabbedTerminalProps {
  sendRef?: React.MutableRefObject<((message: string) => void) | null>;
  connectRef?: React.MutableRefObject<(() => void) | null>;
  onConversationMessage?: (msg: ConversationMessage) => void;
  onConnectionChange?: (connected: boolean) => void;
}

type TabType = 'user' | 'server';

export function TabbedTerminal({
  sendRef,
  connectRef,
  onConversationMessage,
  onConnectionChange,
}: TabbedTerminalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('user');

  return (
    <div className="flex flex-col h-full">
      {/* Tab Bar */}
      <div className="flex bg-gray-800 border-b border-gray-700" style={{minHeight: '40px'}}>
        <button
          onClick={() => setActiveTab('user')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'user'
              ? 'bg-green-900/30 text-green-400 border-b-2 border-green-500'
              : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'
          }`}
        >
          <User className="w-4 h-4" />
          <span>Your Terminal</span>
        </button>

        <button
          onClick={() => setActiveTab('server')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'server'
              ? 'bg-blue-900/30 text-blue-400 border-b-2 border-blue-500'
              : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'
          }`}
        >
          <Bot className="w-4 h-4" />
          <span>Server Claude</span>
        </button>
      </div>

      {/* Tab Content - both always mounted for persistence */}
      <div className="flex-1 min-h-0 relative">
        <div className={`absolute inset-0 ${activeTab === 'user' ? 'block' : 'hidden'}`}>
          <ClaudeTerminal
            sendRef={sendRef}
            connectRef={connectRef}
            onConversationMessage={onConversationMessage}
            onConnectionChange={onConnectionChange}
          />
        </div>
        <div className={`absolute inset-0 ${activeTab === 'server' ? 'block' : 'hidden'}`}>
          <ServerClaudeViewer />
        </div>
      </div>
    </div>
  );
}

export default TabbedTerminal;
