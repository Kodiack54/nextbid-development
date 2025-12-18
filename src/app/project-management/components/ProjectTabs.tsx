'use client';

import { CheckSquare, FileText, Table, Database, GitCommit, StickyNote, Bug, Brain, FolderTree, BookOpen } from 'lucide-react';
import { TabType, TABS } from '../types';

interface ProjectTabsProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

const ICONS: Record<string, React.ReactNode> = {
  CheckSquare: <CheckSquare className="w-4 h-4" />,
  Brain: <Brain className="w-4 h-4" />,
  FileText: <FileText className="w-4 h-4" />,
  Table: <Table className="w-4 h-4" />,
  Database: <Database className="w-4 h-4" />,
  FolderTree: <FolderTree className="w-4 h-4" />,
  GitCommit: <GitCommit className="w-4 h-4" />,
  StickyNote: <StickyNote className="w-4 h-4" />,
  Bug: <Bug className="w-4 h-4" />,
  BookOpen: <BookOpen className="w-4 h-4" />,
};

export default function ProjectTabs({ activeTab, onTabChange }: ProjectTabsProps) {
  return (
    <div className="bg-gray-800 border-b border-gray-700">
      <div className="flex items-center gap-1 px-6">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'text-blue-400 border-blue-500'
                : 'text-gray-400 border-transparent hover:text-white hover:border-gray-600'
            }`}
          >
            {ICONS[tab.icon]}
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}
