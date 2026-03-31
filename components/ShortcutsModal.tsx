// components/ShortcutsModal.tsx
'use client';

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SHORTCUTS = [
  { key: 'Ctrl + Enter', action: 'Analyze code' },
  { key: 'Ctrl + /', action: 'Show shortcuts' },
  { key: 'Ctrl + L', action: 'Clear code' },
  { key: 'Ctrl + H', action: 'Toggle history' },
  { key: 'Ctrl + E', action: 'Export review' },
  { key: 'Escape', action: 'Close modals' },
];

export default function ShortcutsModal({ isOpen, onClose }: ShortcutsModalProps) {
  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-40"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="bg-bg-surface border border-border w-full max-w-md">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <h2 className="text-[12px] font-mono uppercase tracking-[0.2em] text-accent-green">
                  KEYBOARD SHORTCUTS
                </h2>
                <button
                  onClick={onClose}
                  className="text-text-dim hover:text-text-primary transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Content */}
              <div className="p-4">
                <table className="w-full">
                  <tbody>
                    {SHORTCUTS.map((shortcut, idx) => (
                      <tr
                        key={shortcut.key}
                        className={`border-b border-border/50 ${
                          idx === SHORTCUTS.length - 1 ? 'border-b-0' : ''
                        }`}
                      >
                        <td className="py-2.5 pr-4">
                          <kbd className="inline-flex items-center px-2 py-1 text-[11px] font-mono bg-bg-elevated border border-border text-text-primary rounded">
                            {shortcut.key}
                          </kbd>
                        </td>
                        <td className="py-2.5 text-[12px] font-mono text-text-body">
                          {shortcut.action}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Footer */}
              <div className="px-4 py-3 border-t border-border">
                <p className="text-[10px] font-mono text-text-dim">
                  Press <kbd className="px-1 py-0.5 bg-bg-elevated border border-border rounded">Esc</kbd> to close
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
