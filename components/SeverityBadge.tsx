// components/SeverityBadge.tsx
'use client';

import { Severity } from '@/lib/parseReview';

const severityConfig: Record<Severity, { bg: string; text: string; border: string }> = {
  CRITICAL: {
    bg: 'bg-critical-bg',
    text: 'text-accent-red',
    border: 'border-accent-red',
  },
  WARNING: {
    bg: 'bg-warning-bg',
    text: 'text-accent-yellow',
    border: 'border-accent-yellow',
  },
  INFO: {
    bg: 'bg-info-bg',
    text: 'text-accent-blue',
    border: 'border-accent-blue',
  },
  PRAISE: {
    bg: 'bg-praise-bg',
    text: 'text-accent-green-dim',
    border: 'border-accent-green-dim',
  },
};

export default function SeverityBadge({ severity }: { severity: Severity }) {
  const config = severityConfig[severity];

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider border ${config.bg} ${config.text} ${config.border}`}
    >
      [{severity}]
    </span>
  );
}
