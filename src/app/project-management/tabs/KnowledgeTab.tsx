'use client';

import { useState, useEffect } from 'react';
import { Brain, Search, Tag, Clock, ChevronDown, ChevronRight } from 'lucide-react';

interface KnowledgeItem {
  id: string;
  category: string;
  title: string;
  summary: string;
  tags?: string[];
  importance: number;
  created_at: string;
  session_id?: string;
}

interface KnowledgeTabProps {
  projectPath: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  'architecture': 'bg-purple-600/20 text-purple-400',
  'bug-fix': 'bg-red-600/20 text-red-400',
  'bug': 'bg-red-600/20 text-red-400',
  'feature': 'bg-green-600/20 text-green-400',
  'api': 'bg-blue-600/20 text-blue-400',
  'code': 'bg-yellow-600/20 text-yellow-400',
  'database': 'bg-orange-600/20 text-orange-400',
  'config': 'bg-gray-600/20 text-gray-400',
  'port': 'bg-cyan-600/20 text-cyan-400',
  'error': 'bg-red-600/20 text-red-400',
  'general': 'bg-gray-600/20 text-gray-400',
};

export default function KnowledgeTab({ projectPath }: KnowledgeTabProps) {
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchKnowledge();
  }, [projectPath, searchQuery]);

  const fetchKnowledge = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      // Try project-specific first, then fall back to all
      if (projectPath) params.set('project', projectPath);
      if (searchQuery) params.set('query', searchQuery);

      let response = await fetch(`/api/susan/query?${params}`);
      let data = await response.json();

      // If project filter returns empty, fetch all knowledge
      if (Array.isArray(data) && data.length === 0 && projectPath && !searchQuery) {
        response = await fetch('/api/susan/query');
        data = await response.json();
      }

      if (Array.isArray(data)) {
        setItems(data);
      } else if (data.success === false) {
        console.error('Knowledge fetch error:', data.error);
        setItems([]);
      }
    } catch (error) {
      console.error('Error fetching knowledge:', error);
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const categories = [...new Set(items.map(i => i.category))].sort();

  const filteredItems = selectedCategory
    ? items.filter(i => i.category === selectedCategory)
    : items;

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin text-2xl">🧠</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-purple-400" />
          <h3 className="text-white font-semibold">Knowledge Base</h3>
          <span className="text-gray-500 text-sm">({items.length} items)</span>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input
          type="text"
          placeholder="Search knowledge..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
        />
      </div>

      {/* Category Filter */}
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-3 py-1 rounded-full text-xs transition-colors ${
              selectedCategory === null
                ? 'bg-purple-600 text-white'
                : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
            }`}
          >
            All
          </button>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded-full text-xs transition-colors ${
                selectedCategory === cat
                  ? 'bg-purple-600 text-white'
                  : CATEGORY_COLORS[cat] || 'bg-gray-700 text-gray-400'
              }`}
            >
              {cat} ({items.filter(i => i.category === cat).length})
            </button>
          ))}
        </div>
      )}

      {/* Knowledge Items */}
      {filteredItems.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <Brain className="w-10 h-10 mx-auto mb-2 opacity-50" />
          <p>No knowledge found</p>
          {searchQuery && <p className="text-sm mt-1">Try a different search term</p>}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredItems.map(item => (
            <div
              key={item.id}
              className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden"
            >
              <div
                className="p-3 cursor-pointer hover:bg-gray-750 flex items-start gap-3"
                onClick={() => toggleExpand(item.id)}
              >
                <button className="text-gray-500 mt-0.5">
                  {expandedItems.has(item.id) ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-0.5 rounded text-xs ${CATEGORY_COLORS[item.category] || 'bg-gray-700 text-gray-400'}`}>
                      {item.category}
                    </span>
                    <span className="text-white font-medium truncate">{item.title}</span>
                  </div>

                  {!expandedItems.has(item.id) && (
                    <p className="text-gray-400 text-sm truncate">{item.summary}</p>
                  )}
                </div>

                <div className="flex items-center gap-2 text-gray-500 text-xs whitespace-nowrap">
                  <Clock className="w-3 h-3" />
                  {formatDate(item.created_at)}
                </div>
              </div>

              {expandedItems.has(item.id) && (
                <div className="px-10 pb-3 border-t border-gray-700 pt-3">
                  <p className="text-gray-300 text-sm whitespace-pre-wrap">{item.summary}</p>

                  {item.tags && item.tags.length > 0 && (
                    <div className="flex items-center gap-2 mt-3">
                      <Tag className="w-3 h-3 text-gray-500" />
                      <div className="flex flex-wrap gap-1">
                        {item.tags.map(tag => (
                          <span key={tag} className="px-2 py-0.5 bg-gray-700 text-gray-400 rounded text-xs">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
