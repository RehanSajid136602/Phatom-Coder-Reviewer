// components/AgentProgressBar.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { AgentStatus } from '@/hooks/useAgentStream';

interface AgentProgressBarProps {
  id: number | 'merger' | 'judge';
  displayName: string;
  status: AgentStatus;
  issueCount: number;
  duration: number | null;
  error: string | null;
  statusMessages: string[];
  isMerger?: boolean;
  totalRaw?: number;
}

export default function AgentProgressBar({
  id,
  displayName,
  status,
  issueCount,
  duration,
  error,
  statusMessages,
  isMerger = false,
  totalRaw = 0,
}: AgentProgressBarProps) {
  const [progress, setProgress] = useState(0);
  const [statusTextIndex, setStatusTextIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const startTimeRef = useRef<number | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const statusIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Progress bar animation
  useEffect(() => {
    if (status === 'running') {
      startTimeRef.current = Date.now();
      setProgress(0);

      intervalRef.current = setInterval(() => {
        const elapsedMs = Date.now() - (startTimeRef.current || Date.now());
        setElapsed(elapsedMs / 1000);

        // Fake non-linear fill up to 90%
        const seconds = elapsedMs / 1000;
        const fakeProgress = Math.min(90, 100 * (1 - Math.exp(-seconds / 8)));
        setProgress(fakeProgress);
      }, 100);

      // Rotate status messages
      statusIntervalRef.current = setInterval(() => {
        setStatusTextIndex((prev) => (prev + 1) % statusMessages.length);
      }, 1500);
    }

    if (status === 'complete') {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (statusIntervalRef.current) clearInterval(statusIntervalRef.current);
      setProgress(100);
    }

    if (status === 'failed') {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (statusIntervalRef.current) clearInterval(statusIntervalRef.current);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (statusIntervalRef.current) clearInterval(statusIntervalRef.current);
    };
  }, [status, statusMessages.length]);

  const getDotColor = (): string => {
    switch (status) {
      case 'running': return 'bg-accent-yellow animate-pulse-stream';
      case 'complete': return 'bg-accent-green';
      case 'failed': return 'bg-accent-red';
      default: return 'bg-text-dim';
    }
  };

  const getStatusText = (): string => {
    if (status === 'idle') return 'Waiting...';
    if (status === 'failed') return `Failed — ${error || 'unknown error'}`;
    if (status === 'complete') {
      if (isMerger) return `Complete`;
      return `Complete — ${issueCount} issue${issueCount !== 1 ? 's' : ''} found`;
    }
    if (isMerger) return 'Deduplicating and merging results...';
    return statusMessages[statusTextIndex] || 'scanning...';
  };

  const getDurationText = (): string => {
    if (status === 'running') return `${elapsed.toFixed(1)}s`;
    if (status === 'complete' && duration !== null) return `Done in ${(duration / 1000).toFixed(1)}s`;
    return '';
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        {/* Status dot */}
        <div className={`w-2 h-2 rounded-full shrink-0 ${getDotColor()}`} />

        {/* Agent name */}
        <span className="text-[13px] font-mono text-text-primary uppercase tracking-wider min-w-[180px]">
          {typeof id === 'number' ? `Agent 0${id}` : id === 'judge' ? 'Quality Filter' : 'Merger'}
        </span>

        {/* Display name */}
        <span className="text-[11px] font-mono text-text-body">
          {displayName}
        </span>

        {/* Progress bar */}
        <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden mx-2">
          <div
            className="h-full bg-accent-green transition-all duration-100 ease-out rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Duration */}
        <span className="text-[10px] font-mono text-text-dim min-w-[60px] text-right">
          {getDurationText()}
        </span>
      </div>

      {/* Status text */}
      <div className="flex items-center gap-2 pl-4">
        <span className="text-[11px] font-mono text-text-muted">
          {getStatusText()}
        </span>
        {isMerger && status === 'running' && totalRaw > 0 && (
          <span className="text-[10px] font-mono text-text-dim">
            Processing {totalRaw} raw findings...
          </span>
        )}
      </div>
    </div>
  );
}
