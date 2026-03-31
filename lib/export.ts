// lib/export.ts
import { ReviewResult } from '@/types/review';

export function toMarkdown(result: ReviewResult, language: string): string {
  const date = new Date().toISOString().split('T')[0];
  const lines: string[] = [
    `# PHANTOM Code Review`,
    `**Language**: ${language}  `,
    `**Date**: ${date}  `,
    `**Risk Score**: ${result.riskScore || result.score}/100`,
    ``,
    `## Summary`,
    result.summary,
    ``,
    `## Issues`,
  ];

  for (const issue of result.issues) {
    lines.push(`### [${issue.severity}] ${issue.title}`);
    if (issue.line) lines.push(`Line ${issue.line}`);
    lines.push(issue.description);
    if (issue.fix) {
      lines.push('');
      lines.push('```' + language);
      lines.push(issue.fix);
      lines.push('```');
    }
    lines.push('');
  }

  if (result.suggestions) {
    lines.push('## Suggestions');
    lines.push(result.suggestions);
    lines.push('');
  }

  if (result.verdict) {
    lines.push('## Verdict');
    lines.push(result.verdict);
  }

  return lines.join('\n');
}

export function toJSON(result: ReviewResult, language: string): string {
  const exportData = {
    metadata: {
      tool: 'PHANTOM Code Reviewer',
      language,
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    },
    result,
  };
  return JSON.stringify(exportData, null, 2);
}

export function downloadFile(content: string, filename: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for older browsers
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    const success = document.execCommand('copy');
    document.body.removeChild(textarea);
    return success;
  }
}
