// lib/sanitize.ts
// Prompt injection protection for code input
// Escapes triple-backticks, system keywords, and other injection vectors

/**
 * Dangerous patterns that could be used for prompt injection
 */
const DANGEROUS_PATTERNS: Array<{ pattern: RegExp; description: string }> = [
  // Attempt to override system prompt
  { pattern: /\bignore\s+(all\s+)?(previous|above|prior)\s+(instructions?|rules?|prompts?)\b/gi, description: 'system prompt override attempt' },
  { pattern: /\b(you\s+are|act\s+as|roleplay|pretend|become)\s+(a|an)\s+/gi, description: 'role reassignment attempt' },
  { pattern: /\bsystem\s*:\s*/gi, description: 'system message injection' },
  { pattern: /\[INST\]/gi, description: 'instruction tag injection' },
  { pattern: /\[\/INST\]/gi, description: 'instruction close tag injection' },
  { pattern: /<\|im_start\|>/gi, description: 'chat template injection' },
  { pattern: /<\|im_end\|>/gi, description: 'chat template close tag injection' },
  { pattern: /\bassistant\s*:\s*/gi, description: 'assistant message injection' },
  { pattern: /\buser\s*:\s*/gi, description: 'user message injection' },
];

/**
 * Escape triple backticks in code to prevent markdown injection.
 * Replaces ``` with a visible marker that won't break the prompt.
 */
function escapeBackticks(code: string): string {
  // Replace triple backticks with escaped version
  return code.replace(/```/g, '\\`\\`\\`');
}

/**
 * Detect and neutralize prompt injection attempts in code input.
 * Returns an object with the sanitized code and a list of detected issues.
 */
export function sanitizePromptInjection(code: string): { code: string; issues: string[] } {
  const issues: string[] = [];
  let sanitized = code;

  for (const { pattern, description } of DANGEROUS_PATTERNS) {
    if (pattern.test(code)) {
      issues.push(description);
      // Replace matches with neutralized version
      sanitized = sanitized.replace(pattern, (match) => `[REDACTED:${match.length}]`);
    }
    // Reset regex lastIndex for next test
    pattern.lastIndex = 0;
  }

  // Escape triple backticks
  if (sanitized.includes('```')) {
    issues.push('triple backticks escaped');
    sanitized = escapeBackticks(sanitized);
  }

  return { code: sanitized, issues };
}

/**
 * Main sanitization function for code input.
 * Applies all sanitization rules in order.
 */
export function sanitizeCodeInput(code: string): string {
  // Step 1: Remove null bytes
  let sanitized = code.replace(/\0/g, '');

  // Step 2: Limit to max length
  if (sanitized.length > 50000) {
    sanitized = sanitized.slice(0, 50000);
  }

  // Step 3: Apply prompt injection protection
  const result = sanitizePromptInjection(sanitized);

  if (result.issues.length > 0) {
    console.warn('[SANITIZE] Prompt injection attempts detected:', result.issues.join(', '));
  }

  return result.code;
}

/**
 * Detect if code contains potential prompt injection patterns.
 * Returns true if any dangerous patterns are found.
 */
export function hasPromptInjection(code: string): boolean {
  return DANGEROUS_PATTERNS.some(({ pattern }) => {
    const found = pattern.test(code);
    pattern.lastIndex = 0;
    return found;
  });
}
