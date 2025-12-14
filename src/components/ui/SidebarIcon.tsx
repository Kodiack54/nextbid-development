'use client';

interface SidebarIconProps {
  icon: string | React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}

export function SidebarIcon({ icon, label, active, onClick }: SidebarIconProps) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl transition-colors ${
        active ? 'bg-blue-600 text-white' : 'hover:bg-gray-700 text-gray-400'
      }`}
    >
      {icon}
    </button>
  );
}
