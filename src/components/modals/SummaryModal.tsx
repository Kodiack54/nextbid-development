'use client';

import { FileText } from 'lucide-react';

interface SessionSummary {
  summary: string;
  key_points: string[];
  action_items: string[];
  context_for_next_session: string;
}

interface SummaryModalProps {
  summary: SessionSummary;
  onClose: () => void;
}

export function SummaryModal({ summary, onClose }: SummaryModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <FileText size={20} />
            Session Summary
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          {/* Main Summary */}
          <div>
            <h3 className="text-sm font-medium text-gray-400 mb-2">Summary</h3>
            <p className="text-gray-200 bg-gray-900/50 p-3 rounded-lg">
              {summary.summary}
            </p>
          </div>

          {/* Key Points */}
          {summary.key_points.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-400 mb-2">Key Points</h3>
              <ul className="list-disc list-inside text-gray-300 space-y-1">
                {summary.key_points.map((point, i) => (
                  <li key={i}>{point}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Action Items */}
          {summary.action_items.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-400 mb-2">Action Items</h3>
              <ul className="space-y-1">
                {summary.action_items.map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-gray-300">
                    <span className="text-yellow-400">☐</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Context for Next Session */}
          {summary.context_for_next_session && (
            <div>
              <h3 className="text-sm font-medium text-gray-400 mb-2">Context for Next Session</h3>
              <div className="bg-blue-900/30 border border-blue-700/50 p-3 rounded-lg text-blue-200 text-sm">
                <p className="italic">{summary.context_for_next_session}</p>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(summary.context_for_next_session);
                  }}
                  className="mt-2 text-xs bg-blue-600 hover:bg-blue-700 px-2 py-1 rounded"
                >
                  Copy to Clipboard
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
