// hooks/useAgentStream.ts
'use client';

import { useState, useCallback, useRef } from 'react';

export type AgentStatus = 'idle' | 'running' | 'complete' | 'failed';

export interface AgentState {
  id: 1 | 2 | 3 | 'merger' | 'judge';
  name: string;
  displayName: string;
  status: AgentStatus;
  issueCount: number;
  startTime: number | null;
  endTime: number | null;
  duration: number | null;
  error: string | null;
}

export interface AgentStreamState {
  agents: AgentState[];
  merger: AgentState;
  judge: AgentState;
  totalRawIssues: number;
  judgeFiltered: number;
  isStreaming: boolean;
  isComplete: boolean;
  wasCancelled: boolean;
  score: number | null;
  streamedText: string;
  liveTokens: number;
  cacheHit: boolean;
  usedFallback: boolean;
  fallbackModel: string | null;
}

const INITIAL_AGENTS: AgentState[] = [
  {
    id: 1,
    name: 'security',
    displayName: 'Security Scanner',
    status: 'idle',
    issueCount: 0,
    startTime: null,
    endTime: null,
    duration: null,
    error: null,
  },
  {
    id: 2,
    name: 'quality',
    displayName: 'Quality Reviewer',
    status: 'idle',
    issueCount: 0,
    startTime: null,
    endTime: null,
    duration: null,
    error: null,
  },
  {
    id: 3,
    name: 'language',
    displayName: 'Language Specialist',
    status: 'idle',
    issueCount: 0,
    startTime: null,
    endTime: null,
    duration: null,
    error: null,
  },
];

const INITIAL_MERGER: AgentState = {
  id: 'merger',
  name: 'merger',
  displayName: 'Merger',
  status: 'idle',
  issueCount: 0,
  startTime: null,
  endTime: null,
  duration: null,
  error: null,
};

const INITIAL_JUDGE: AgentState = {
  id: 'judge',
  name: 'judge',
  displayName: 'Quality Filter',
  status: 'idle',
  issueCount: 0,
  startTime: null,
  endTime: null,
  duration: null,
  error: null,
};

// djb2 hash for request deduplication
function djb2(str: string): string {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h) + str.charCodeAt(i);
  }
  return String(h >>> 0);
}

export function useAgentStream() {
  const [state, setState] = useState<AgentStreamState>({
    agents: INITIAL_AGENTS.map((a) => ({ ...a })),
    merger: { ...INITIAL_MERGER },
    judge: { ...INITIAL_JUDGE },
    totalRawIssues: 0,
    judgeFiltered: 0,
    isStreaming: false,
    isComplete: false,
    wasCancelled: false,
    score: null,
    streamedText: '',
    liveTokens: 0,
    cacheHit: false,
    usedFallback: false,
    fallbackModel: null,
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  const reviewHashRef = useRef<string | null>(null);
  const charCountRef = useRef(0);
  const lastUpdateRef = useRef(Date.now());

  const resetState = useCallback(() => {
    setState({
      agents: INITIAL_AGENTS.map((a) => ({ ...a })),
      merger: { ...INITIAL_MERGER },
      judge: { ...INITIAL_JUDGE },
      totalRawIssues: 0,
      judgeFiltered: 0,
      isStreaming: false,
      isComplete: false,
      wasCancelled: false,
      score: null,
      streamedText: '',
      liveTokens: 0,
      cacheHit: false,
      usedFallback: false,
      fallbackModel: null,
    });
    charCountRef.current = 0;
    lastUpdateRef.current = Date.now();
  }, []);

  const startStream = useCallback(
    async (code: string, language: string) => {
      // Request deduplication — skip if same code already streaming
      const hash = djb2(code + language);
      if (state.isStreaming && hash === reviewHashRef.current) {
        return;
      }
      reviewHashRef.current = hash;

      resetState();

      setState((prev) => ({
        ...prev,
        isStreaming: true,
        wasCancelled: false,
        agents: prev.agents.map((a) => ({ ...a, status: 'running' as AgentStatus, startTime: Date.now() })),
      }));

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      try {
        const response = await fetch('/api/review', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, language }),
          signal: abortController.signal,
        });

        // Cache hit indicator
        const cacheHit = response.headers.get('X-Cache') === 'HIT';
        
        // Fallback model indicator
        const usedFallback = response.headers.get('X-Used-Fallback') === 'true';
        const fallbackModel = response.headers.get('X-Model-Used');

        if (cacheHit) {
          setState((prev) => ({ ...prev, cacheHit: true }));
        }

        if (usedFallback) {
          setState((prev) => ({ ...prev, usedFallback: true, fallbackModel }));
        }

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `API error: ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error('No response stream');

        const decoder = new TextDecoder();
        let accumulated = '';
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          buffer += chunk;

          // Live token counter (throttled to 5 updates/sec)
          charCountRef.current += chunk.length;
          const now = Date.now();
          if (now - lastUpdateRef.current > 200) {
            setState((prev) => ({
              ...prev,
              liveTokens: Math.floor(charCountRef.current / 4),
            }));
            lastUpdateRef.current = now;
          }

          // Parse SSE events from buffer
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            
            // Handle SSE termination signal
            if (trimmed === 'data: [DONE]' || trimmed === '[DONE]') {
              continue;
            }
            
            if (!trimmed.startsWith('data: ')) {
              // Non-SSE line - treat as raw content
              if (trimmed) {
                accumulated += trimmed + '\n';
                setState((prev) => ({ ...prev, streamedText: accumulated }));
              }
              continue;
            }

            const data = trimmed.slice(6);

            if (data === '[DONE]') {
              continue;
            }

            try {
              const event = JSON.parse(data);

              switch (event.type) {
                case 'agent_complete': {
                  const agentId = event.agent as 1 | 2 | 3;
                  setState((prev) => ({
                    ...prev,
                    agents: prev.agents.map((a) =>
                      a.id === agentId
                        ? {
                            ...a,
                            status: 'complete',
                            issueCount: event.issueCount || 0,
                            endTime: Date.now(),
                            duration: event.duration || null,
                          }
                        : a
                    ),
                  }));
                  break;
                }

                case 'agent_failed': {
                  const agentId = event.agent as 1 | 2 | 3;
                  setState((prev) => ({
                    ...prev,
                    agents: prev.agents.map((a) =>
                      a.id === agentId
                        ? {
                            ...a,
                            status: 'failed',
                            error: event.error || 'unknown',
                            endTime: Date.now(),
                            duration: event.duration || null,
                          }
                        : a
                    ),
                  }));
                  break;
                }

                case 'merger_start': {
                  setState((prev) => ({
                    ...prev,
                    totalRawIssues: event.totalRaw || 0,
                    merger: {
                      ...prev.merger,
                      status: 'running',
                      startTime: Date.now(),
                    },
                  }));
                  break;
                }

                case 'judge_start': {
                  setState((prev) => ({
                    ...prev,
                    judge: {
                      ...prev.judge,
                      status: 'running',
                      startTime: Date.now(),
                    },
                  }));
                  break;
                }

                case 'judge_complete': {
                  setState((prev) => ({
                    ...prev,
                    judge: {
                      ...prev.judge,
                      status: 'complete',
                      endTime: Date.now(),
                      duration: event.duration || null,
                    },
                    judgeFiltered: event.filteredCount || 0,
                  }));
                  break;
                }

                case 'judge_failed': {
                  setState((prev) => ({
                    ...prev,
                    judge: {
                      ...prev.judge,
                      status: 'failed',
                      error: event.error || 'unknown',
                      endTime: Date.now(),
                    },
                  }));
                  break;
                }

                case 'review_complete': {
                  setState((prev) => ({
                    ...prev,
                    score: event.score || null,
                    isComplete: true,
                    liveTokens: Math.floor(charCountRef.current / 4),
                    merger: {
                      ...prev.merger,
                      status: 'complete',
                      endTime: Date.now(),
                      duration: prev.merger.startTime ? Date.now() - prev.merger.startTime : null,
                    },
                  }));
                  break;
                }

                default: {
                  // If it's not a structured event, treat as content
                  if (event.text) {
                    accumulated += event.text;
                    setState((prev) => ({ ...prev, streamedText: accumulated }));
                  }
                }
              }
            } catch {
              // Not JSON — treat as raw text content (merger stream)
              accumulated += data + '\n';
              setState((prev) => ({ ...prev, streamedText: accumulated }));
            }
          }

          // Also process any remaining non-JSON content
          if (buffer && !buffer.startsWith('data: ')) {
            accumulated += buffer;
            setState((prev) => ({ ...prev, streamedText: accumulated }));
            buffer = '';
          }
        }

        // Process any remaining buffer
        if (buffer) {
          const trimmedBuffer = buffer.trim();
          // Handle [DONE] signal in buffer
          if (trimmedBuffer !== 'data: [DONE]' && trimmedBuffer !== '[DONE]') {
            accumulated += buffer;
            setState((prev) => ({ ...prev, streamedText: accumulated }));
          }
        }

        setState((prev) => ({
          ...prev,
          isStreaming: false,
          isComplete: true,
          liveTokens: Math.floor(charCountRef.current / 4),
        }));
      } catch (error) {
        const err = error as Error;
        if (err.name === 'AbortError') {
          setState((prev) => ({
            ...prev,
            isStreaming: false,
            wasCancelled: true,
          }));
        } else {
          console.error('Stream error:', error);
          setState((prev) => ({
            ...prev,
            isStreaming: false,
            streamedText:
              prev.streamedText +
              `\n\n■ ERROR\nAnalysis failed: ${err.message}`,
          }));
        }
      } finally {
        abortControllerRef.current = null;
        reviewHashRef.current = null;
      }
    },
    [resetState, state.isStreaming]
  );

  const cancelReview = useCallback(() => {
    abortControllerRef.current?.abort();
    reviewHashRef.current = null;
  }, []);

  return {
    state,
    startStream,
    cancelReview,
    resetState,
  };
}
