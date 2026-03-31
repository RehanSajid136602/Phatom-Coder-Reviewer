// app/page.tsx
'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { Language, detectLanguage } from '@/lib/detectLanguage';
import { examples } from '@/lib/examples';
import { useAgentStream } from '@/hooks/useAgentStream';
import CodePanel, { CodeAnnotation } from '@/components/CodePanel';
import ReviewPanel from '@/components/ReviewPanel';
import StatusBar from '@/components/StatusBar';
import ShortcutsModal from '@/components/ShortcutsModal';
import { Zap } from 'lucide-react';

export default function Home() {
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState<Language>('other');
  const [highlightedLines, setHighlightedLines] = useState<Set<number>>(new Set());
  const [activeTab, setActiveTab] = useState<'code' | 'review'>('code');
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);

  const { state: agentState, startStream, cancelReview } = useAgentStream();

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
      setActiveTab('code');
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
    setActiveTab('code');

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
    setActiveTab('review');
    await startStream(code, language);
  }, [code, language, agentState.isStreaming, startStream]);

  const clearCode = useCallback(() => {
    setCode('');
    setHighlightedLines(new Set());
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Guard: don't fire shortcuts when typing in textarea/input
      const tag = (e.target as HTMLElement).tagName.toLowerCase();
      if (tag === 'textarea' || tag === 'input') return;

      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        handleAnalyze();
      }
      if (e.ctrlKey && e.key === 'l') {
        e.preventDefault();
        clearCode();
      }
      if (e.ctrlKey && e.key === '/') {
        e.preventDefault();
        setShowShortcutsModal((prev) => !prev);
      }
      if (e.key === '?') {
        e.preventDefault();
        setShowShortcutsModal((prev) => !prev);
      }
      if (e.key === 'Escape') {
        setShowShortcutsModal(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleAnalyze, clearCode]);

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
    >
      {/* Header Bar */}
      <header className="flex items-center justify-between px-4 h-12 bg-bg-surface border-b border-border shrink-0 animate-slide-down">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-accent-green" />
          <h1 className="text-[13px] font-mono uppercase tracking-[0.2em] text-text-primary">
            PHANTOM
          </h1>
        </div>

        {/* Mobile Tab Switcher (visible only on < 768px) */}
        <div className="flex md:hidden items-center gap-1">
          <button
            onClick={() => setActiveTab('code')}
            className={`px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider border transition-colors min-h-[44px] ${
              activeTab === 'code'
                ? 'border-accent-green text-accent-green bg-accent-green/10'
                : 'border-border text-text-dim'
            }`}
          >
            ← Code
          </button>
          <button
            onClick={() => setActiveTab('review')}
            className={`px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider border transition-colors min-h-[44px] ${
              activeTab === 'review'
                ? 'border-accent-green text-accent-green bg-accent-green/10'
                : 'border-border text-text-dim'
            }`}
          >
            Review →
          </button>
        </div>

        {/* Analyze Button (desktop) */}
        <button
          onClick={handleAnalyze}
          disabled={!code.trim() || agentState.isStreaming}
          className={`
            hidden md:flex items-center gap-2 px-4 py-1.5 text-[11px] font-mono uppercase tracking-wider
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

        {/* Analyze Button (mobile - full width) */}
        <button
          onClick={handleAnalyze}
          disabled={!code.trim() || agentState.isStreaming}
          className={`
            md:hidden flex-1 mx-4 flex items-center justify-center gap-2 py-1.5 text-[11px] font-mono uppercase tracking-wider
            border transition-all duration-200 min-h-[44px]
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
      <main className="flex-1 flex flex-col md:flex-row overflow-hidden split-layout">
        {/* Code Input Panel */}
        <div
          className={`h-1/2 md:h-full md:w-1/2 overflow-hidden animate-fade-in code-panel ${
            activeTab === 'code' ? 'block' : 'hidden md:block'
          }`}
          style={{ animationDelay: '80ms' }}
        >
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
          className={`h-1/2 md:h-full md:w-1/2 overflow-hidden animate-fade-in review-panel ${
            activeTab === 'review' ? 'block' : 'hidden md:block'
          } ${agentState.isStreaming ? 'border-accent-green/30' : ''}`}
          style={{ animationDelay: '160ms' }}
        >
          <ReviewPanel
            streamedText={agentState.streamedText}
            isStreaming={agentState.isStreaming}
            onLineHighlight={handleLineHighlight}
            onExampleClick={handleExampleClick}
            examples={examples}
            agentState={agentState}
            language={language}
            onCancel={cancelReview}
          />
        </div>
      </main>

      {/* Status Bar */}
      <StatusBar
        model="multi-agent"
        tokens={tokens}
        latency={null}
        isStreaming={agentState.isStreaming}
        cacheHit={agentState.cacheHit}
        usedFallback={agentState.usedFallback}
        fallbackModel={agentState.fallbackModel}
        liveTokens={agentState.liveTokens}
      />

      {/* Shortcuts Modal */}
      <ShortcutsModal
        isOpen={showShortcutsModal}
        onClose={() => setShowShortcutsModal(false)}
      />
    </div>
  );
}
