// components/CodePanel.tsx
'use client';

import { useRef, useEffect, useCallback } from 'react';
import { Language, getLanguageLabel } from '@/lib/detectLanguage';
import { ChevronDown } from 'lucide-react';

const LANGUAGES: Language[] = [
  'python',
  'javascript',
  'typescript',
  'rust',
  'go',
  'cpp',
  'sql',
  'bash',
  'other',
];

export interface CodeAnnotation {
  line: number;
  severity: 'CRITICAL' | 'WARNING' | 'INFO' | 'PRAISE';
  title: string;
}

interface CodePanelProps {
  code: string;
  language: Language;
  highlightedLines: Set<number>;
  onCodeChange: (code: string) => void;
  onLanguageChange: (lang: Language) => void;
  annotations?: CodeAnnotation[];
  onAnnotationClick?: (annotation: CodeAnnotation) => void;
}

const SEVERITY_COLORS: Record<CodeAnnotation['severity'], string> = {
  CRITICAL: 'bg-accent-red',
  WARNING: 'bg-accent-yellow',
  INFO: 'bg-accent-blue',
  PRAISE: 'bg-accent-green-dim',
};

export default function CodePanel({
  code,
  language,
  highlightedLines,
  onCodeChange,
  onLanguageChange,
  annotations = [],
  onAnnotationClick,
}: CodePanelProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const lines = code.split('\n');
  const lineCount = lines.length;
  const charCount = code.length;

  // Build a map of line -> annotations for quick lookup
  const annotationsByLine = useRef<Map<number, CodeAnnotation[]>>(new Map());
  annotationsByLine.current.clear();
  for (const annotation of annotations) {
    const existing = annotationsByLine.current.get(annotation.line) || [];
    existing.push(annotation);
    annotationsByLine.current.set(annotation.line, existing);
  }

  const handleScroll = useCallback(() => {
    if (textareaRef.current && lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  }, []);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.addEventListener('scroll', handleScroll);
      return () => textarea.removeEventListener('scroll', handleScroll);
    }
  }, [handleScroll]);

  // Scroll to highlighted line
  useEffect(() => {
    if (highlightedLines.size > 0 && containerRef.current) {
      const firstLine = Math.min(...highlightedLines);
      const lineHeight = 24;
      const scrollTop = (firstLine - 1) * lineHeight;
      textareaRef.current?.scrollTo({ top: scrollTop, behavior: 'smooth' });
    }
  }, [highlightedLines]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = e.currentTarget;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newCode = code.substring(0, start) + '  ' + code.substring(end);
      onCodeChange(newCode);
      requestAnimationFrame(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2;
      });
    }
  };

  return (
    <div className="flex flex-col h-full bg-bg-void border-r border-border">
      {/* Panel Header */}
      <div className="flex items-center justify-between px-4 h-10 border-b border-border shrink-0">
        <span className="text-[11px] font-mono uppercase tracking-widest text-text-muted">
          CODE INPUT
        </span>
        <div className="relative">
          <select
            value={language}
            onChange={(e) => onLanguageChange(e.target.value as Language)}
            className="appearance-none bg-bg-elevated border border-border text-[11px] font-mono uppercase tracking-wider text-text-primary px-2 py-1 pr-6 cursor-pointer focus:outline-none focus:border-accent-green transition-colors"
          >
            {LANGUAGES.map((lang) => (
              <option key={lang} value={lang}>
                {getLanguageLabel(lang)}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-text-muted pointer-events-none" />
        </div>
      </div>

      {/* Editor Area */}
      <div ref={containerRef} className="flex-1 relative overflow-hidden">
        {/* Line Numbers */}
        <div
          ref={lineNumbersRef}
          className="absolute left-0 top-0 bottom-0 w-12 bg-bg-surface border-r border-border overflow-hidden select-none"
          aria-hidden="true"
        >
          <div className="py-3">
            {Array.from({ length: lineCount }, (_, i) => {
              const lineNum = i + 1;
              const isHighlighted = highlightedLines.has(lineNum);
              const lineAnnotations = annotationsByLine.current.get(lineNum) || [];
              const hasCritical = lineAnnotations.some((a) => a.severity === 'CRITICAL');
              const hasWarning = lineAnnotations.some((a) => a.severity === 'WARNING');

              return (
                <div
                  key={lineNum}
                  className={`h-6 flex items-center justify-end pr-3 text-[11px] font-mono transition-colors duration-150 relative ${
                    isHighlighted
                      ? 'text-accent-green bg-bg-elevated'
                      : hasCritical
                        ? 'text-accent-red/80'
                        : hasWarning
                          ? 'text-accent-yellow/80'
                          : 'text-text-dim'
                  }`}
                >
                  {lineNum}
                  {/* Annotation indicator dot */}
                  {lineAnnotations.length > 0 && (
                    <div className="absolute left-1 gutter-dot-wrap" data-tip={lineAnnotations.map((a) => `${a.severity}: ${a.title}`).join('\n')}>
                      <button
                        onClick={() => {
                          const highestSeverity = lineAnnotations.reduce((highest, a) => {
                            const order = { CRITICAL: 0, WARNING: 1, INFO: 2, PRAISE: 3 };
                            return order[a.severity] < order[highest.severity] ? a : highest;
                          }, lineAnnotations[0]);
                          onAnnotationClick?.(highestSeverity);
                        }}
                        className={`block w-1.5 h-1.5 rounded-full gutter-dot ${SEVERITY_COLORS[lineAnnotations.reduce((highest, a) => {
                          const order = { CRITICAL: 0, WARNING: 1, INFO: 2, PRAISE: 3 };
                          return order[a.severity] < order[highest.severity] ? a : highest;
                        }, lineAnnotations[0]).severity]} hover:scale-150 transition-transform cursor-pointer`}
                        aria-label={`${lineAnnotations.length} issue${lineAnnotations.length > 1 ? 's' : ''} on line ${lineNum}`}
                      />
                      {lineAnnotations.length > 1 && (
                        <span className="absolute -top-1 -right-1 text-[8px] font-mono text-text-dim">
                          +{lineAnnotations.length - 1}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={code}
          onChange={(e) => onCodeChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onScroll={handleScroll}
          spellCheck={false}
          placeholder="Paste or type your code here..."
          className="absolute inset-0 w-full h-full pl-14 pr-4 py-3 bg-transparent text-text-primary text-[13px] font-mono leading-6 resize-none focus:outline-none focus:ring-0 placeholder:text-text-dim custom-textarea"
          style={{ caretColor: 'var(--accent-green)' }}
        />

        {/* Highlighted line overlays */}
        {highlightedLines.size > 0 && (
          <div
            className="absolute left-12 right-0 top-0 pointer-events-none overflow-hidden"
            style={{ paddingTop: '12px' }}
          >
            {Array.from(highlightedLines).map((lineNum) => (
              <div
                key={lineNum}
                className="h-6 bg-bg-elevated border-l-2 border-accent-green transition-colors duration-150"
                style={{ transform: `translateY(${(lineNum - 1) * 24}px)` }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 h-8 border-t border-border shrink-0">
        <span className="text-[10px] font-mono text-text-dim">
          {charCount} chars · {lineCount} lines
        </span>
        <span className="text-[10px] font-mono text-text-dim">
          ⌘V to paste
        </span>
      </div>
    </div>
  );
}
