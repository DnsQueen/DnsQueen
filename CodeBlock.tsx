import { useState } from "react";

interface CodeBlockProps {
  code: string;
  language?: string;
  title?: string;
  maxHeight?: string;
}

export default function CodeBlock({ code, language = "bash", title, maxHeight = "500px" }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="rounded-xl overflow-hidden border border-gray-700 bg-gray-950 shadow-2xl">
      {/* Header Bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-3">
          {/* Traffic lights */}
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
          </div>
          {title && (
            <span className="text-gray-400 text-xs font-mono ml-2">{title}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-500 text-xs font-mono uppercase">{language}</span>
          <button
            onClick={handleCopy}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all duration-200 ${
              copied
                ? "bg-green-500/20 text-green-400 border border-green-500/40"
                : "bg-gray-700 text-gray-300 hover:bg-gray-600 border border-gray-600"
            }`}
          >
            {copied ? (
              <>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Copied!
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Copy
              </>
            )}
          </button>
        </div>
      </div>

      {/* Code Content */}
      <div
        className="overflow-auto"
        style={{ maxHeight }}
      >
        <pre className="p-4 text-sm font-mono leading-relaxed text-gray-300 whitespace-pre">
          <code>{code}</code>
        </pre>
      </div>
    </div>
  );
}
