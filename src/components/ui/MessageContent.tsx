'use client';

interface MessageContentProps {
  content: string;
}

export function MessageContent({ content }: MessageContentProps) {
  const parts = content.split(/(```[\s\S]*?```)/g);

  return (
    <div className="space-y-2">
      {parts.map((part, i) => {
        if (part.startsWith('```')) {
          const match = part.match(/```(\w+)?\n([\s\S]*?)```/);
          const language = match?.[1] || 'text';
          const code = match?.[2] || part.slice(3, -3);

          return (
            <div key={i} className="relative">
              <div className="bg-gray-900 rounded-lg overflow-hidden">
                <div className="flex items-center justify-between px-3 py-1 bg-gray-800 text-xs text-gray-400">
                  <span>{language}</span>
                  <button className="hover:text-white">Copy</button>
                </div>
                <pre className="p-3 text-sm text-green-400 overflow-x-auto">
                  <code>{code}</code>
                </pre>
              </div>
              <button className="mt-1 px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded">
                Apply to File
              </button>
            </div>
          );
        }

        return (
          <p key={i} className="whitespace-pre-wrap">
            {part.split(/(\*\*.*?\*\*)/g).map((segment, j) => {
              if (segment.startsWith('**') && segment.endsWith('**')) {
                return <strong key={j}>{segment.slice(2, -2)}</strong>;
              }
              return segment;
            })}
          </p>
        );
      })}
    </div>
  );
}
