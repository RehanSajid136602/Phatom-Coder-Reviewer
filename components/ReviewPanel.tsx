// components/ReviewPanel.tsx
'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { parseReviewStream, Severity } from '@/lib/parseReview';
import { AgentStreamState } from '@/hooks/useAgentStream';
import SeverityBadge from './SeverityBadge';
import LineRefChip from './LineRefChip';
import AgentProgress from './AgentProgress';
import { Example } from '@/lib/examples';
import { Copy, Check, ChevronDown, ChevronRight, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toMarkdown, toJSON, downloadFile, copyToClipboard } from '@/lib/export';
import { ReviewResult } from '@/types/review';

interface ReviewPanelProps {
  streamedText: string;
  isStreaming: boolean;
  onLineHighlight: (lineRef: string) => void;
  onExampleClick: (example: Example) => void;
  examples: Example[];
  agentState?: AgentStreamState;
  language?: string;
}

type AgentStatus = 'pending' | 'running' | 'complete' | 'failed';

interface AgentStatusItem {
  label: string;
  status: AgentStatus;
}

function ExportButton({
  result,
  language,
}: {
  result: ReviewResult;
  language: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [clipboardState, setClipboardState] = useState<'idle' | 'copied'>('idle');

  const handleExportMarkdown = () => {
    const content = toMarkdown(result, language);
    const filename = `review-${language}-${Date.now()}.md`;
    downloadFile(content, filename, 'text/markdown');
    setIsOpen(false);
  };

  const handleExportJSON = () => {
    const content = toJSON(result, language);
    const filename = `review-${language}-${Date.now()}.json`;
    downloadFile(content, filename, 'application/json');
    setIsOpen(false);
  };

  const handleCopyClipboard = async () => {
    const content = toMarkdown(result, language);
    const success = await copyToClipboard(content);
    if (success) {
      setClipboardState('copied');
      setTimeout(() => setClipboardState('idle'), 2000);
    }
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-text-muted border border-border hover:text-accent-green hover:border-accent-green/40 transition-colors"
      >
        <Download className="w-3 h-3" />
        Export ▾
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="absolute right-0 top-full mt-1 w-40 bg-bg-surface border border-border z-20"
            >
              <button
                onClick={handleExportMarkdown}
                className="w-full text-left px-3 py-2 text-[11px] font-mono text-text-body hover:bg-bg-elevated hover:text-accent-green transition-colors"
              >
                Markdown (.md)
              </button>
              <button
                onClick={handleExportJSON}
                className="w-full text-left px-3 py-2 text-[11px] font-mono text-text-body hover:bg-bg-elevated hover:text-accent-green transition-colors border-t border-border"
              >
                JSON (.json)
              </button>
              <button
                onClick={handleCopyClipboard}
                className="w-full text-left px-3 py-2 text-[11px] font-mono text-text-body hover:bg-bg-elevated hover:text-accent-green transition-colors border-t border-border"
              >
                {clipboardState === 'copied' ? '✓ Copied' : 'Copy to clipboard'}
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
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

function IssueCountChip({
  count,
  severity,
}: {
  count: number;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
}) {
  if (count === 0) return null;

  const colors = {
    CRITICAL: {
      bg: 'rgba(255,68,68,0.10)',
      text: '#ff4444',
      border: 'rgba(255,68,68,0.3)',
    },
    WARNING: {
      bg: 'rgba(245,166,35,0.10)',
      text: '#f5a623',
      border: 'rgba(245,166,35,0.3)',
    },
    INFO: {
      bg: 'rgba(74,158,255,0.10)',
      text: '#4a9eff',
      border: 'rgba(74,158,255,0.3)',
    },
  };

  const style = colors[severity];

  return (
    <span
      className="font-mono text-[11px] px-2 py-0.5 rounded"
      style={{
        backgroundColor: style.bg,
        color: style.text,
        border: `1px solid ${style.border}`,
      }}
    >
      [{count} {severity}]
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

// ── Collapsible Issue Card with BEFORE/AFTER Diff ──

function CollapsibleIssueCard({
  issue,
  onLineHighlight,
  defaultOpen = false,
}: {
  issue: { severity: Severity; line: string; title: string; explanation: string };
  onLineHighlight: (lineRef: string) => void;
  defaultOpen?: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(defaultOpen);

  // Extract before/after from explanation if present
  const beforeAfterMatch = issue.explanation.match(
    /BEFORE[\s\S]*?```[\s\S]*?```[\s\S]*?AFTER[\s\S]*?```[\s\S]*?```/i
  );

  return (
    <div
      className={`bg-bg-card border border-border ${getIssueCardClass(issue.severity)}`}
    >
      {/* Collapsed header - always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full text-left p-3 flex items-center gap-2 hover:bg-bg-elevated/30 transition-colors"
        aria-expanded={isExpanded}
      >
        <span className="text-text-dim">
          {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        </span>
        <SeverityBadge severity={issue.severity} />
        <span className="text-[12px] font-mono text-text-primary font-medium flex-1 truncate">
          {issue.title}
        </span>
        <LineRefChip lineRef={issue.line} onHighlight={onLineHighlight} />
      </button>

      {/* Expanded content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1 border-t border-border">
              <p className="text-[13px] font-mono text-text-body leading-relaxed mb-4">
                {renderTextWithLineRefs(issue.explanation, onLineHighlight)}
              </p>

              {/* BEFORE/AFTER Diff if available */}
              {beforeAfterMatch && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-border mt-4">
                  <div
                    className="p-3 font-mono text-[12px]"
                    style={{
                      backgroundColor: 'rgba(255,68,68,0.06)',
                      borderLeft: '2px solid #ff4444',
                    }}
                  >
                    <div className="text-[10px] uppercase tracking-wider text-accent-red mb-2">
                      BEFORE
                    </div>
                    <pre className="text-text-primary whitespace-pre-wrap">
                      {/* Extract before code */}
                      {issue.explanation.match(/BEFORE[\s\S]*?```(\w+)?\s*\n?([\s\S]*?)```/i)?.[2]?.trim() || ''}
                    </pre>
                  </div>
                  <div
                    className="p-3 font-mono text-[12px]"
                    style={{
                      backgroundColor: 'rgba(0,255,136,0.06)',
                      borderLeft: '2px solid #00ff88',
                    }}
                  >
                    <div className="text-[10px] uppercase tracking-wider text-accent-green mb-2">
                      AFTER
                    </div>
                    <pre className="text-text-primary whitespace-pre-wrap">
                      {/* Extract after code */}
                      {issue.explanation.match(/AFTER[\s\S]*?```(\w+)?\s*\n?([\s\S]*?)```/i)?.[2]?.trim() || ''}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
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
  language = 'unknown',
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

  // Build result object for export
  const result: ReviewResult = {
    summary: parsed.summary,
    issues: parsed.issues.map((i) => ({
      severity: i.severity,
      line: i.line,
      title: i.title,
      description: i.explanation,
    })),
    suggestions: parsed.suggestions,
    verdict: parsed.finalVerdict,
    riskScore: parsed.score,
    score: parsed.score,
  };

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
        {/* VERDICT CARD — Top placement with chips */}
        {parsed.hasVerdict && (
          <motion.section
            className="animate-fade-in"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {/* Top row: verdict label + risk score */}
            <div className="flex items-center gap-3 mb-2">
              <h3 className="section-header text-[12px] font-mono uppercase tracking-[0.2em] text-accent-green flex items-center gap-2">
                <span>■</span> VERDICT
              </h3>
              <VerdictScore score={parsed.score} hasVerdict={parsed.hasVerdict} />
            </div>

            <p className="text-[15px] font-serif font-bold text-text-primary leading-relaxed mb-4">
              {renderTextWithLineRefs(parsed.finalVerdict, onLineHighlight)}
            </p>

            {/* Bottom row: issue count chips */}
            <div className="flex items-center gap-2 flex-wrap">
              <IssueCountChip count={criticalCount} severity="CRITICAL" />
              <IssueCountChip count={warningCount} severity="WARNING" />
              <IssueCountChip count={infoCount} severity="INFO" />
            </div>
          </motion.section>
        )}

        {/* SUMMARY Section */}
        {parsed.hasSummary && (
          <section className="animate-fade-in">
            <div className="flex items-center justify-between mb-3">
              <h3 className="section-header text-[12px] font-mono uppercase tracking-[0.2em] text-accent-green flex items-center gap-2">
                <span>■</span> SUMMARY
              </h3>
              <ExportButton result={result} language={language} />
            </div>
            <p className="text-[15px] font-serif font-bold text-text-primary leading-relaxed">
              {renderTextWithLineRefs(parsed.summary, onLineHighlight)}
            </p>
          </section>
        )}

        {/* ISSUES Section — With collapsible cards */}
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
              <div className="space-y-2">
                <div className="text-[11px] font-mono uppercase tracking-wider text-accent-red flex items-center gap-2 mb-2">
                  <span>■</span> CRITICAL <span className="text-text-dim">({criticalCount} issues)</span>
                </div>
                {parsed.issues.filter((i) => i.severity === 'CRITICAL').map((issue, idx) => (
                  <CollapsibleIssueCard
                    key={`critical-${idx}`}
                    issue={issue}
                    onLineHighlight={onLineHighlight}
                    defaultOpen={true}
                  />
                ))}
              </div>
            )}

            {/* Warning issues */}
            {warningCount > 0 && (
              <div className="space-y-2">
                <div className="text-[11px] font-mono uppercase tracking-wider text-accent-yellow flex items-center gap-2 mb-2">
                  <span>■</span> WARNING <span className="text-text-dim">({warningCount} issues)</span>
                </div>
                {parsed.issues.filter((i) => i.severity === 'WARNING').map((issue, idx) => (
                  <CollapsibleIssueCard
                    key={`warning-${idx}`}
                    issue={issue}
                    onLineHighlight={onLineHighlight}
                    defaultOpen={false}
                  />
                ))}
              </div>
            )}

            {/* Info issues */}
            {infoCount > 0 && (
              <div className="space-y-2">
                <div className="text-[11px] font-mono uppercase tracking-wider text-accent-blue flex items-center gap-2 mb-2">
                  <span>■</span> INFO <span className="text-text-dim">({infoCount} issues)</span>
                </div>
                {parsed.issues.filter((i) => i.severity === 'INFO').map((issue, idx) => (
                  <CollapsibleIssueCard
                    key={`info-${idx}`}
                    issue={issue}
                    onLineHighlight={onLineHighlight}
                    defaultOpen={false}
                  />
                ))}
              </div>
            )}

            {/* Praise issues */}
            {praiseCount > 0 && (
              <div className="space-y-2">
                <div className="text-[11px] font-mono uppercase tracking-wider text-accent-green-dim flex items-center gap-2 mb-2">
                  <span>■</span> PRAISE <span className="text-text-dim">({praiseCount} items)</span>
                </div>
                {parsed.issues.filter((i) => i.severity === 'PRAISE').map((issue, idx) => (
                  <CollapsibleIssueCard
                    key={`praise-${idx}`}
                    issue={issue}
                    onLineHighlight={onLineHighlight}
                    defaultOpen={false}
                  />
                ))}
              </div>
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

        {/* Streaming cursor */}
        {isStreaming && (
          <span className="inline-block w-2 h-4 bg-accent-green animate-blink" />
        )}
      </div>
    </div>
  );
}
