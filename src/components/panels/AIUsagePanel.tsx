'use client';

import { useState, useEffect } from 'react';

interface AssistantUsage {
  key: string;
  name: string;
  role: string;
  requests: number;
  tokens: number;
  cost: number;
}

interface UsageData {
  totals: { requests: number; total_tokens: number; cost_usd: number };
  budget: { monthly_limit: number; used: number; percent_used: number };
  by_user: Array<{ user_id: string; name: string; requests: number; cost: number }>;
  by_assistant: AssistantUsage[];
}

// AI Team member emojis
const teamEmojis: Record<string, string> = {
  'claude': '👨‍💻',
  'chad': '🧑‍💻',
  'ryan': '🏃',
  'susan': '👩‍💼',
};

export function AIUsagePanel() {
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchUsage();
  }, []);

  const fetchUsage = async () => {
    try {
      const response = await fetch('/api/ai-usage?period=month');
      const data = await response.json();
      if (data.success) {
        setUsage(data);
      }
    } catch (error) {
      console.error('Error fetching usage:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <div className="text-gray-500 text-sm">Loading usage...</div>;
  }

  if (!usage) {
    return <div className="text-gray-500 text-sm">Failed to load usage</div>;
  }

  const budgetPercent = Math.min(usage.budget.percent_used, 100);
  const budgetColor = budgetPercent > 80 ? 'bg-red-500' : budgetPercent > 60 ? 'bg-yellow-500' : 'bg-green-500';

  return (
    <div className="text-sm">
      <div className="text-gray-400 mb-3">This Month</div>

      {/* Budget Overview */}
      <div className="bg-gray-800 rounded-lg p-3 mb-3">
        <div className="text-2xl font-bold text-white">${usage.budget.used.toFixed(2)}</div>
        <div className="text-gray-500 text-xs">of ${usage.budget.monthly_limit} budget</div>
        <div className="mt-2 h-2 bg-gray-700 rounded-full overflow-hidden">
          <div className={`h-full ${budgetColor}`} style={{ width: `${budgetPercent}%` }} />
        </div>
        <div className="text-xs text-gray-500 mt-1">{usage.budget.percent_used.toFixed(1)}% used</div>
      </div>

      {/* Summary Stats */}
      <div className="space-y-2 text-xs mb-4">
        <div className="flex justify-between">
          <span className="text-gray-400">Total Requests</span>
          <span className="text-white">{usage.totals.requests.toLocaleString()}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Total Tokens</span>
          <span className="text-white">{usage.totals.total_tokens.toLocaleString()}</span>
        </div>
      </div>

      {/* AI Team Usage */}
      {usage.by_assistant && usage.by_assistant.length > 0 && (
        <div className="mb-4">
          <div className="text-gray-400 mb-2 font-medium">AI Team Usage</div>
          <div className="space-y-2">
            {usage.by_assistant.map((assistant) => (
              <div key={assistant.key} className="bg-gray-800/50 rounded p-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span>{teamEmojis[assistant.key] || '🤖'}</span>
                    <div>
                      <div className="text-white font-medium">{assistant.name}</div>
                      <div className="text-gray-500 text-xs">{assistant.role}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-green-400 font-medium">${assistant.cost.toFixed(2)}</div>
                    <div className="text-gray-500 text-xs">{assistant.tokens.toLocaleString()} tokens</div>
                  </div>
                </div>
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>{assistant.requests} requests</span>
                  <span>~${(assistant.cost / Math.max(assistant.requests, 1)).toFixed(3)}/req</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* By User (if multiple users) */}
      {usage.by_user.length > 1 && (
        <div className="mt-4">
          <div className="text-gray-400 mb-2">By User</div>
          <div className="space-y-1">
            {usage.by_user.slice(0, 5).map((user) => (
              <div key={user.user_id} className="flex justify-between text-xs">
                <span className="text-gray-300">{user.name}</span>
                <span className="text-gray-400">${user.cost.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
