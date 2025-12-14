'use client';

export function BrowserPanel() {
  return (
    <div className="text-sm">
      <div className="text-gray-400 mb-2">Virtual Browser</div>
      <input
        type="text"
        placeholder="Enter URL..."
        className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white mb-2"
      />
      <div className="bg-gray-900 rounded h-48 flex items-center justify-center text-gray-500 text-xs">
        Browser preview coming soon
      </div>
      <div className="flex gap-1 mt-2">
        <button className="px-2 py-1 bg-red-600 text-white text-xs rounded">● Record</button>
        <button className="px-2 py-1 bg-gray-700 text-white text-xs rounded">📷</button>
        <button className="px-2 py-1 bg-gray-700 text-white text-xs rounded">🔍</button>
      </div>
    </div>
  );
}
