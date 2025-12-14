'use client';

import { useState } from 'react';

interface Project {
  id: string;
  name: string;
}

interface UnlockModalProps {
  project: Project | null;
  userId?: string;
  onClose: () => void;
  onUnlock: () => void;
}

export function UnlockModal({ project, userId, onClose, onUnlock }: UnlockModalProps) {
  const [patchNotes, setPatchNotes] = useState('');
  const [changesSummary, setChangesSummary] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleUnlock = async () => {
    if (!patchNotes.trim() || !project || !userId) return;
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/locks', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: project.id,
          user_id: userId,
          patch_notes: patchNotes,
          changes_summary: changesSummary,
        }),
      });

      const data = await response.json();
      if (data.success) {
        onUnlock();
      } else {
        alert(data.error || 'Failed to unlock');
      }
    } catch (error) {
      console.error('Error unlocking:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold text-white mb-4">Unlock {project?.name}</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">
              Patch Notes <span className="text-red-400">*</span>
            </label>
            <textarea
              value={patchNotes}
              onChange={(e) => setPatchNotes(e.target.value)}
              placeholder="What did you change? (required)"
              rows={3}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Changes Summary</label>
            <input
              type="text"
              value={changesSummary}
              onChange={(e) => setChangesSummary(e.target.value)}
              placeholder="e.g., Modified auth.js, server.js"
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 text-gray-400 hover:text-white">
            Cancel
          </button>
          <button
            onClick={handleUnlock}
            disabled={!patchNotes.trim() || isSubmitting}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded-lg"
          >
            {isSubmitting ? 'Unlocking...' : 'Unlock & Save Notes'}
          </button>
        </div>
      </div>
    </div>
  );
}
