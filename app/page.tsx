// app/page.tsx
'use client';

import { useState, useCallback, useMemo } from 'react';
import { Language, detectLanguage } from '@/lib/detectLanguage';
import { examples } from '@/lib/examples';
import { useAgentStream } from '@/hooks/useAgentStream';
import CodePanel, { CodeAnnotation } from '@/components/CodePanel';
import ReviewPanel from '@/components/ReviewPanel';
import StatusBar from '@/components/StatusBar';
import { Zap } from 'lucide-react';

export default function Home() {
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState<Language>('other');
  const [highlightedLines, setHighlightedLines] = useState<Set<number>>(new Set());

  const { state: agentState, startStream, abortStream } = useAgentStream();

  const handleCodeChange = useCallback((newCode: string) => {
    setCode(newCode);
    const detected = detectLanguage(newCode);
    if (detected !== 'other') {
      setLanguage(detected);
    }
  }, []);

  const handleLanguageChange = useCallback((lang: Language) => {
    setLanguage(lang);
  }, []);

  const handleExampleClick = useCallback(
    (example: (typeof examples)[0]) => {
      setCode(example.code);
      setLanguage(example.language);
      setHighlightedLines(new Set());
    },
    []
  );

  const handleLineHighlight = useCallback((lineRef: string) => {
    const parts = lineRef.split('–');
    const start = parseInt(parts[0], 10);
    const end = parts.length > 1 ? parseInt(parts[1], 10) : start;
    const lines = new Set<number>();
    for (let i = start; i <= end; i++) {
      lines.add(i);
    }
    setHighlightedLines(lines);

    // Clear highlight after 3 seconds
    setTimeout(() => {
      setHighlightedLines(new Set());
    }, 3000);
  }, []);

  const handleAnnotationClick = useCallback((annotation: CodeAnnotation) => {
    const lines = new Set<number>();
    lines.add(annotation.line);
    setHighlightedLines(lines);

    setTimeout(() => {
      setHighlightedLines(new Set());
    }, 3000);
  }, []);

  const handleAnalyze = useCallback(async () => {
    if (!code.trim() || agentState.isStreaming) return;
    setHighlightedLines(new Set());
    await startStream(code, language);
  }, [code, language, agentState.isStreaming, startStream]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        handleAnalyze();
      }
    },
    [handleAnalyze]
  );

  // Parse annotations from streamed text for inline code markers
  const annotations = useMemo((): CodeAnnotation[] => {
    if (!agentState.streamedText) return [];

    const annotations: CodeAnnotation[] = [];
    const issuePattern = /\[(CRITICAL|WARNING|INFO|PRAISE)\]\s*L(\d+(?:–\d+)?)\s*[—-]\s*([^\n]+)/gi;
    let match;

    while ((match = issuePattern.exec(agentState.streamedText)) !== null) {
      const severity = match[1] as CodeAnnotation['severity'];
      const lineStr = match[2];
      const title = match[3].trim();

      // Parse line number (take first if range)
      const lineNum = parseInt(lineStr.split('–')[0], 10);
      if (!isNaN(lineNum) && lineNum > 0) {
        annotations.push({ line: lineNum, severity, title });
      }
    }

    return annotations;
  }, [agentState.streamedText]);

  // Calculate token count from streamed text
  const tokens = agentState.streamedText
    ? agentState.streamedText.split(/\s+/).length
    : null;

  return (
    <div
      className="h-screen flex flex-col bg-bg-void overflow-hidden"
      onKeyDown={handleKeyDown}
    >
      {/* Header Bar */}
      <header className="flex items-center justify-between px-4 h-12 bg-bg-surface border-b border-border shrink-0 animate-slide-down">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-accent-green" />
          <h1 className="text-[13px] font-mono uppercase tracking-[0.2em] text-text-primary">
            PHANTOM
          </h1>
        </div>
        <button
          onClick={handleAnalyze}
          disabled={!code.trim() || agentState.isStreaming}
          className={`
            flex items-center gap-2 px-4 py-1.5 text-[11px] font-mono uppercase tracking-wider
            border transition-all duration-200
            ${
              agentState.isStreaming
                ? 'border-accent-green/30 text-accent-green bg-accent-green/10 cursor-not-allowed'
                : code.trim()
                ? 'border-accent-green text-accent-green hover:bg-accent-green hover:text-black cursor-pointer'
                : 'border-border text-text-dim cursor-not-allowed'
            }
          `}
        >
          {agentState.isStreaming ? (
            <>
              <span className="animate-blink">▋</span>
              ANALYZING...
            </>
          ) : (
            <>
              ANALYZE
              <span className="text-text-dim">→</span>
            </>
          )}
        </button>
      </header>

      {/* Main Split Layout */}
      <main className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Code Input Panel */}
        <div className="h-1/2 md:h-full md:w-1/2 overflow-hidden animate-fade-in" style={{ animationDelay: '80ms' }}>
          <CodePanel
            code={code}
            language={language}
            highlightedLines={highlightedLines}
            onCodeChange={handleCodeChange}
            onLanguageChange={handleLanguageChange}
            annotations={annotations}
            onAnnotationClick={handleAnnotationClick}
          />
        </div>

        {/* Review Output Panel */}
        <div
          className={`h-1/2 md:h-full md:w-1/2 overflow-hidden animate-fade-in ${
            agentState.isStreaming ? 'border-accent-green/30' : ''
          }`}
          style={{ animationDelay: '160ms' }}
        >
          <ReviewPanel
            streamedText={agentState.streamedText}
            isStreaming={agentState.isStreaming}
            onLineHighlight={handleLineHighlight}
            onExampleClick={handleExampleClick}
            examples={examples}
            agentState={agentState}
          />
        </div>
      </main>

      {/* Status Bar */}
      <StatusBar
        model="multi-agent"
        tokens={tokens}
        latency={null}
        isStreaming={agentState.isStreaming}
      />
    </div>
  );
}
