'use client';

export function BuildVersion() {
  const version = process.env.BUILD_VERSION || '0.0.0';

  return (
    <div
      className="fixed bottom-2 right-2 px-2 py-1 bg-gray-900/80 text-gray-500 text-xs rounded border border-gray-700 font-mono z-50"
      title={`Built: ${process.env.BUILD_TIME || 'unknown'}`}
    >
      v{version}
    </div>
  );
}
