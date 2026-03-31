// components/LineRefChip.tsx
'use client';

interface LineRefChipProps {
  lineRef: string;
  onHighlight: (lineRef: string) => void;
}

export default function LineRefChip({ lineRef, onHighlight }: LineRefChipProps) {
  return (
    <button
      onClick={() => onHighlight(lineRef)}
      className="inline-flex items-center px-1.5 py-0.5 text-[11px] font-mono text-accent-green bg-bg-elevated border border-accent-green/50 hover:bg-accent-green/10 hover:border-accent-green transition-colors cursor-pointer"
    >
      L{lineRef}
    </button>
  );
}
