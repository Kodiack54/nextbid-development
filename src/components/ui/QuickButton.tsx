'use client';

interface QuickButtonProps {
  label: string;
  onClick: () => void;
}

export function QuickButton({ label, onClick }: QuickButtonProps) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded-lg border border-gray-600"
    >
      {label}
    </button>
  );
}
