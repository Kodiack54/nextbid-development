'use client';

interface BucketData {
  bugs: number;
  features: number;
  todos: number;
  errors: number;
  knowledge: number;
  decisions: number;
  total: number;
}

interface BucketCountersProps {
  buckets: BucketData;
}

export function BucketCounters({ buckets }: BucketCountersProps) {
  const bucketConfigs = [
    { key: 'bugs', label: 'Bugs', icon: '🐛', color: 'red', description: 'Issues flagged by Jen' },
    { key: 'features', label: 'Features', icon: '✨', color: 'blue', description: 'Feature requests identified' },
    { key: 'todos', label: 'Todos', icon: '📋', color: 'yellow', description: 'Tasks to be assigned' },
    { key: 'errors', label: 'Errors', icon: '❌', color: 'orange', description: 'Runtime errors captured' },
    { key: 'knowledge', label: 'Knowledge', icon: '📚', color: 'purple', description: 'Learnings to store' },
    { key: 'decisions', label: 'Decisions', icon: '⚖️', color: 'green', description: 'Architecture decisions' },
  ] as const;

  const colorClasses: Record<string, { bg: string; border: string; text: string }> = {
    red: { bg: 'bg-red-900/30', border: 'border-red-600', text: 'text-red-400' },
    blue: { bg: 'bg-blue-900/30', border: 'border-blue-600', text: 'text-blue-400' },
    yellow: { bg: 'bg-yellow-900/30', border: 'border-yellow-600', text: 'text-yellow-400' },
    orange: { bg: 'bg-orange-900/30', border: 'border-orange-600', text: 'text-orange-400' },
    purple: { bg: 'bg-purple-900/30', border: 'border-purple-600', text: 'text-purple-400' },
    green: { bg: 'bg-green-900/30', border: 'border-green-600', text: 'text-green-400' },
  };

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-medium text-gray-400">Categorized Buckets</h2>
        <div className="text-xs text-gray-500">
          Total: <span className="font-mono text-white">{buckets.total}</span> items
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {bucketConfigs.map(bucket => {
          const colors = colorClasses[bucket.color];
          const count = buckets[bucket.key as keyof BucketData] as number;

          return (
            <div
              key={bucket.key}
              className={`p-4 rounded-lg border ${colors.bg} ${colors.border} hover:brightness-110 transition-all cursor-pointer`}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">{bucket.icon}</span>
                <span className={`font-medium ${colors.text}`}>{bucket.label}</span>
              </div>
              <div className="text-3xl font-bold text-white mb-1">
                {count}
              </div>
              <div className="text-xs text-gray-500">
                {bucket.description}
              </div>
              {count > 0 && (
                <button className="mt-2 text-xs text-gray-400 hover:text-white">
                  View all →
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary section */}
      <div className="mt-6 p-4 bg-gray-800/50 rounded-lg">
        <h3 className="text-sm font-medium text-gray-400 mb-3">Pipeline Summary</h3>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-blue-400">
              {buckets.bugs + buckets.errors}
            </div>
            <div className="text-xs text-gray-500">Need Fixing</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-yellow-400">
              {buckets.todos + buckets.features}
            </div>
            <div className="text-xs text-gray-500">To Do</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-green-400">
              {buckets.knowledge + buckets.decisions}
            </div>
            <div className="text-xs text-gray-500">Documented</div>
          </div>
        </div>
      </div>
    </div>
  );
}
