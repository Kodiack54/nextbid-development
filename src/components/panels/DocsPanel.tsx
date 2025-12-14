'use client';

import { useState, useEffect } from 'react';
import { FileText, FolderOpen, ChevronRight, ChevronDown, RefreshCw, Clock, BookOpen } from 'lucide-react';

interface DocFile {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: DocFile[];
  modified?: string;
  size?: number;
}

interface DocMetadata {
  title: string;
  created_at: string;
  updated_at: string;
  author: string;
  version: string;
  category: string;
}

interface DocsPanelProps {
  projectPath?: string;
}

export function DocsPanel({ projectPath }: DocsPanelProps) {
  const [docs, setDocs] = useState<DocFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDoc, setSelectedDoc] = useState<string | null>(null);
  const [docContent, setDocContent] = useState<string>('');
  const [docMetadata, setDocMetadata] = useState<DocMetadata | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['docs']));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDocs();
  }, [projectPath]);

  async function loadDocs() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/docs');
      const data = await res.json();
      if (data.success) {
        setDocs(data.docs || []);
      } else {
        setError(data.error || 'Failed to load docs');
      }
    } catch (err) {
      console.error('Failed to load docs:', err);
      setError('Failed to connect to docs API');
    } finally {
      setLoading(false);
    }
  }

  async function loadDocContent(path: string) {
    try {
      const res = await fetch(`/api/docs?path=${encodeURIComponent(path)}`);
      const data = await res.json();
      if (data.success) {
        setDocContent(data.content || '');
        setDocMetadata(data.metadata || null);
        setSelectedDoc(path);
      }
    } catch (err) {
      console.error('Failed to load doc:', err);
    }
  }

  function toggleFolder(path: string) {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }

  function renderTree(items: DocFile[], depth = 0) {
    return items.map(item => (
      <div key={item.path}>
        <div
          className={`flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-gray-700 rounded ${
            selectedDoc === item.path ? 'bg-gray-700 text-blue-400' : 'text-gray-300'
          }`}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={() => item.type === 'folder' ? toggleFolder(item.path) : loadDocContent(item.path)}
        >
          {item.type === 'folder' ? (
            <>
              {expandedFolders.has(item.path) ? (
                <ChevronDown className="w-4 h-4 text-gray-500" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-500" />
              )}
              <FolderOpen className="w-4 h-4 text-yellow-500" />
            </>
          ) : (
            <>
              <span className="w-4" />
              <FileText className="w-4 h-4 text-blue-400" />
            </>
          )}
          <span className="text-sm truncate">{item.name}</span>
        </div>
        {item.type === 'folder' && item.children && expandedFolders.has(item.path) && (
          <div>{renderTree(item.children, depth + 1)}</div>
        )}
      </div>
    ));
  }

  // Simple markdown renderer
  function renderMarkdown(content: string) {
    const lines = content.split('\n');
    const elements: JSX.Element[] = [];
    let inCodeBlock = false;
    let codeContent = '';
    let codeLanguage = '';

    lines.forEach((line, i) => {
      // Code blocks
      if (line.startsWith('```')) {
        if (inCodeBlock) {
          elements.push(
            <pre key={i} className="bg-gray-800 rounded p-3 overflow-x-auto my-2 text-sm">
              <code className={`language-${codeLanguage}`}>{codeContent}</code>
            </pre>
          );
          codeContent = '';
          inCodeBlock = false;
        } else {
          inCodeBlock = true;
          codeLanguage = line.slice(3);
        }
        return;
      }

      if (inCodeBlock) {
        codeContent += line + '\n';
        return;
      }

      // Headers
      if (line.startsWith('# ')) {
        elements.push(<h1 key={i} className="text-2xl font-bold text-white mt-4 mb-2">{line.slice(2)}</h1>);
      } else if (line.startsWith('## ')) {
        elements.push(<h2 key={i} className="text-xl font-semibold text-white mt-3 mb-2">{line.slice(3)}</h2>);
      } else if (line.startsWith('### ')) {
        elements.push(<h3 key={i} className="text-lg font-medium text-white mt-2 mb-1">{line.slice(4)}</h3>);
      }
      // Lists
      else if (line.startsWith('- ') || line.startsWith('* ')) {
        elements.push(<li key={i} className="text-gray-300 ml-4">{line.slice(2)}</li>);
      }
      // Numbered lists
      else if (/^\d+\. /.test(line)) {
        elements.push(<li key={i} className="text-gray-300 ml-4 list-decimal">{line.replace(/^\d+\. /, '')}</li>);
      }
      // Blockquotes
      else if (line.startsWith('> ')) {
        elements.push(
          <blockquote key={i} className="border-l-4 border-blue-500 pl-3 my-2 text-gray-400 italic">
            {line.slice(2)}
          </blockquote>
        );
      }
      // Horizontal rule
      else if (line === '---' || line === '***') {
        elements.push(<hr key={i} className="border-gray-700 my-4" />);
      }
      // Empty line
      else if (line.trim() === '') {
        elements.push(<div key={i} className="h-2" />);
      }
      // Regular paragraph
      else {
        // Handle inline formatting
        let formatted = line
          .replace(/\*\*(.+?)\*\*/g, '<strong class="text-white">$1</strong>')
          .replace(/\*(.+?)\*/g, '<em>$1</em>')
          .replace(/`(.+?)`/g, '<code class="bg-gray-800 px-1 rounded text-blue-300">$1</code>');
        elements.push(
          <p key={i} className="text-gray-300 my-1" dangerouslySetInnerHTML={{ __html: formatted }} />
        );
      }
    });

    return elements;
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" />
        Loading docs...
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-purple-400" />
          <h2 className="text-white font-semibold">Documentation</h2>
        </div>
        <button
          onClick={loadDocs}
          className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {error ? (
        <div className="p-4 text-center text-gray-500">
          <p>{error}</p>
          <button onClick={loadDocs} className="mt-2 text-blue-400 hover:underline">
            Try again
          </button>
        </div>
      ) : docs.length === 0 ? (
        <div className="p-4 text-center text-gray-500">
          <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No documents yet</p>
          <p className="text-sm mt-2">Ask Chad to create documentation</p>
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden">
          {/* File tree */}
          <div className="w-48 border-r border-gray-700 overflow-y-auto">
            {renderTree(docs)}
          </div>

          {/* Document viewer */}
          <div className="flex-1 overflow-y-auto p-4">
            {selectedDoc ? (
              <div>
                {docMetadata && (
                  <div className="mb-4 pb-3 border-b border-gray-700">
                    <h1 className="text-xl font-bold text-white">{docMetadata.title}</h1>
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Updated: {new Date(docMetadata.updated_at).toLocaleDateString()}
                      </span>
                      <span>v{docMetadata.version}</span>
                      <span className="px-2 py-0.5 bg-purple-600/20 text-purple-400 rounded">
                        {docMetadata.category}
                      </span>
                    </div>
                  </div>
                )}
                <div className="prose prose-invert max-w-none">
                  {renderMarkdown(docContent)}
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-500">
                <p>Select a document to view</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default DocsPanel;
