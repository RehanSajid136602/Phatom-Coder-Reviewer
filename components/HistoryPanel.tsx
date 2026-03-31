// components/HistoryPanel.tsx
'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { HistoryEntry } from '@/types/review';
import { getHistory, clearHistory, formatRelativeTime } from '@/lib/history';
import { X, Trash2 } from 'lucide-react';
import { useState, useEffect } from 'react';

interface HistoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onRestore: (entry: HistoryEntry) => void;
}

const VERDICT_COLORS: Record<string, { bg: string; text: string; border: string }> = {
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
  SAFE: {
    bg: 'rgba(0,255,136,0.10)',
    text: '#00ff88',
    border: 'rgba(0,255,136,0.3)',
  },
};

export default function HistoryPanel({ isOpen, onClose, onRestore }: HistoryPanelProps) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    if (isOpen) {
      setHistory(getHistory());
    }
  }, [isOpen]);

  const handleClear = () => {
    clearHistory();
    setHistory([]);
  };

  const handleRestore = (entry: HistoryEntry) => {
    onRestore(entry);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-40 md:hidden"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed left-0 top-0 bottom-0 w-[280px] bg-bg-surface border-r border-border z-50 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 h-10 border-b border-border shrink-0">
              <span className="text-[11px] font-mono uppercase tracking-widest text-text-muted">
                HISTORY
              </span>
              <button
                onClick={onClose}
                className="text-text-dim hover:text-text-primary transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {history.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-[11px] font-mono text-text-dim">No history yet</p>
                </div>
              ) : (
                history.map((entry) => {
                  const colors = VERDICT_COLORS[entry.verdict] || VERDICT_COLORS.SAFE;
                  return (
                    <button
                      key={entry.id}
                      onClick={() => handleRestore(entry)}
                      className="w-full text-left p-3 bg-bg-card border border-border hover:border-accent-green/40 transition-colors"
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <span
                          className="font-mono text-[10px] px-1.5 py-0.5 rounded"
                          style={{
                            backgroundColor: colors.bg,
                            color: colors.text,
                            border: `1px solid ${colors.border}`,
                          }}
                        >
                          {entry.language.toUpperCase()}
                        </span>
                        <span
                          className="font-mono text-[10px] px-1.5 py-0.5 rounded"
                          style={{
                            backgroundColor: colors.bg,
                            color: colors.text,
                            border: `1px solid ${colors.border}`,
                          }}
                        >
                          {entry.verdict}
                        </span>
                      </div>
                      <p className="text-[11px] font-mono text-text-primary truncate mb-1">
                        {entry.codeSnippet}
                      </p>
                      <p className="text-[10px] font-mono text-text-dim">
                        {formatRelativeTime(entry.timestamp)} • Score: {entry.riskScore}/10
                      </p>
                    </button>
                  );
                })
              )}
            </div>

            {/* Footer */}
            {history.length > 0 && (
              <div className="px-3 py-2 border-t border-border">
                <button
                  onClick={handleClear}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 text-[10px] font-mono uppercase tracking-wider text-accent-red border border-accent-red/40 hover:bg-accent-red/10 transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                  CLEAR ALL
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
