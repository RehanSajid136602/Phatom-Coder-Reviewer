// components/AgentProgress.tsx
'use client';

import { useState, useEffect } from 'react';
import { AgentStreamState } from '@/hooks/useAgentStream';
import AgentProgressBar from './AgentProgressBar';

interface AgentProgressProps {
  state: AgentStreamState;
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

export default function AgentProgress({ state }: AgentProgressProps) {
  const { agents, merger, judge, totalRawIssues, judgeFiltered, isStreaming, isComplete, score, streamedText } = state;
  const [isMinimized, setIsMinimized] = useState(false);

  // Minimize when merger starts streaming content
  useEffect(() => {
    if (streamedText.length > 0 && (merger.status === 'running' || judge.status === 'running')) {
      const timer = setTimeout(() => setIsMinimized(true), 800);
      return () => clearTimeout(timer);
    }
  }, [streamedText, merger.status, judge.status]);

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
        {isComplete && score !== null && (
          <span className="flex items-center gap-1 text-[10px] font-mono text-accent-green">
            ✓ complete — Score: {score}/10
          </span>
        )}
      </div>
    );
  }

  // Full progress panel (Phase 1-3)
  return (
    <div className="px-5 py-4 bg-bg-void border-b border-border shrink-0 animate-fade-in">
      <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-accent-green mb-4">
        PHANTOM ANALYSIS
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
