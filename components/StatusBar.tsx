// components/StatusBar.tsx
'use client';

interface StatusBarProps {
  model: string;
  tokens: number | null;
  latency: number | null;
  isStreaming: boolean;
  cacheHit?: boolean;
  usedFallback?: boolean;
  fallbackModel?: string | null;
  liveTokens?: number;
}

export default function StatusBar({
  model,
  tokens,
  latency,
  isStreaming,
  cacheHit = false,
  usedFallback = false,
  fallbackModel = null,
  liveTokens = 0,
}: StatusBarProps) {
  const displayTokens = isStreaming ? liveTokens : tokens;

  return (
    <div className="flex items-center justify-between px-4 h-8 bg-bg-surface border-t border-border shrink-0 animate-slide-up">
      <div className="flex items-center gap-1">
        {cacheHit ? (
          <>
            <span className="text-[10px] font-mono text-accent-green">⚡</span>
            <span className="text-[10px] font-mono text-accent-green uppercase tracking-wider">
              Cache hit
            </span>
            {latency !== null && (
              <>
                <span className="text-[10px] font-mono text-text-dim mx-1">•</span>
                <span className="text-[10px] font-mono text-accent-green">{latency}ms</span>
              </>
            )}
          </>
        ) : (
          <>
            <span className="text-[10px] font-mono text-text-dim uppercase tracking-wider">
              MODEL
            </span>
            <span className="text-[10px] font-mono text-accent-green">{model}</span>
            <span className="text-[10px] font-mono text-text-dim mx-1">•</span>
            <span className="text-[10px] font-mono text-text-dim uppercase tracking-wider">
              TOKENS
            </span>
            <span className="text-[10px] font-mono text-accent-green">
              {displayTokens !== null ? (isStreaming ? `~${displayTokens}` : displayTokens) : '—'}
            </span>
            {latency !== null && (
              <>
                <span className="text-[10px] font-mono text-text-dim mx-1">•</span>
                <span className="text-[10px] font-mono text-text-dim uppercase tracking-wider">
                  LATENCY
                </span>
                <span className="text-[10px] font-mono text-accent-green">{latency}ms</span>
              </>
            )}
          </>
        )}
      </div>
      <div className="flex items-center gap-2">
        {usedFallback && (
          <span className="text-[10px] font-mono text-accent-yellow uppercase tracking-wider flex items-center gap-1">
            ⚠ Fallback — {fallbackModel || 'unknown'}
          </span>
        )}
        {isStreaming && (
          <>
            <div className="w-1.5 h-1.5 rounded-full bg-accent-green animate-pulse-stream" />
            <span className="text-[10px] font-mono text-accent-green uppercase tracking-wider">
              STREAMING
            </span>
          </>
        )}
        {!isStreaming && displayTokens !== null && (
          <span className="text-[10px] font-mono text-text-dim uppercase tracking-wider">
            COMPLETE
          </span>
        )}
      </div>
    </div>
  );
}
