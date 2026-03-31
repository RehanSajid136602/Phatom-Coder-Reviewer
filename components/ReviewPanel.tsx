// components/ReviewPanel.tsx
'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { parseReviewStream, Severity } from '@/lib/parseReview';
import { AgentStreamState } from '@/hooks/useAgentStream';
import SeverityBadge from './SeverityBadge';
import LineRefChip from './LineRefChip';
import AgentProgress from './AgentProgress';
import { Example } from '@/lib/examples';
import { Copy, Check, ChevronDown, ChevronRight } from 'lucide-react';

interface ReviewPanelProps {
  streamedText: string;
  isStreaming: boolean;
  onLineHighlight: (lineRef: string) => void;
  onExampleClick: (example: Example) => void;
  examples: Example[];
  agentState?: AgentStreamState;
}

type AgentStatus = 'pending' | 'running' | 'complete' | 'failed';

interface AgentStatusItem {
  label: string;
  status: AgentStatus;
}

function CopyButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = code;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [code]);

  return (
    <button
      onClick={handleCopy}
      className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-text-muted bg-bg-surface border border-border hover:text-accent-green hover:border-accent-green/40 transition-colors"
      title="Copy code"
    >
      {copied ? (
        <>
          <Check className="w-3 h-3" />
          COPIED
        </>
      ) : (
        <>
          <Copy className="w-3 h-3" />
          COPY
        </>
      )}
    </button>
  );
}

function renderTextWithCodeBlocks(
  text: string,
  onLineHighlight: (lineRef: string) => void
): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const codeBlockRegex = /```(\w*)\s*\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;
  let blockIndex = 0;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      const textContent = text.slice(lastIndex, match.index).trim();
      if (textContent) {
        parts.push(
          <div key={`text-${lastIndex}`} className="text-[14px] font-mono text-text-body leading-relaxed whitespace-pre-wrap mb-3">
            {renderTextWithLineRefs(textContent, onLineHighlight)}
          </div>
        );
      }
    }

    const lang = match[1] || '';
    const code = match[2].trim();

    if (code) {
      parts.push(
        <div key={`code-${blockIndex}`} className="relative my-3 group">
          <div className="code-block border border-border overflow-hidden">
            {lang && (
              <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-bg-elevated/50">
                <span className="text-[10px] font-mono uppercase tracking-wider text-text-dim">
                  {lang}
                </span>
              </div>
            )}
            <div className="relative">
              <CopyButton code={code} />
              <pre className="p-3 pr-20 overflow-x-auto text-[13px] font-mono leading-relaxed text-text-primary">
                <code>{code}</code>
              </pre>
            </div>
          </div>
        </div>
      );
    }

    lastIndex = codeBlockRegex.lastIndex;
    blockIndex++;
  }

  if (lastIndex < text.length) {
    const textContent = text.slice(lastIndex).trim();
    if (textContent) {
      parts.push(
        <div key={`text-${lastIndex}`} className="text-[14px] font-mono text-text-body leading-relaxed whitespace-pre-wrap">
          {renderTextWithLineRefs(textContent, onLineHighlight)}
        </div>
      );
    }
  }

  if (parts.length === 0) {
    return [
      <div key="raw" className="text-[14px] font-mono text-text-body leading-relaxed whitespace-pre-wrap">
        {renderTextWithLineRefs(text, onLineHighlight)}
      </div>
    ];
  }

  return parts;
}

function renderTextWithLineRefs(
  text: string,
  onLineHighlight: (lineRef: string) => void
): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /L(\d+(?:–\d+)?)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    parts.push(
      <LineRefChip
        key={`ref-${match.index}`}
        lineRef={match[1]}
        onHighlight={onLineHighlight}
      />
    );
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

function VerdictScore({ score, hasVerdict }: { score: number; hasVerdict: boolean }) {
  const [displayScore, setDisplayScore] = useState(0);

  useEffect(() => {
    if (!hasVerdict || score === 0) return;

    const duration = 600;
    const steps = 30;
    const increment = score / steps;
    let current = 0;
    let step = 0;

    const timer = setInterval(() => {
      step++;
      current = Math.min(Math.round(increment * step), score);
      setDisplayScore(current);
      if (step >= steps) {
        clearInterval(timer);
        setDisplayScore(score);
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [score, hasVerdict]);

  if (!hasVerdict) return null;

  return (
    <span className="inline-flex items-center justify-center w-12 h-12 text-2xl font-mono font-bold text-accent-green border border-accent-green/30 bg-accent-green/10">
      {displayScore}
    </span>
  );
}

function getIssueCardClass(severity: Severity): string {
  switch (severity) {
    case 'CRITICAL': return 'issue-card-critical';
    case 'WARNING': return 'issue-card-warning';
    case 'INFO': return 'issue-card-info';
    case 'PRAISE': return 'issue-card-praise';
    default: return '';
  }
}

// ── Collapsible Section Component (Progressive Disclosure) ──

function CollapsibleSection({
  title,
  icon,
  defaultOpen = false,
  count,
  children,
}: {
  title: string;
  icon: string;
  defaultOpen?: boolean;
  count?: number;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <section className="animate-fade-in">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="section-header w-full text-left text-[12px] font-mono uppercase tracking-[0.2em] text-accent-green mb-3 flex items-center gap-2 cursor-pointer hover:text-accent-green/80 transition-colors"
        aria-expanded={isOpen}
      >
        <span>{isOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}</span>
        <span>{icon}</span>
        <span>{title}</span>
        {count !== undefined && count > 0 && (
          <span className="ml-auto text-[10px] font-mono text-text-dim">
            {count} item{count !== 1 ? 's' : ''}
          </span>
        )}
      </button>
      {isOpen && <div className="space-y-3">{children}</div>}
    </section>
  );
}

export default function ReviewPanel({
  streamedText,
  isStreaming,
  onLineHighlight,
  onExampleClick,
  examples,
  agentState,
}: ReviewPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [hasStarted, setHasStarted] = useState(false);

  // Auto-scroll to bottom as content streams in
  useEffect(() => {
    if (scrollRef.current && isStreaming) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [streamedText, isStreaming]);

  // Track when streaming starts
  useEffect(() => {
    if (isStreaming && !hasStarted) {
      setHasStarted(true);
    }
  }, [isStreaming, hasStarted]);

  // Track when content arrives
  useEffect(() => {
    if (streamedText.length > 0) {
      setHasStarted(true);
    }
  }, [streamedText]);

  const parsed = parseReviewStream(streamedText);

  // Count issues by severity for progressive disclosure
  const criticalCount = parsed.issues.filter((i) => i.severity === 'CRITICAL').length;
  const warningCount = parsed.issues.filter((i) => i.severity === 'WARNING').length;
  const infoCount = parsed.issues.filter((i) => i.severity === 'INFO').length;
  const praiseCount = parsed.issues.filter((i) => i.severity === 'PRAISE').length;

  if (!hasStarted && !isStreaming) {
    return (
      <div className="flex flex-col h-full bg-bg-surface review-glow">
        <div className="flex items-center px-4 h-10 border-b border-border shrink-0">
          <span className="text-[11px] font-mono uppercase tracking-widest text-text-muted">
            REVIEW OUTPUT
          </span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-8">
          <span className="text-2xl font-mono uppercase tracking-[0.3em] text-text-dim select-none">
            AWAITING INPUT
          </span>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {examples.map((example) => (
              <button
                key={example.name}
                onClick={() => onExampleClick(example)}
                className="px-3 py-1.5 text-[11px] font-mono uppercase tracking-wider text-text-muted border border-border hover:text-accent-green hover:border-accent-green/40 transition-colors"
              >
                try: {example.name}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-bg-surface review-glow">
      {/* Panel Header */}
      <div className="flex items-center px-4 h-10 border-b border-border shrink-0">
        <span className="text-[11px] font-mono uppercase tracking-widest text-text-muted">
          REVIEW OUTPUT
        </span>
      </div>

      {/* Agent Progress Panel */}
      {agentState && <AgentProgress state={agentState} />}

      {/* Content */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-6">
        {/* SUMMARY Section — always visible when present */}
        {parsed.hasSummary && (
          <section className="animate-fade-in">
            <h3 className="section-header text-[12px] font-mono uppercase tracking-[0.2em] text-accent-green mb-3 flex items-center gap-2">
              <span>■</span> SUMMARY
            </h3>
            <p className="text-[15px] font-serif font-bold text-text-primary leading-relaxed">
              {renderTextWithLineRefs(parsed.summary, onLineHighlight)}
            </p>
          </section>
        )}

        {/* ISSUES Section — Progressive Disclosure */}
        {parsed.hasIssues && (
          <CollapsibleSection
            title="ISSUES"
            icon="■"
            defaultOpen={true}
            count={parsed.issues.length}
          >
            {parsed.issues.length === 0 && streamedText.includes('No critical issues') && (
              <p className="text-[14px] font-mono text-text-body">
                No critical issues detected.
              </p>
            )}

            {/* Critical issues — always expanded */}
            {criticalCount > 0 && (
              <div className="space-y-3">
                {parsed.issues.filter((i) => i.severity === 'CRITICAL').map((issue, idx) => (
                  <div
                    key={`critical-${idx}`}
                    className={`bg-bg-card border border-border p-4 ${getIssueCardClass(issue.severity)}`}
                    style={{ animationDelay: `${idx * 20}ms` }}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <SeverityBadge severity={issue.severity} />
                      <LineRefChip lineRef={issue.line} onHighlight={onLineHighlight} />
                      <span className="text-[13px] font-mono text-text-primary font-medium">
                        {issue.title}
                      </span>
                    </div>
                    <p className="text-[13px] font-mono text-text-body leading-relaxed pl-1">
                      {renderTextWithLineRefs(issue.explanation, onLineHighlight)}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Warning issues — collapsible */}
            {warningCount > 0 && (
              <CollapsibleSection
                title="Warnings"
                icon="⚠"
                defaultOpen={criticalCount === 0}
                count={warningCount}
              >
                <div className="space-y-3">
                  {parsed.issues.filter((i) => i.severity === 'WARNING').map((issue, idx) => (
                    <div
                      key={`warning-${idx}`}
                      className={`bg-bg-card border border-border p-4 ${getIssueCardClass(issue.severity)}`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <SeverityBadge severity={issue.severity} />
                        <LineRefChip lineRef={issue.line} onHighlight={onLineHighlight} />
                        <span className="text-[13px] font-mono text-text-primary font-medium">
                          {issue.title}
                        </span>
                      </div>
                      <p className="text-[13px] font-mono text-text-body leading-relaxed pl-1">
                        {renderTextWithLineRefs(issue.explanation, onLineHighlight)}
                      </p>
                    </div>
                  ))}
                </div>
              </CollapsibleSection>
            )}

            {/* Info issues — collapsed by default */}
            {infoCount > 0 && (
              <CollapsibleSection
                title="Info"
                icon="ℹ"
                defaultOpen={false}
                count={infoCount}
              >
                <div className="space-y-3">
                  {parsed.issues.filter((i) => i.severity === 'INFO').map((issue, idx) => (
                    <div
                      key={`info-${idx}`}
                      className={`bg-bg-card border border-border p-4 ${getIssueCardClass(issue.severity)}`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <SeverityBadge severity={issue.severity} />
                        <LineRefChip lineRef={issue.line} onHighlight={onLineHighlight} />
                        <span className="text-[13px] font-mono text-text-primary font-medium">
                          {issue.title}
                        </span>
                      </div>
                      <p className="text-[13px] font-mono text-text-body leading-relaxed pl-1">
                        {renderTextWithLineRefs(issue.explanation, onLineHighlight)}
                      </p>
                    </div>
                  ))}
                </div>
              </CollapsibleSection>
            )}

            {/* Praise issues — collapsed by default */}
            {praiseCount > 0 && (
              <CollapsibleSection
                title="Praise"
                icon="★"
                defaultOpen={false}
                count={praiseCount}
              >
                <div className="space-y-3">
                  {parsed.issues.filter((i) => i.severity === 'PRAISE').map((issue, idx) => (
                    <div
                      key={`praise-${idx}`}
                      className={`bg-bg-card border border-border p-4 ${getIssueCardClass(issue.severity)}`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <SeverityBadge severity={issue.severity} />
                        <LineRefChip lineRef={issue.line} onHighlight={onLineHighlight} />
                        <span className="text-[13px] font-mono text-text-primary font-medium">
                          {issue.title}
                        </span>
                      </div>
                      <p className="text-[13px] font-mono text-text-body leading-relaxed pl-1">
                        {renderTextWithLineRefs(issue.explanation, onLineHighlight)}
                      </p>
                    </div>
                  ))}
                </div>
              </CollapsibleSection>
            )}
          </CollapsibleSection>
        )}

        {/* SUGGESTIONS Section */}
        {parsed.hasSuggestions && (
          <CollapsibleSection
            title="SUGGESTIONS"
            icon="◆"
            defaultOpen={parsed.issues.length > 0}
          >
            <div className="text-[14px] font-mono text-text-primary leading-relaxed">
              {renderTextWithCodeBlocks(parsed.suggestions, onLineHighlight)}
            </div>
          </CollapsibleSection>
        )}

        {/* VERDICT Section */}
        {parsed.hasVerdict && (
          <section className="animate-fade-in border-t border-border pt-5">
            <h3 className="section-header text-[12px] font-mono uppercase tracking-[0.2em] text-accent-green mb-3 flex items-center gap-2">
              <span>■</span> VERDICT
            </h3>
            <div className="flex items-start gap-4">
              <VerdictScore score={parsed.score} hasVerdict={parsed.hasVerdict} />
              <p className="text-[15px] font-serif font-bold text-text-primary leading-relaxed flex-1">
                {renderTextWithLineRefs(parsed.finalVerdict, onLineHighlight)}
              </p>
            </div>
          </section>
        )}

        {/* Streaming cursor */}
        {isStreaming && (
          <span className="inline-block w-2 h-4 bg-accent-green animate-blink" />
        )}
      </div>
    </div>
  );
}
