// lib/history.ts
import { HistoryEntry, ReviewResult, VerdictSeverity } from '@/types/review';

const KEY = 'phantom_history';
const MAX = 20;

export function getHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as HistoryEntry[];
  } catch {
    return [];
  }
}

export function saveHistory(entry: HistoryEntry): void {
  const entries = getHistory();
  const updated = [entry, ...entries].slice(0, MAX);
  localStorage.setItem(KEY, JSON.stringify(updated));
}

export function clearHistory(): void {
  localStorage.removeItem(KEY);
}

export function createHistoryEntry(
  code: string,
  language: string,
  result: ReviewResult
): HistoryEntry {
  // Count issues by severity
  const criticalCount = result.issues.filter((i) => i.severity === 'CRITICAL').length;
  const warningCount = result.issues.filter((i) => i.severity === 'WARNING').length;
  const infoCount = result.issues.filter((i) => i.severity === 'INFO').length;

  // Determine verdict
  let verdict: VerdictSeverity = 'SAFE';
  if (criticalCount > 0) verdict = 'CRITICAL';
  else if (warningCount > 0) verdict = 'WARNING';
  else if (infoCount > 0) verdict = 'INFO';

  return {
    id: generateId(),
    timestamp: Date.now(),
    language,
    codeSnippet: code.slice(0, 120),
    verdict,
    riskScore: result.riskScore || result.score || 0,
    criticalCount,
    warningCount,
    fullResult: result,
    codeSnapshot: code,
  };
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}min ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return days === 1 ? 'yesterday' : `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}
