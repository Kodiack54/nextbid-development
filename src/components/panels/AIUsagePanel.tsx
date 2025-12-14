'use client';

import { useState, useEffect } from 'react';

interface UsageData {
  totals: { requests: number; total_tokens: number; cost_usd: number };
  budget: { monthly_limit: number; used: number; percent_used: number };
  by_user: Array<{ user_id: string; name: string; requests: number; cost: number }>;
}

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
  const budgetColor = budgetPercent > 80 ? 'bg-red-500' : budgetPercent > 60 ? 'bg-yellow-500' : 'bg-blue-500';

  return (
    <div className="text-sm">
      <div className="text-gray-400 mb-3">This Month</div>

      <div className="bg-gray-800 rounded-lg p-3 mb-3">
        <div className="text-2xl font-bold text-white">${usage.budget.used.toFixed(2)}</div>
        <div className="text-gray-500 text-xs">of ${usage.budget.monthly_limit} budget</div>
        <div className="mt-2 h-2 bg-gray-700 rounded-full overflow-hidden">
          <div className={`h-full ${budgetColor}`} style={{ width: `${budgetPercent}%` }} />
        </div>
        <div className="text-xs text-gray-500 mt-1">{usage.budget.percent_used.toFixed(1)}% used</div>
      </div>

      <div className="space-y-2 text-xs">
        <div className="flex justify-between">
          <span className="text-gray-400">Requests</span>
          <span className="text-white">{usage.totals.requests.toLocaleString()}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Tokens used</span>
          <span className="text-white">{usage.totals.total_tokens.toLocaleString()}</span>
        </div>
      </div>

      {usage.by_user.length > 0 && (
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
