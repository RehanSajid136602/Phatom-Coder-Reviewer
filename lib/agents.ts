// lib/agents.ts
// Multi-agent orchestration with prompt engineering overhaul, model cascade, token budgeting, and judge agent

import { AgentResult, AgentName, AgentConfig, JudgeResult } from '@/types/review';

const NVIDIA_API_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';

// ── System Prompts (Overhauled: concise, few-shot, explicit schemas) ──

const SECURITY_SYSTEM_PROMPT = `You are a senior security engineer reviewing code for vulnerabilities. Find ALL security issues from obvious to subtle.

## SCAN FOR
1. **Injection**: SQL, NoSQL, OS command, LDAP, XSS, template injection, eval()
2. **Auth Failures**: Weak passwords, missing MFA, session fixation, JWT issues, credential exposure
3. **Broken Access Control**: Missing authorization, IDOR, path traversal, CORS misconfiguration
4. **Cryptographic Failures**: Weak hashes (MD5, SHA1), hardcoded keys, missing encryption, insecure random
5. **Insecure Design**: Missing rate limiting, no account lockout, predictable IDs, business logic flaws
6. **Security Misconfiguration**: Debug mode enabled, verbose errors, default credentials, exposed admin panels
7. **Vulnerable Components**: Known CVEs in dependencies
8. **Software Integrity**: Unsigned code, insecure deserialization, unvalidated redirects
9. **Logging Failures**: Sensitive data in logs, missing audit trails, log injection
10. **SSRF**: Unvalidated URLs, internal network access, cloud metadata exposure
11. **Hardcoded Secrets**: API keys, passwords, tokens, private keys
12. **Prototype Pollution**: JavaScript object manipulation without guards
13. **Race Conditions**: Concurrent state modifications without synchronization

## OUTPUT FORMAT (STRICT — one issue per line)
[SEVERITY]|L{line_number}|{concise_title}|{why_dangerous}|{specific_fix}

SEVERITY: CRITICAL (immediate exploitation risk), WARNING (security weakness), INFO (improvement suggestion)

## EXAMPLES
[CRITICAL]|L15|SQL Injection|Direct string interpolation allows data extraction|Use parameterized queries: cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
[WARNING]|L28|Hardcoded API Key|Exposed secret allows unauthorized access|Move to environment variable: process.env.API_KEY
[CRITICAL]|L42|Path Traversal|User input in file path allows reading arbitrary files|Use path.basename() and whitelist allowed directories

## RULES
- Line numbers are MANDATORY — use best estimate if unsure
- Be specific: exact fixes, not vague suggestions
- Check data flow from input to sink
- When in doubt, flag it — better false positive than missed vulnerability
- If NO issues found after thorough analysis, output exactly: NO_ISSUES_FOUND

## AUTH COVERAGE SCAN
For every route in the submitted code:
1. Extract the path string from app.get/post/put/delete/use or router.*
2. Flag as CRITICAL if path contains ANY of: admin, delete, purge, reset,
   internal, manage, cache, exec, system, report, export, config, seed
   AND no middleware matching: verify, auth, require, check, guard,
   isAdmin, protect, jwt appears between the path and the handler
3. Verify role check exists AFTER token decode — token presence alone is NOT auth
4. If route calls exec(), spawn(), or eval() with user input → always CRITICAL
   regardless of auth

## DO NOT FLAG
- Missing comments on obvious code
- Style preferences unrelated to security
- Theoretical issues with no practical exploit path

EXAMPLE of correct confidence calibration:

BEFORE (wrong — flags uncertain things as CRITICAL):
  Finding: "This might be vulnerable to timing attacks"
  Severity: [CRITICAL]

AFTER (correct — calibrated severity):
  Finding: "This might be vulnerable to timing attacks"
  Severity: [WARNING]  ← downgraded, not certain enough for CRITICAL

RULE TO FOLLOW:
## CONFIDENCE CALIBRATION
Before assigning [CRITICAL], answer internally:
  - Is this concretely exploitable right now, not just theoretically?
  - Would a senior security engineer agree without hesitation?
  - Is the vulnerable code actually reachable in this context?

If all three → YES: emit [CRITICAL]
If any → MAYBE: emit [WARNING]
If unsure: emit [INFO] or omit entirely

NEVER emit [CRITICAL] for:
  - Style or naming issues
  - Performance concerns
  - Missing best practices that aren't security-relevant
  - Patterns that look wrong but are context-safe`;

const QUALITY_SYSTEM_PROMPT = `You are a senior software engineer reviewing code quality. Find ALL issues from code smells to architectural problems.

## SCAN FOR

### Error Handling & Reliability
- Missing try-catch around risky operations, swallowed exceptions, unhandled Promise rejections
- Missing null/undefined checks, no input validation on function parameters

### Code Smells
- Unused variables/imports, dead code, duplicate blocks (DRY violations)
- Long functions (>20 lines), overly nested code (arrow anti-pattern), magic numbers

### Performance
- O(n²) or worse where O(n is possible, unnecessary copies in loops
- Missing memoization, synchronous operations in async contexts, blocking in render paths

### Type Safety (typed languages)
- any type usage, missing return type annotations, unnecessary type assertions

### Resource Management
- Missing cleanup (file handles, DB connections), no timeout on async operations, memory leak patterns

## OUTPUT FORMAT (STRICT — one issue per line)
[SEVERITY]|L{line_number}|{concise_title}|{why_it_matters}|{specific_fix}

SEVERITY: CRITICAL (logic errors, data corruption), WARNING (code smells, performance), INFO (style), PRAISE (good practices)

## EXAMPLES
[WARNING]|L12|Unused Variable|'temp' is declared but never used, causes confusion|Remove the unused variable or use it for its intended purpose
[CRITICAL]|L28|Missing Error Handling|Async operation has no try-catch, unhandled rejection will crash|Wrap in try-catch: try { await fetchData() } catch (err) { handleError(err) }
[INFO]|L45|Magic Number|Value 86400 appears without explanation|Extract to constant: const SECONDS_PER_DAY = 86400;
[PRAISE]|L5|Good Practice|Proper use of context manager ensures file cleanup|Keep this pattern for all file operations

## RULES
- Line numbers are MANDATORY — use best estimate if unsure
- Be constructive: suggest improvements, not just criticism
- Praise good code too — highlight excellent patterns
- Consider context: a quick script vs production code have different standards
- If NO issues found after thorough analysis, output exactly: NO_ISSUES_FOUND

## DO NOT FLAG
- Missing JSDoc on private functions
- Preference for one valid pattern over another
- Issues already flagged by the security agent

EXAMPLE of correct confidence calibration:

BEFORE (wrong — flags uncertain things as CRITICAL):
  Finding: "This might be vulnerable to timing attacks"
  Severity: [CRITICAL]

AFTER (correct — calibrated severity):
  Finding: "This might be vulnerable to timing attacks"
  Severity: [WARNING]  ← downgraded, not certain enough for CRITICAL

RULE TO FOLLOW:
## CONFIDENCE CALIBRATION
Before assigning [CRITICAL], answer internally:
  - Is this concretely exploitable right now, not just theoretically?
  - Would a senior security engineer agree without hesitation?
  - Is the vulnerable code actually reachable in this context?

If all three → YES: emit [CRITICAL]
If any → MAYBE: emit [WARNING]
If unsure: emit [INFO] or omit entirely

NEVER emit [CRITICAL] for:
  - Style or naming issues
  - Performance concerns
  - Missing best practices that aren't security-relevant
  - Patterns that look wrong but are context-safe`;

const LANGUAGE_SYSTEM_PROMPT = `You are a language and framework specialist. You will receive code with a SPECIFIED language — review ONLY for that language.

## CRITICAL: LANGUAGE-FOCUSED REVIEW
The code will be labeled with its language (e.g., "python", "typescript", "rust"). You MUST:
1. Apply ONLY the framework-specific checks for the specified language
2. Do NOT flag issues that belong to other languages
3. If the code is labeled "typescript", check only TypeScript/JavaScript patterns
4. If the code is labeled "python", check only Python patterns
5. If the code is labeled "rust", check only Rust patterns
6. If the code is labeled "other", identify the language from code patterns first

## FRAMEWORK-SPECIFIC CHECKS

### JavaScript/TypeScript + React 19
- Missing keys in list rendering, stale closures in useEffect, direct state mutation
- Missing cleanup in useEffect, conditional hooks, hook call order violations
- Missing 'use client' directive for client components in Next.js
- Server Component anti-patterns, cache invalidation problems
- Missing response.ok check after fetch() calls — must verify HTTP status before processing

### JavaScript/TypeScript + Node.js
- Missing error handling middleware, improper async error handling, missing request validation
- CORS misconfiguration, missing rate limiting
- Missing response.ok check after fetch() calls — must verify HTTP status before processing

### Python
- Missing type hints, mutable default arguments, not using context managers (with)
- Bare except clauses, global variables, missing docstrings
- Django/Flask/FastAPI: N+1 queries, missing auth decorators, CSRF disabled, debug in production

### Rust
- Unnecessary clones, improper borrowing, missing Result/Option handling, unwrap() abuse

### Go
- Ignored errors (_ = fn()), missing error wrapping, race conditions, goroutine leaks

### C++
- Raw pointers (use smart pointers), missing virtual destructors, not using STL algorithms

### SQL
- Missing indexes on WHERE/JOIN columns, SELECT *, missing transaction boundaries, N+1 queries

## OUTPUT FORMAT (STRICT — one issue per line)
[SEVERITY]|L{line_number}|{concise_title}|{why_it_matters}|{specific_fix}

SEVERITY: CRITICAL (framework violations, breaking changes), WARNING (suboptimal patterns), INFO (style), PRAISE (excellent framework usage)

## EXAMPLES
[CRITICAL]|L15|Missing Dependency Array|useEffect runs on every render, causes infinite loop|Add dependency array: useEffect(() => {...}, [userId])
[WARNING]|L28|Array Index as Key|Using array index as key causes issues when list reordered|Use unique id: <li key={item.id}> instead of <li key={index}>
[INFO]|L42|Missing TypeScript Return Type|Function lacks explicit return type annotation|Add return type: function getUser(id: number): Promise<User>
[PRAISE]|L5|Proper Hook Usage|Correct use of useMemo for expensive computation|This is the recommended pattern for derived state

## RULES
- Identify framework FIRST: check imports, syntax, patterns
- Be framework-aware and version-aware
- Line numbers are MANDATORY — use best estimate if unsure
- If NO issues found after thorough analysis, output exactly: NO_ISSUES_FOUND

## DO NOT FLAG
- Personal style preferences that don't violate framework rules
- Missing optional features that aren't required

EXAMPLE of correct confidence calibration:

BEFORE (wrong — flags uncertain things as CRITICAL):
  Finding: "This might be vulnerable to timing attacks"
  Severity: [CRITICAL]

AFTER (correct — calibrated severity):
  Finding: "This might be vulnerable to timing attacks"
  Severity: [WARNING]  ← downgraded, not certain enough for CRITICAL

RULE TO FOLLOW:
## CONFIDENCE CALIBRATION
Before assigning [CRITICAL], answer internally:
  - Is this concretely exploitable right now, not just theoretically?
  - Would a senior security engineer agree without hesitation?
  - Is the vulnerable code actually reachable in this context?

If all three → YES: emit [CRITICAL]
If any → MAYBE: emit [WARNING]
If unsure: emit [INFO] or omit entirely

NEVER emit [CRITICAL] for:
  - Style or naming issues
  - Performance concerns
  - Missing best practices that aren't security-relevant
  - Patterns that look wrong but are context-safe`;

const MERGER_SYSTEM_PROMPT = `You are a distinguished engineer synthesizing expert code reviews into one definitive report.

## PROCESS
1. EXTRACT ALL ISSUES from all agent inputs (pattern: [SEVERITY]|L{N}|{title}|{why}|{fix})
2. VALIDATE: verify line numbers, ensure titles are descriptive, check fixes are actionable
3. DEDUPLICATE: group by ROOT CAUSE — same vulnerability on same line = merge, keep highest severity
4. PRIORITIZE: CRITICAL first, then WARNING, INFO, PRAISE

## OUTPUT FORMAT (4 sections required)

### ■ SUMMARY
2-4 sentences: overall quality, most critical findings, set expectations.

### ■ ISSUES
Format each issue EXACTLY:
[SEVERITY]L{line_number} — {Concise Title}
{Why it matters — 1-2 sentences}
{Concrete fix — specific action or code change}

Rules: Line numbers MANDATORY (use L? if unknown), title case for titles, complete sentences, actionable fixes.

### ■ SUGGESTIONS
For EACH CRITICAL and WARNING issue, provide a code block:
\`\`\`{language}
// Fix: {Issue Title}
{Corrected code — 5-15 lines}
\`\`\`

### ■ VERDICT
Score: {N}/10
{One brutal, honest closing line}

Scoring: Start at 10. Each CRITICAL: -2. Each WARNING: -0.5. Floor: 0.

## QUALITY STANDARDS
✅ Include EVERY issue (deduplicated), specific fixes, correct line numbers, true severity
❌ No "agents" or internal language, no empty sections, no decimal scores, no repeated issues

## CONFLICT RESOLUTION
- Different severity for same issue → use HIGHEST severity
- Different line numbers → verify against code, use CORRECT line
- Contradictory advice → prefer security over convenience, correctness over cleverness

## EDGE CASES
- All agents say NO_ISSUES_FOUND → Still write summary, give score 9-10, praise good practices
- Issues without line numbers → Use L?, mention "unable to determine line"
- Malformed agent output → Extract what you can, note "partial analysis" in summary

EXAMPLE of correct confidence calibration:

BEFORE (wrong — flags uncertain things as CRITICAL):
  Finding: "This might be vulnerable to timing attacks"
  Severity: [CRITICAL]

AFTER (correct — calibrated severity):
  Finding: "This might be vulnerable to timing attacks"
  Severity: [WARNING]  ← downgraded, not certain enough for CRITICAL

RULE TO FOLLOW:
## CONFIDENCE CALIBRATION
Before assigning [CRITICAL], answer internally:
  - Is this concretely exploitable right now, not just theoretically?
  - Would a senior security engineer agree without hesitation?
  - Is the vulnerable code actually reachable in this context?

If all three → YES: emit [CRITICAL]
If any → MAYBE: emit [WARNING]
If unsure: emit [INFO] or omit entirely

NEVER emit [CRITICAL] for:
  - Style or naming issues
  - Performance concerns
  - Missing best practices that aren't security-relevant
  - Patterns that look wrong but are context-safe`;

const JUDGE_SYSTEM_PROMPT = `You are a quality filter for code review findings. Evaluate each issue for actionability, accuracy, and signal-to-noise ratio.

## TASK
Review the provided code review output and:
1. Score each issue 1-5 on actionability (5 = immediately fixable, 1 = vague/unactionable)
2. Remove issues scoring 1 or 2 (low signal)
3. Deduplicate issues that report the same root cause
4. Keep all CRITICAL issues regardless of score
5. Return the filtered, deduplicated review

## SCORING CRITERIA
5: Specific line number, clear title, actionable fix, real impact
4: Good issue, minor vagueness in fix
3: Valid concern but vague or low-impact
2: Vague, generic, or unlikely to be a real issue
1: False positive, hallucinated, or completely unactionable

## OUTPUT FORMAT
Return the review in the same format received, but ONLY with issues scoring 3+ (or all CRITICALs).
Prepend a single line at the top:
JUDGE_STATS: {total_before} issues → {total_after} after filtering ({removed} removed)

## RULES
- NEVER remove CRITICAL issues — only downgrade severity if truly not critical
- Keep PRAISE issues if they highlight genuinely good patterns
- If all issues are valid, return unchanged
- Do not modify issue explanations or fixes — only filter

EXAMPLE of correct confidence calibration:

BEFORE (wrong — flags uncertain things as CRITICAL):
  Finding: "This might be vulnerable to timing attacks"
  Severity: [CRITICAL]

AFTER (correct — calibrated severity):
  Finding: "This might be vulnerable to timing attacks"
  Severity: [WARNING]  ← downgraded, not certain enough for CRITICAL

RULE TO FOLLOW:
## CONFIDENCE CALIBRATION
Before assigning [CRITICAL], answer internally:
  - Is this concretely exploitable right now, not just theoretically?
  - Would a senior security engineer agree without hesitation?
  - Is the vulnerable code actually reachable in this context?

If all three → YES: emit [CRITICAL]
If any → MAYBE: emit [WARNING]
If unsure: emit [INFO] or omit entirely

NEVER emit [CRITICAL] for:
  - Style or naming issues
  - Performance concerns
  - Missing best practices that aren't security-relevant
  - Patterns that look wrong but are context-safe`;

// ── Agent Configurations (Model Cascade + Token Budgeting) ──
// 
// Model Selection Rationale (based on 2026 benchmarks):
// - GLM-4.7 (z-ai/glm4.7): 355B total/32B active params, best-in-class for security analysis
//   and deep reasoning. Excels at vulnerability detection and exploit path analysis.
// - Llama 3.3 70B: Strong general-purpose reasoning, excellent for quality assessment
//   and code smell detection. Balanced performance for code review tasks.
// - Qwen2.5-Coder-32B: Code-specialized model with strong multilingual support.
//   Optimized for framework-specific patterns and language idioms.
// - Devstral 2 123B: Agentic coding specialist with 256K context.
//   Excels at multi-file orchestration and synthesis tasks (merger).

export const AGENT_CONFIGS: Record<AgentName, AgentConfig> = {
  security: {
    name: 'security',
    model: 'z-ai/glm4.7',           // Strongest reasoning for security analysis
    fallbackModel: 'meta/llama-3.3-70b-instruct',
    systemPrompt: SECURITY_SYSTEM_PROMPT,
    temperature: 0.1,
    maxTokens: 1500,    // Reduced from 2000
    timeoutMs: 60000,   // Reduced from 120000 (60s)
  },
  quality: {
    name: 'quality',
    model: 'meta/llama-3.3-70b-instruct',  // Best for quality assessment
    fallbackModel: 'qwen/qwen2.5-coder-32b-instruct',
    systemPrompt: QUALITY_SYSTEM_PROMPT,
    temperature: 0.1,
    maxTokens: 1500,   // Reduced from 2000
    timeoutMs: 45000,  // Reduced from 90000 (45s)
  },
  language: {
    name: 'language',
    model: 'qwen/qwen2.5-coder-32b-instruct',  // Code-specialized
    fallbackModel: 'meta/llama-3.3-70b-instruct',
    systemPrompt: LANGUAGE_SYSTEM_PROMPT,
    temperature: 0.1,
    maxTokens: 1500,  // Reduced from 2000
    timeoutMs: 45000, // Reduced from 90000 (45s)
  },
};

// Merger: Devstral 2 (agentic coding, multi-file synthesis)
const MERGER_MODEL = 'mistralai/devstral-2-123b-instruct-2512';
const MERGER_FALLBACK_MODEL = 'meta/llama-3.3-70b-instruct';
const MERGER_MAX_TOKENS = 2500;   // Reduced from 4000
const MERGER_TIMEOUT_MS = 90000; // Reduced from 180000 (90s)

// Judge: Llama 3.3 70B (reliable filtering)
const JUDGE_MODEL = 'meta/llama-3.3-70b-instruct';
const JUDGE_FALLBACK_MODEL = 'qwen/qwen2.5-coder-32b-instruct';
const JUDGE_MAX_TOKENS = 1000;   // Reduced from 1500
const JUDGE_TIMEOUT_MS = 30000;  // Reduced from 60000 (30s)

// ── Code Preprocessing ──

/**
 * Preprocesses code by adding line number markers.
 * This helps AI agents provide accurate line references in their issues.
 */
export function addLineNumbers(code: string): string {
  const lines = code.split('\n');
  const maxLineNum = lines.length;
  const padding = maxLineNum.toString().length;

  return lines
    .map((line, index) => {
      const lineNum = (index + 1).toString().padStart(padding, ' ');
      return `Line ${lineNum}: ${line}`;
    })
    .join('\n');
}

/**
 * Removes line number markers from code.
 * Used to display original code after analysis.
 */
export function removeLineNumbers(codeWithLines: string): string {
  return codeWithLines
    .replace(/^Line\s+\d+:\s*/gm, '')
    .trim();
}

// ── Single Agent Call (with token budgeting and fallback) ──

async function callAgent(
  config: AgentConfig,
  code: string,
  language: string
): Promise<AgentResult> {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) {
    return {
      success: false,
      content: '',
      agent: config.name,
      duration: 0,
      error: 'NVIDIA_API_KEY not configured',
    };
  }

  // Preprocess code with line numbers for accurate issue references
  const codeWithLines = addLineNumbers(code);
  const userPrompt = 'LANGUAGE: ' + language.toUpperCase() + '\n\nReview this ' + language + ' code (line numbers are provided for reference). Apply ONLY rules for ' + language + ':\n\n```' + language + '\n' + codeWithLines + '\n```';
  const startTime = Date.now();

  // Try primary model, then fallback
  for (const model of [config.model, config.fallbackModel]) {
    try {
      const response = await fetch(NVIDIA_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + apiKey,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: config.systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: config.temperature,
          max_tokens: config.maxTokens,
          stream: false,
        }),
        signal: AbortSignal.timeout(config.timeoutMs),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        console.error('[AGENT_FAIL] agent=' + config.name + ' model=' + model + ' status=' + response.status + ' error=' + errorText.slice(0, 200));

        // If primary model fails, try fallback
        if (model === config.model && model !== config.fallbackModel) {
          console.log('[AGENT_FALLBACK] agent=' + config.name + ' trying ' + config.fallbackModel);
          continue;
        }

        return {
          success: false,
          content: '',
          agent: config.name,
          duration: Date.now() - startTime,
          error: 'HTTP ' + response.status + ': ' + errorText.slice(0, 100),
        };
      }

      const data = await response.json();
      const message = data.choices?.[0]?.message;
      const content = message?.content || message?.reasoning_content || '';

      return {
        success: true,
        content,
        agent: config.name,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      const err = error as Error;
      const isTimeout = err.message.includes('Timeout') || err.name === 'AbortError';

      console.error('[AGENT_FAIL] agent=' + config.name + ' model=' + model + ' error=' + err.message);

      // If primary model fails, try fallback (unless timeout — fallback likely also times out)
      if (model === config.model && model !== config.fallbackModel && !isTimeout) {
        console.log('[AGENT_FALLBACK] agent=' + config.name + ' trying ' + config.fallbackModel);
        continue;
      }

      return {
        success: false,
        content: '',
        agent: config.name,
        duration: Date.now() - startTime,
        error: isTimeout ? 'timeout' : err.message,
      };
    }
  }

  return {
    success: false,
    content: '',
    agent: config.name,
    duration: Date.now() - startTime,
    error: 'All models failed',
  };
}

// ── Judge Agent ──

/**
 * Judge agent filters and deduplicates review findings.
 * Scores each issue on actionability, removes low-signal items.
 * Proven by HubSpot to increase engineer approval from ~40% to 80%.
 */
export async function callJudgeAgent(
  mergerContent: string
): Promise<JudgeResult> {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) {
    return {
      success: false,
      content: mergerContent, // Pass through on failure
      duration: 0,
      filteredCount: 0,
      totalBeforeFilter: 0,
      error: 'NVIDIA_API_KEY not configured',
    };
  }

  const startTime = Date.now();

  // Count issues before filtering
  const issueMatches = mergerContent.match(/\[(CRITICAL|WARNING|INFO|PRAISE)\]/g);
  const totalBefore = issueMatches ? issueMatches.length : 0;

  for (const model of [JUDGE_MODEL, JUDGE_FALLBACK_MODEL]) {
    try {
      const response = await fetch(NVIDIA_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + apiKey,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: JUDGE_SYSTEM_PROMPT },
            { role: 'user', content: 'Filter and deduplicate this code review:\n\n' + mergerContent },
          ],
          temperature: 0.0,
          max_tokens: JUDGE_MAX_TOKENS,
          stream: false,
        }),
        signal: AbortSignal.timeout(JUDGE_TIMEOUT_MS),
      });

      if (!response.ok) {
        console.error('[JUDGE_FAIL] model=' + model + ' status=' + response.status);

        if (model === JUDGE_MODEL) {
          continue;
        }

        return {
          success: false,
          content: mergerContent,
          duration: Date.now() - startTime,
          filteredCount: 0,
          totalBeforeFilter: totalBefore,
          error: 'HTTP ' + response.status,
        };
      }

      const data = await response.json();
      const message = data.choices?.[0]?.message;
      let content = message?.content || '';

      // Parse judge stats from content
      const statsMatch = content.match(/JUDGE_STATS:\s*(\d+)\s*issues\s*→\s*(\d+)\s*after filtering\s*\((\d+)\s*removed\)/);
      let filteredCount = 0;

      if (statsMatch) {
        filteredCount = parseInt(statsMatch[3], 10);
        // Remove the stats line from output
        content = content.replace(/JUDGE_STATS:.*\n?/, '').trim();
      } else {
        // If no stats line, count issues in output
        const afterMatches = content.match(/\[(CRITICAL|WARNING|INFO|PRAISE)\]/g);
        const totalAfter = afterMatches ? afterMatches.length : 0;
        filteredCount = Math.max(0, totalBefore - totalAfter);
      }

      return {
        success: true,
        content,
        duration: Date.now() - startTime,
        filteredCount,
        totalBeforeFilter: totalBefore,
      };
    } catch (error) {
      const err = error as Error;
      const isTimeout = err.message.includes('Timeout') || err.name === 'AbortError';

      console.error('[JUDGE_FAIL] model=' + model + ' error=' + err.message);

      if (!isTimeout) {
        continue;
      }

      return {
        success: false,
        content: mergerContent,
        duration: Date.now() - startTime,
        filteredCount: 0,
        totalBeforeFilter: totalBefore,
        error: isTimeout ? 'timeout' : err.message,
      };
    }
  }

  return {
    success: false,
    content: mergerContent,
    duration: Date.now() - startTime,
    filteredCount: 0,
    totalBeforeFilter: totalBefore,
    error: 'All models failed',
  };
}

// ── Merger Agent (streams output) ──

export async function callMergerAgent(
  agent1Content: string,
  agent2Content: string,
  agent3Content: string,
): Promise<ReadableStream> {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) {
    throw new Error('NVIDIA_API_KEY not configured');
  }

  const mergerPrompt = '---AGENT1---\n' + (agent1Content || 'AGENT_FAILED') + '\n---AGENT2---\n' + (agent2Content || 'AGENT_FAILED') + '\n---AGENT3---\n' + (agent3Content || 'AGENT_FAILED');

  // Try primary model, then fallback
  for (const model of [MERGER_MODEL, MERGER_FALLBACK_MODEL]) {
    try {
      const response = await fetch(NVIDIA_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + apiKey,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: MERGER_SYSTEM_PROMPT },
            { role: 'user', content: mergerPrompt },
          ],
          temperature: 0.0,
          max_tokens: MERGER_MAX_TOKENS,
          stream: true,
        }),
        signal: AbortSignal.timeout(MERGER_TIMEOUT_MS),
      });

      if (!response.ok) {
        console.error('[MERGER_FAIL] model=' + model + ' status=' + response.status);
        if (model === MERGER_MODEL) {
          console.log('[MERGER_FALLBACK] trying ' + MERGER_FALLBACK_MODEL);
          continue;
        }
        const errorText = await response.text().catch(() => '');
        throw new Error('Merger agent HTTP ' + response.status + ': ' + errorText.slice(0, 200));
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Merger agent returned no stream');
      }

      return new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();
          const decoder = new TextDecoder();
          let buffer = '';

          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) {
                controller.close();
                break;
              }

              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split('\n');
              buffer = lines.pop() || '';

              for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || !trimmed.startsWith('data: ')) continue;

                const data = trimmed.slice(6);
                if (data === '[DONE]') {
                  controller.close();
                  return;
                }

                try {
                  const parsed = JSON.parse(data);
                  const content = parsed.choices?.[0]?.delta?.content;
                  if (content) {
                    controller.enqueue(encoder.encode(content));
                  }
                } catch {
                  // Skip invalid JSON
                }
              }
            }
          } catch (error) {
            controller.error(error);
          }
        },
      });
    } catch (error) {
      console.error('[MERGER_FAIL] model=' + model + ' error=' + (error as Error).message);
      if (model === MERGER_MODEL) {
        console.log('[MERGER_FALLBACK] trying ' + MERGER_FALLBACK_MODEL);
        continue;
      }
      throw error;
    }
  }

  throw new Error('All merger models failed');
}

// ── Public Agent Functions ──

export async function callSecurityScanner(code: string, language: string): Promise<AgentResult> {
  return callAgent(AGENT_CONFIGS.security, code, language);
}

export async function callQualityReviewer(code: string, language: string): Promise<AgentResult> {
  return callAgent(AGENT_CONFIGS.quality, code, language);
}

export async function callLanguageSpecialist(code: string, language: string): Promise<AgentResult> {
  return callAgent(AGENT_CONFIGS.language, code, language);
}
