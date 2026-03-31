// components/AgentProgress.tsx
'use client';

import { useState, useEffect } from 'react';
import { AgentStreamState } from '@/hooks/useAgentStream';
import { motion, AnimatePresence } from 'framer-motion';

interface AgentProgressProps {
  state: AgentStreamState;
  onCancel?: () => void;
}

const AGENT_STATUS_MESSAGES: Record<number, string[]> = {
  1: [
    'scanning for injections...',
    'checking auth flows...',
    'hunting hardcoded secrets...',
    'tracing RCE vectors...',
  ],
  2: [
    'checking error handling...',
    'scanning type safety...',
    'finding dead code...',
    'reviewing logic flow...',
  ],
  3: [
    'detecting language...',
    'checking idioms...',
    'scanning framework usage...',
    'reviewing patterns...',
  ],
};

const AGENT_COLORS: Record<string, string> = {
  security: '#ff4444',
  quality: '#f5a623',
  language: '#4a9eff',
  merger: '#00ff88',
  judge: 'rgba(255,255,255,0.3)',
};

function TimelineBar({
  label,
  duration,
  color,
  isComplete,
  delay,
  filteredCount,
}: {
  label: string;
  duration: number | null;
  color: string;
  isComplete: boolean;
  delay: number;
  filteredCount?: number;
}) {
  const durationText = duration !== null ? `${duration}ms` : '';

  return (
    <div className="flex items-center gap-3 text-[11px] font-mono">
      <span className="w-[120px] text-text-body truncate">{label}</span>
      <div className="flex-1 h-2 bg-border rounded-full overflow-hidden relative">
        {isComplete && (
          <motion.div
            className="h-full rounded-full"
            style={{ backgroundColor: color }}
            initial={{ width: '0%' }}
            animate={{ width: '100%' }}
            transition={{ duration: 0.6, delay: delay / 1000, ease: 'easeOut' }}
          />
        )}
      </div>
      <span className="w-[60px] text-right text-text-dim">{durationText}</span>
      <span className="w-[30px] text-right text-accent-green">✓</span>
      {filteredCount !== undefined && filteredCount > 0 && (
        <span className="text-accent-blue text-[10px]">−{filteredCount} findings</span>
      )}
    </div>
  );
}

export default function AgentProgress({ state, onCancel }: AgentProgressProps) {
  const { agents, merger, judge, totalRawIssues, judgeFiltered, isStreaming, isComplete, score, streamedText } = state;
  const [isMinimized, setIsMinimized] = useState(false);

  // Minimize when merger starts streaming content
  useEffect(() => {
    if (streamedText.length > 0 && (merger.status === 'running' || judge.status === 'running')) {
      const timer = setTimeout(() => setIsMinimized(true), 800);
      return () => clearTimeout(timer);
    }
  }, [streamedText, merger.status, judge.status]);

  // Persistent Timeline Mode (after completion)
  if (isComplete) {
    return (
      <div className="px-5 py-3 bg-bg-void border-b border-border shrink-0">
        <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-accent-green mb-3 flex items-center justify-between">
          <span>ANALYSIS COMPLETE</span>
          {score !== null && (
            <span className="text-accent-green">Score: {score}/10</span>
          )}
        </div>

        <div className="space-y-2">
          {agents.map((agent, idx) => (
            <TimelineBar
              key={agent.id}
              label={`Agent 0${idx + 1}`}
              duration={agent.duration}
              color={AGENT_COLORS[agent.displayName.toLowerCase()] || '#00ff88'}
              isComplete={agent.status === 'complete'}
              delay={idx * 80}
            />
          ))}

          <div className="border-t border-border my-2" />

          <TimelineBar
            label="Merger"
            duration={merger.duration}
            color={AGENT_COLORS.merger}
            isComplete={merger.status === 'complete'}
            delay={280}
          />

          <TimelineBar
            label="Judge"
            duration={judge.duration}
            color={AGENT_COLORS.judge}
            isComplete={judge.status === 'complete'}
            delay={340}
            filteredCount={judgeFiltered}
          />
        </div>
      </div>
    );
  }

  // Minimized bar (Phase 4-5)
  if (isMinimized) {
    const allAgentsComplete = agents.every((a) => a.status === 'complete' || a.status === 'failed');
    const successfulAgents = agents.filter((a) => a.status === 'complete').length;

    return (
      <div className="flex items-center gap-3 px-4 py-2 bg-bg-void border-b border-border shrink-0 animate-fade-in">
        {allAgentsComplete && (
          <span className="flex items-center gap-1 text-[10px] font-mono text-accent-green">
            ✓ {successfulAgents} agent{successfulAgents !== 1 ? 's' : ''}
          </span>
        )}
        {merger.status === 'complete' && (
          <span className="flex items-center gap-1 text-[10px] font-mono text-accent-green">
            ✓ merged
          </span>
        )}
        {judge.status === 'complete' && judgeFiltered > 0 && (
          <span className="flex items-center gap-1 text-[10px] font-mono text-accent-blue">
            ✓ {judgeFiltered} filtered
          </span>
        )}
        {isStreaming && !isComplete && (
          <span className="flex items-center gap-1 text-[10px] font-mono text-accent-yellow">
            <div className="w-1.5 h-1.5 rounded-full bg-accent-yellow animate-pulse-stream" />
            streaming...
          </span>
        )}
      </div>
    );
  }

  // Full progress panel (Phase 1-3)
  return (
    <div className="px-5 py-4 bg-bg-void border-b border-border shrink-0 animate-fade-in">
      <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-accent-green mb-4 flex items-center justify-between">
        <span>PHANTOM ANALYSIS</span>
        {isStreaming && (
          <button
            onClick={onCancel}
            className="text-[10px] px-2 py-0.5 border border-accent-red/40 text-accent-red hover:bg-accent-red/10 transition-colors"
          >
            ✕ Cancel
          </button>
        )}
      </div>

      <div className="space-y-3">
        {agents.map((agent) => (
          <AgentProgressBar
            key={agent.id}
            id={typeof agent.id === 'number' ? agent.id : 1}
            displayName={agent.displayName}
            status={agent.status}
            issueCount={agent.issueCount}
            duration={agent.duration}
            error={agent.error}
            statusMessages={typeof agent.id === 'number' && agent.id > 0 ? AGENT_STATUS_MESSAGES[agent.id] : ['scanning...']}
          />
        ))}

        <div className="pt-2 border-t border-border">
          <AgentProgressBar
            id="merger"
            displayName="Merger"
            status={merger.status}
            issueCount={0}
            duration={merger.duration}
            error={merger.error}
            statusMessages={['Deduplicating and merging results...']}
            isMerger
            totalRaw={totalRawIssues}
          />
        </div>

        {(judge.status === 'running' || judge.status === 'complete' || judge.status === 'failed' || streamedText.length > 0) && (
          <AgentProgressBar
            id="judge"
            displayName="Quality Filter"
            status={judge.status}
            issueCount={judgeFiltered}
            duration={judge.duration}
            error={judge.error}
            statusMessages={['Filtering low-signal findings...']}
            isMerger
            totalRaw={totalRawIssues}
          />
        )}
      </div>
    </div>
  );
}

// Legacy progress bar component (used during streaming)
function AgentProgressBar({
  id,
  displayName,
  status,
  issueCount,
  duration,
  error,
  statusMessages,
  isMerger = false,
  totalRaw = 0,
}: {
  id: number | 'merger' | 'judge';
  displayName: string;
  status: 'idle' | 'running' | 'complete' | 'failed';
  issueCount: number;
  duration: number | null;
  error: string | null;
  statusMessages: string[];
  isMerger?: boolean;
  totalRaw?: number;
}) {
  const [progress, setProgress] = useState(0);
  const [statusTextIndex, setStatusTextIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  // Progress bar animation
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    let statusInterval: NodeJS.Timeout | null = null;
    let startTime: number | null = null;

    if (status === 'running') {
      startTime = Date.now();
      setProgress(0);

      interval = setInterval(() => {
        const elapsedMs = Date.now() - (startTime || Date.now());
        setElapsed(elapsedMs / 1000);

        // Fake non-linear fill up to 90%
        const seconds = elapsedMs / 1000;
        const fakeProgress = Math.min(90, 100 * (1 - Math.exp(-seconds / 8)));
        setProgress(fakeProgress);
      }, 100);

      // Rotate status messages
      statusInterval = setInterval(() => {
        setStatusTextIndex((prev) => (prev + 1) % statusMessages.length);
      }, 1500);
    }

    if (status === 'complete') {
      if (interval) clearInterval(interval);
      if (statusInterval) clearInterval(statusInterval);
      setProgress(100);
    }

    if (status === 'failed') {
      if (interval) clearInterval(interval);
      if (statusInterval) clearInterval(statusInterval);
    }

    return () => {
      if (interval) clearInterval(interval);
      if (statusInterval) clearInterval(statusInterval);
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
