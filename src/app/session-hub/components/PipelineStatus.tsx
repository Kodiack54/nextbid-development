'use client';

interface WorkerStatus {
  isRunning: boolean;
  queue: number;
  processed: number;
  lastActivity: string | null;
  error: string | null;
}

interface PipelineStatusProps {
  chad: WorkerStatus;
  jen: WorkerStatus;
  susan: WorkerStatus;
  onTriggerWorker: (worker: 'chad' | 'jen' | 'susan') => void;
}

export function PipelineStatus({ chad, jen, susan, onTriggerWorker }: PipelineStatusProps) {
  const hasError = chad.error || jen.error || susan.error;
  const isStuck = !chad.isRunning && !jen.isRunning && !susan.isRunning && (chad.queue > 0 || jen.queue > 0);

  return (
    <div className="px-4 py-3 bg-gray-800/50 border-b border-gray-700">
      {/* Alert Banner */}
      {(hasError || isStuck) && (
        <div className={`mb-3 p-2 rounded text-xs ${hasError ? 'bg-red-900/30 border border-red-700 text-red-400' : 'bg-yellow-900/30 border border-yellow-700 text-yellow-400'}`}>
          {hasError ? 'Pipeline error detected - check worker logs' : 'Pipeline may be stuck - items queued but no workers running'}
        </div>
      )}

      {/* Pipeline Visualization */}
      <div className="flex items-center justify-between">
        {/* Chad */}
        <WorkerNode
          name="Chad"
          port={5401}
          status={chad}
          color="blue"
          onTrigger={() => onTriggerWorker('chad')}
        />

        {/* Arrow */}
        <PipelineArrow count={chad.queue} label="Raw dumps" />

        {/* Jen */}
        <WorkerNode
          name="Jen"
          port={5407}
          status={jen}
          color="purple"
          onTrigger={() => onTriggerWorker('jen')}
        />

        {/* Arrow */}
        <PipelineArrow count={jen.queue} label="Flagged items" />

        {/* Susan */}
        <WorkerNode
          name="Susan"
          port={5403}
          status={susan}
          color="green"
          onTrigger={() => onTriggerWorker('susan')}
        />
      </div>
    </div>
  );
}

interface WorkerNodeProps {
  name: string;
  port: number;
  status: WorkerStatus;
  color: 'blue' | 'purple' | 'green';
  onTrigger: () => void;
}

function WorkerNode({ name, port, status, color, onTrigger }: WorkerNodeProps) {
  const bgColors = {
    blue: 'bg-blue-900/40 border-blue-600',
    purple: 'bg-purple-900/40 border-purple-600',
    green: 'bg-green-900/40 border-green-600',
  };

  const dotColors = {
    blue: 'bg-blue-400',
    purple: 'bg-purple-400',
    green: 'bg-green-400',
  };

  const textColors = {
    blue: 'text-blue-400',
    purple: 'text-purple-400',
    green: 'text-green-400',
  };

  return (
    <div className={`px-4 py-2 rounded-lg border ${bgColors[color]} min-w-[120px]`}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${status.isRunning ? dotColors[color] : 'bg-gray-500'} ${status.isRunning ? 'animate-pulse' : ''}`} />
          <span className={`font-medium text-sm ${textColors[color]}`}>{name}</span>
        </div>
        <span className="text-[10px] text-gray-500">:{port}</span>
      </div>
      <div className="flex items-center justify-between">
        <div className="text-xs text-gray-400">
          <span className="font-mono">{status.processed}</span> done
        </div>
        <button
          onClick={onTrigger}
          disabled={status.isRunning}
          className="text-[10px] px-1.5 py-0.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 rounded"
        >
          Run
        </button>
      </div>
      {status.error && (
        <div className="mt-1 text-[10px] text-red-400 truncate" title={status.error}>
          Error!
        </div>
      )}
    </div>
  );
}

interface PipelineArrowProps {
  count: number;
  label: string;
}

function PipelineArrow({ count, label }: PipelineArrowProps) {
  return (
    <div className="flex flex-col items-center px-2">
      <div className="flex items-center gap-1">
        <div className="w-8 h-0.5 bg-gray-600" />
        <div className={`px-2 py-0.5 rounded text-xs font-mono ${count > 0 ? 'bg-yellow-900/50 text-yellow-400' : 'bg-gray-800 text-gray-500'}`}>
          {count}
        </div>
        <div className="w-8 h-0.5 bg-gray-600" />
        <div className="text-gray-500">→</div>
      </div>
      <div className="text-[10px] text-gray-500 mt-0.5">{label}</div>
    </div>
  );
}
