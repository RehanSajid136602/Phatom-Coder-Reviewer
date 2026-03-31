// app/api/review/route.ts
import { NextRequest } from 'next/server';
import { gatherRAGContext, formatRAGContext } from '@/lib/webSearch';
import { detectLanguage } from '@/lib/detectLanguage';
import { sanitizeCodeInput } from '@/lib/sanitize';
import {
  callSecurityScanner,
  callQualityReviewer,
  callLanguageSpecialist,
  callMergerAgent,
  callJudgeAgent,
  addLineNumbers,
} from '@/lib/agents';
import { getCachedReview, setCachedReview } from '@/lib/cache';
import { AgentResult, AgentName, ApiErrorCode, ErrorResponse } from '@/types/review';
import { endConcurrentRequest } from '@/middleware';

const VALID_LANGUAGES = [
  'python',
  'javascript',
  'typescript',
  'rust',
  'go',
  'cpp',
  'sql',
  'bash',
  'other',
] as const;

function errorResponse(message: string, code: ApiErrorCode, status: number): Response {
  const body: ErrorResponse = { error: message, code };
  console.error(`[PHANTOM API] ${code}: ${message}`);
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function validateApiKey(key: string | undefined): string | null {
  if (!key) return 'NVIDIA_API_KEY is not set. Add it to your .env.local file.';
  if (key === 'your-nvidia-api-key-here') {
    return 'NVIDIA_API_KEY is still set to the placeholder value. Replace it with your real key from https://build.nvidia.com.';
  }
  if (key.length < 20) {
    return 'NVIDIA_API_KEY appears to be too short. Check your key at https://build.nvidia.com.';
  }
  return null;
}

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  // Fallback: use a combination of headers as identifier
  const userAgent = request.headers.get('user-agent') || 'unknown';
  return `unknown-${userAgent.slice(0, 50)}`;
}

function countIssues(content: string): number {
  if (!content || content === 'NO_ISSUES') return 0;
  const matches = content.match(/\[(CRITICAL|WARNING|INFO|PRAISE)\]/g);
  return matches ? matches.length : 0;
}

export async function POST(req: NextRequest) {
  const clientIp = getClientIp(req);

  // ── Layer 1: Parse request body ──
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse(
      'Invalid request body. Expected JSON with "code" and "language" fields.',
      'INVALID_BODY',
      400
    );
  }

  const { code, language } = body as { code?: unknown; language?: unknown };

  // ── Layer 2: Validate inputs ──
  if (typeof code !== 'string') {
    return errorResponse('"code" must be a string.', 'INVALID_CODE_TYPE', 400);
  }

  if (code.trim().length === 0) {
    return errorResponse('Code cannot be empty. Paste some code to analyze.', 'EMPTY_CODE', 400);
  }

  if (code.length > 50000) {
    return errorResponse(
      `Code is ${code.length.toLocaleString()} characters. Maximum is 50,000. Shorten your snippet and try again.`,
      'CODE_TOO_LONG',
      400
    );
  }

  // Sanitize code input
  const sanitizedCode = sanitizeCodeInput(code);

  if (typeof language !== 'string' || !VALID_LANGUAGES.includes(language as (typeof VALID_LANGUAGES)[number])) {
    return errorResponse(
      `Invalid language "${language}". Must be one of: ${VALID_LANGUAGES.join(', ')}.`,
      'INVALID_LANGUAGE',
      400
    );
  }

  // ── Layer 2.5: Validate detected language matches submitted language ──
  const detectedLanguage = detectLanguage(sanitizedCode);
  if (detectedLanguage !== 'other' && detectedLanguage !== language) {
    console.warn(`[PHANTOM API] Language mismatch: submitted="${language}", detected="${detectedLanguage}"`);
    // Log warning but proceed - user might know better (e.g., embedding Python in JS)
  }

  // ── Layer 3: Validate API key ──
  const apiKey = process.env.NVIDIA_API_KEY;
  const keyError = validateApiKey(apiKey);
  if (keyError) {
    return errorResponse(keyError, 'INVALID_API_KEY', 500);
  }

  // ── Layer 4: Check cache for exact-match review ──
  const cacheKey = `${sanitizedCode.trim()}|${language}|full-review|v2`;
  const cachedResult = getCachedReview(sanitizedCode, language, 'full-review', 'v2');
  if (cachedResult) {
    console.log('[PHANTOM API] Cache hit — returning cached review');
    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        const chunkSize = 200;
        for (let i = 0; i < cachedResult.length; i += chunkSize) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'merger_chunk', text: cachedResult.slice(i, i + chunkSize) })}\n\n`));
        }
        endConcurrentRequest(clientIp);
        controller.close();
      },
    });
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Cache': 'HIT',
        'X-Cache-Latency': '0',
      },
    });
  }

  // ── Layer 5: RAG context gathering (parallel with nothing — needed before agents) ──
  let ragContext = '';
  try {
    const context = await gatherRAGContext(sanitizedCode, language);
    ragContext = formatRAGContext(context);
    if (ragContext) {
      console.log(`[PHANTOM API] RAG context: ${context.documents.length} documents from ${context.source}`);
    }
  } catch (ragError) {
    console.warn('[PHANTOM API] RAG context gathering failed, proceeding without:', (ragError as Error).message);
  }

  // ── Layer 6: Run 3 agents in parallel with SSE events ──
  const codeWithContext = sanitizedCode + ragContext;
  const pipelineStart = Date.now();

  console.log('[PHANTOM API] Starting multi-agent pipeline with judge filter...');

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      const sendEvent = (type: string, data: Record<string, unknown>) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type, ...data })}\n\n`));
        } catch {
          // Controller may be closed
        }
      };

      try {
        // Fire all 3 agents in parallel with individual completion callbacks
        const agent1Start = Date.now();
        const agent2Start = Date.now();
        const agent3Start = Date.now();

        const agentPromises = [
          callSecurityScanner(codeWithContext, language).then((result) => {
            if (result.success) {
              sendEvent('agent_complete', {
                agent: 1,
                issueCount: countIssues(result.content),
                duration: Date.now() - agent1Start,
              });
              console.log(`[PHANTOM API] Agent security: OK (${result.duration}ms, ${result.content.length} chars)`);
            } else {
              sendEvent('agent_failed', {
                agent: 1,
                error: result.error || 'unknown',
                duration: Date.now() - agent1Start,
              });
              console.error(`[AGENT_FAIL] agent=security error=${result.error} duration=${Date.now() - agent1Start}ms`);
            }
            return result;
          }),
          callQualityReviewer(codeWithContext, language).then((result) => {
            if (result.success) {
              sendEvent('agent_complete', {
                agent: 2,
                issueCount: countIssues(result.content),
                duration: Date.now() - agent2Start,
              });
              console.log(`[PHANTOM API] Agent quality: OK (${result.duration}ms, ${result.content.length} chars)`);
            } else {
              sendEvent('agent_failed', {
                agent: 2,
                error: result.error || 'unknown',
                duration: Date.now() - agent2Start,
              });
              console.error(`[AGENT_FAIL] agent=quality error=${result.error} duration=${Date.now() - agent2Start}ms`);
            }
            return result;
          }),
          callLanguageSpecialist(codeWithContext, language).then((result) => {
            if (result.success) {
              sendEvent('agent_complete', {
                agent: 3,
                issueCount: countIssues(result.content),
                duration: Date.now() - agent3Start,
              });
              console.log(`[PHANTOM API] Agent language: OK (${result.duration}ms, ${result.content.length} chars)`);
            } else {
              sendEvent('agent_failed', {
                agent: 3,
                error: result.error || 'unknown',
                duration: Date.now() - agent3Start,
              });
              console.error(`[AGENT_FAIL] agent=language error=${result.error} duration=${Date.now() - agent3Start}ms`);
            }
            return result;
          }),
        ];

        const results = await Promise.allSettled(agentPromises);

        const agentResults: Record<AgentName, AgentResult> = {
          security: results[0].status === 'fulfilled'
            ? results[0].value
            : { success: false, content: '', agent: 'security', duration: 0, error: 'unknown' },
          quality: results[1].status === 'fulfilled'
            ? results[1].value
            : { success: false, content: '', agent: 'quality', duration: 0, error: 'unknown' },
          language: results[2].status === 'fulfilled'
            ? results[2].value
            : { success: false, content: '', agent: 'language', duration: 0, error: 'unknown' },
        };

        const successfulAgents = Object.values(agentResults).filter((r) => r.success);
        const totalRaw = successfulAgents.reduce((sum, r) => sum + countIssues(r.content), 0);

        // All 3 failed
        if (successfulAgents.length === 0) {
          sendEvent('error', { message: 'All review agents unavailable. Please try again.' });
          endConcurrentRequest(clientIp);
          controller.close();
          return;
        }

        // Send merger_start event
        sendEvent('merger_start', { totalRaw });

        // Only 1 agent succeeded — skip merger and judge, stream raw output
        if (successfulAgents.length === 1) {
          console.log('[PHANTOM API] Only 1 agent succeeded, streaming raw output');
          const singleResult = successfulAgents[0];
          const text = singleResult.content;
          const chunkSize = 200;
          for (let i = 0; i < text.length; i += chunkSize) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'merger_chunk', text: text.slice(i, i + chunkSize) })}\n\n`));
          }
          sendEvent('review_complete', { score: null, judgeFiltered: 0 });
          endConcurrentRequest(clientIp);
          controller.close();
          return;
        }

        // 2 or 3 agents succeeded — run merger
        console.log('[PHANTOM API] Running merger agent...');

        let fullText = '';
        try {
          const mergerStream = await callMergerAgent(
            agentResults.security.content,
            agentResults.quality.content,
            agentResults.language.content,
          );

          const reader = mergerStream.getReader();
          const decoder = new TextDecoder();
          let buffer = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            fullText += chunk;

            // Forward merger content as merger_chunk events
            sendEvent('merger_chunk', { text: chunk });
          }

          // ── Layer 7: Judge Agent filters merger output ──
          console.log('[PHANTOM API] Running judge agent filter...');
          sendEvent('judge_start', {});

          const judgeStart = Date.now();
          let judgeFiltered = 0;
          let finalText = fullText;

          try {
            const judgeResult = await callJudgeAgent(fullText);
            if (judgeResult.success) {
              finalText = judgeResult.content;
              judgeFiltered = judgeResult.filteredCount;
              console.log(`[PHANTOM API] Judge: ${judgeResult.totalBeforeFilter} → ${judgeResult.totalBeforeFilter - judgeFiltered} issues (${judgeFiltered} filtered) in ${Date.now() - judgeStart}ms`);
              sendEvent('judge_complete', {
                filteredCount: judgeFiltered,
                duration: Date.now() - judgeStart,
              });

              // Stream the filtered content
              const chunkSize = 200;
              for (let i = 0; i < finalText.length; i += chunkSize) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'merger_chunk', text: finalText.slice(i, i + chunkSize) })}\n\n`));
              }
            } else {
              console.warn('[PHANTOM API] Judge failed, using unfiltered merger output:', judgeResult.error);
              sendEvent('judge_failed', { error: judgeResult.error });
              // Already streamed fullText above
            }
          } catch (judgeError) {
            console.error('[PHANTOM API] Judge agent error:', (judgeError as Error).message);
            sendEvent('judge_failed', { error: (judgeError as Error).message });
            // Already streamed fullText above
          }

          // Extract score from final output
          const scoreMatch = finalText.match(/Score:\s*(\d+)\s*\/?\s*10/i);
          const score = scoreMatch ? parseInt(scoreMatch[1], 10) : null;

          // Cache the final review
          setCachedReview(sanitizedCode, language, 'full-review', 'v2', finalText);

          sendEvent('review_complete', { score, judgeFiltered });
          endConcurrentRequest(clientIp);
          controller.close();
        } catch (mergerError) {
          console.error('[PHANTOM API] Merger failed, falling back to concatenation:', (mergerError as Error).message);

          const fallbackContent = successfulAgents
            .map((r) => `--- ${r.agent.toUpperCase()} ---\n${r.content}`)
            .join('\n\n');

          const chunkSize = 200;
          for (let i = 0; i < fallbackContent.length; i += chunkSize) {
            sendEvent('merger_chunk', { text: fallbackContent.slice(i, i + chunkSize) });
          }

          sendEvent('review_complete', { score: null, judgeFiltered: 0 });
          endConcurrentRequest(clientIp);
          controller.close();
        }
      } catch (error) {
        console.error('[PHANTOM API] Pipeline error:', error);
        sendEvent('error', { message: (error as Error).message || 'Unknown error' });
        endConcurrentRequest(clientIp);
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
