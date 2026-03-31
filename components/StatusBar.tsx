// components/StatusBar.tsx
'use client';

interface StatusBarProps {
  model: string;
  tokens: number | null;
  latency: number | null;
  isStreaming: boolean;
}

export default function StatusBar({ model, tokens, latency, isStreaming }: StatusBarProps) {
  return (
    <div className="flex items-center justify-between px-4 h-8 bg-bg-surface border-t border-border shrink-0 animate-slide-up">
      <div className="flex items-center gap-1">
        <span className="text-[10px] font-mono text-text-dim uppercase tracking-wider">
          MODEL
        </span>
        <span className="text-[10px] font-mono text-accent-green">{model}</span>
        <span className="text-[10px] font-mono text-text-dim mx-1">•</span>
        <span className="text-[10px] font-mono text-text-dim uppercase tracking-wider">
          TOKENS
        </span>
        <span className="text-[10px] font-mono text-accent-green">{tokens !== null ? tokens : '—'}</span>
        <span className="text-[10px] font-mono text-text-dim mx-1">•</span>
        <span className="text-[10px] font-mono text-text-dim uppercase tracking-wider">
          LATENCY
        </span>
        <span className="text-[10px] font-mono text-accent-green">{latency !== null ? `${latency}ms` : '—'}</span>
      </div>
      <div className="flex items-center gap-1.5">
        {isStreaming && (
          <>
            <div className="w-1.5 h-1.5 rounded-full bg-accent-green animate-pulse-stream" />
            <span className="text-[10px] font-mono text-accent-green uppercase tracking-wider">
              STREAMING
            </span>
          </>
        )}
        {!isStreaming && tokens !== null && (
          <span className="text-[10px] font-mono text-text-dim uppercase tracking-wider">
            COMPLETE
          </span>
        )}
      </div>
    </div>
  );
}
