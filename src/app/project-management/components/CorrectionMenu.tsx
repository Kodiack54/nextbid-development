'use client';

import { useState, useRef, useEffect } from 'react';
import { MoreVertical, ArrowRight, Trash2, Edit3, MessageSquare, X, AlertCircle, Check } from 'lucide-react';

interface CorrectionMenuProps {
  itemType: 'knowledge' | 'journal' | 'doc' | 'convention';
  itemId: string;
  itemTitle: string;
  currentProject?: string;
  onCorrectionSubmitted?: () => void;
}

type CorrectionType = 'move' | 'remove' | 'reword' | 'note';

interface CorrectionOption {
  type: CorrectionType;
  label: string;
  icon: typeof MoreVertical;
  color: string;
  description: string;
}

const CORRECTION_OPTIONS: CorrectionOption[] = [
  { type: 'move', label: 'Move to Project', icon: ArrowRight, color: 'text-blue-400', description: 'Reassign to a different project' },
  { type: 'remove', label: 'Flag for Removal', icon: Trash2, color: 'text-red-400', description: 'This item is incorrect or irrelevant' },
  { type: 'reword', label: 'Request Reword', icon: Edit3, color: 'text-yellow-400', description: 'Ask Clair to rewrite this' },
  { type: 'note', label: 'Add Note', icon: MessageSquare, color: 'text-green-400', description: 'Leave feedback for Clair' },
];

export default function CorrectionMenu({ itemType, itemId, itemTitle, currentProject, onCorrectionSubmitted }: CorrectionMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<CorrectionType | null>(null);
  const [targetProject, setTargetProject] = useState('');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ success: boolean; message: string } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        handleClose();
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleClose = () => {
    setIsOpen(false);
    setSelectedType(null);
    setTargetProject('');
    setNote('');
    setSubmitResult(null);
  };

  const handleSubmit = async () => {
    if (!selectedType) return;

    setIsSubmitting(true);
    setSubmitResult(null);

    try {
      const details: Record<string, string> = {};

      if (selectedType === 'move' && targetProject) {
        details.target_project = targetProject;
      }

      if (note) {
        details.note = note;
      }

      if (selectedType === 'reword' && note) {
        details.suggested_text = note;
      }

      const response = await fetch('/api/clair/corrections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_type: itemType,
          item_id: itemId,
          correction_type: selectedType,
          details,
          created_by: 'user'
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSubmitResult({ success: true, message: 'Correction submitted!' });
        onCorrectionSubmitted?.();
        setTimeout(handleClose, 1500);
      } else {
        setSubmitResult({ success: false, message: data.error || 'Failed to submit' });
      }
    } catch (error) {
      setSubmitResult({ success: false, message: 'Network error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const needsInput = selectedType === 'move' || selectedType === 'reword' || selectedType === 'note';
  const canSubmit = selectedType && (!needsInput || (selectedType === 'move' ? targetProject : note));

  return (
    <div className="relative" ref={menuRef}>
      {/* Trigger Button */}
      <button
        onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
        className="p-1.5 text-gray-500 hover:text-white hover:bg-gray-700 rounded transition-colors"
        title="Correction options"
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className="absolute right-0 top-8 z-50 w-72 bg-gray-800 border border-gray-700 rounded-lg shadow-xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-3 py-2 bg-gray-750 border-b border-gray-700 flex items-center justify-between">
            <span className="text-sm text-white font-medium">Correct This Item</span>
            <button onClick={handleClose} className="text-gray-500 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Item Info */}
          <div className="px-3 py-2 border-b border-gray-700">
            <p className="text-xs text-gray-500 truncate">{itemTitle}</p>
          </div>

          {/* Options List (if no type selected) */}
          {!selectedType && (
            <div className="py-1">
              {CORRECTION_OPTIONS.map(option => (
                <button
                  key={option.type}
                  onClick={() => setSelectedType(option.type)}
                  className="w-full px-3 py-2 flex items-center gap-3 hover:bg-gray-700 transition-colors text-left"
                >
                  <option.icon className={`w-4 h-4 ${option.color}`} />
                  <div>
                    <p className="text-sm text-white">{option.label}</p>
                    <p className="text-xs text-gray-500">{option.description}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Input Form (if type selected) */}
          {selectedType && (
            <div className="p-3 space-y-3">
              {/* Back button */}
              <button
                onClick={() => { setSelectedType(null); setNote(''); setTargetProject(''); }}
                className="text-xs text-gray-500 hover:text-white flex items-center gap-1"
              >
                ← Back to options
              </button>

              {/* Move: Project selector */}
              {selectedType === 'move' && (
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Target Project Path</label>
                  <input
                    type="text"
                    value={targetProject}
                    onChange={(e) => setTargetProject(e.target.value)}
                    placeholder="/var/www/NextBid_Dev/project-name"
                    className="w-full px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-white text-sm placeholder-gray-500"
                    autoFocus
                  />
                  {currentProject && (
                    <p className="text-xs text-gray-500 mt-1">Current: {currentProject}</p>
                  )}
                </div>
              )}

              {/* Remove: Confirmation */}
              {selectedType === 'remove' && (
                <div className="flex items-start gap-2 p-2 bg-red-900/20 border border-red-800/50 rounded">
                  <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-red-400">Flag for removal?</p>
                    <p className="text-xs text-gray-400 mt-1">Clair will remove this item after review.</p>
                  </div>
                </div>
              )}

              {/* Reword/Note: Text input */}
              {(selectedType === 'reword' || selectedType === 'note') && (
                <div>
                  <label className="block text-xs text-gray-400 mb-1">
                    {selectedType === 'reword' ? 'How should it be reworded?' : 'Your note for Clair'}
                  </label>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder={selectedType === 'reword' ? 'Describe how to improve this...' : 'Add your feedback...'}
                    rows={3}
                    className="w-full px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-white text-sm placeholder-gray-500 resize-none"
                    autoFocus
                  />
                </div>
              )}

              {/* Optional note for move/remove */}
              {(selectedType === 'move' || selectedType === 'remove') && (
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Note (optional)</label>
                  <input
                    type="text"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Why this correction?"
                    className="w-full px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-white text-sm placeholder-gray-500"
                  />
                </div>
              )}

              {/* Submit Result */}
              {submitResult && (
                <div className={`flex items-center gap-2 p-2 rounded text-sm ${submitResult.success ? 'bg-green-900/20 text-green-400' : 'bg-red-900/20 text-red-400'}`}>
                  {submitResult.success ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                  {submitResult.message}
                </div>
              )}

              {/* Submit Button */}
              <button
                onClick={handleSubmit}
                disabled={!canSubmit || isSubmitting}
                className={`w-full py-2 rounded text-sm font-medium transition-colors ${
                  canSubmit && !isSubmitting
                    ? 'bg-purple-600 hover:bg-purple-700 text-white'
                    : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                }`}
              >
                {isSubmitting ? 'Submitting...' : 'Submit Correction'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
