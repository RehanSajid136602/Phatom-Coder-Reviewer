# AGENTS.md

This file provides guidance to agentic coding agents working in this repository.

## Stack

- **Next.js 16.2.1** with App Router — breaking changes vs 14/15. Read `node_modules/next/dist/docs/` before writing code.
- **React 19.2.4** — bleeding edge, some APIs differ from 18.
- **Tailwind CSS v4** — uses `@import "tailwindcss"` and `@theme inline` syntax (NOT v3 `@tailwind` directives). PostCSS plugin is `@tailwindcss/postcss`.
- **TypeScript strict** — no `any`, no `as X`, no `!` non-null assertions.
- **No ORM** — raw SQL only via `postgres.js` (if DB is added). NEVER use Prisma.
- **Testing**: Jest 29 + React Testing Library + jsdom.

## Commands

```bash
npm run dev             # Start dev server (Turbopack)
npm run build           # Production build
npm run start           # Start production server
npm run lint            # ESLint (flat config in eslint.config.mjs)
npm run type-check      # TypeScript check without emitting (tsc --noEmit)
npm test                # Run all tests via Jest
npm run test:watch      # Watch mode
npm run test:coverage   # Run with coverage report
npm run test:ci         # CI mode — coverage, max 2 workers

# Run a single test file
npx jest tests/lib/detectLanguage.test.ts

# Run a single test by name pattern
npx jest -t "detectLanguage"

# Run tests matching a path pattern
npx jest --testPathPattern="components/CodePanel"
```

## Code Style

### Imports
- Use `@/` path alias for all internal imports (e.g., `@/lib/webSearch`, `@/components/ReviewPanel`).
- Group imports: external libraries first, then internal `@/` imports, then relative imports.
- Never use deep relative imports like `../../lib/foo` — always use `@/lib/foo`.

### TypeScript
- **Strict mode** — `noImplicitAny`, `strictNullChecks`, `noUnusedLocals` all enabled.
- **No `any`** — use `unknown` with type guards, or define proper interfaces.
- **No `as Type`** casts — use type guards or narrow types properly.
- **No `!` non-null assertions** — use optional chaining `?.` or explicit null checks.
- All async functions must have try/catch or propagate typed errors.
- Define interfaces for component props, API request/response shapes.

### Naming Conventions
- **Components**: PascalCase (`ReviewPanel`, `CodePanel`, `SeverityBadge`).
- **Hooks**: camelCase with `use` prefix (`useAgentStream`).
- **Lib functions**: camelCase (`detectLanguage`, `parseReview`, `webSearch`).
- **Types/Interfaces**: PascalCase, prefixed with `I` only if ambiguous.
- **CSS classes**: kebab-case in globals.css, Tailwind utilities in JSX.

### Formatting
- 2-space indentation (TypeScript default).
- Single quotes for strings, double quotes for JSX attributes.
- Trailing commas in multi-line objects/arrays.
- Semicolons required.
- Max line length: 120 characters (enforced by ESLint).
- File path comment on line 1: `// src/components/example.tsx`

### React Patterns
- Use `'use client'` directive for components with state/effects.
- Prefer `useCallback` for event handlers passed to child components.
- Use `useMemo` for expensive computations, not for every object.
- Prefer composition over context for non-auth state (use Zustand for global state).

### Error Handling
- **API routes**: Return proper HTTP status codes with JSON error bodies.
- **Web search is non-fatal**: `lib/webSearch.ts` catches all DuckDuckGo errors silently — review continues without search context. Never throw on search failure.
- **Stream errors**: In-stream errors from NVIDIA NIM are appended as `\n\n[ERROR] message` to streamed text.
- **Client errors**: Non-2xx responses from `/api/review` display as `■ ERROR` in the review panel — not as toast/alert.

## Architecture

### Core Files
- `app/page.tsx` — Client component (`'use client'`), orchestrates all state. NOT a server component.
- `app/api/review/route.ts` — POST endpoint. Calls NVIDIA NIM API via raw fetch with streaming. Requires `NVIDIA_API_KEY`.
- `app/layout.tsx` — Root layout with font injection (`DM_Mono`, `Instrument_Serif`).
- `app/globals.css` — Tailwind v4 config with CSS variables, theme mapping, animations.

### Library Files
- `lib/webSearch.ts` — DuckDuckGo HTML scraping + RAG pipeline with OSV.dev security advisories.
- `lib/parseReview.ts` — Parses streamed AI output into sections. Handles AI typos (e.g., `'ISSUUES'`).
- `lib/detectLanguage.ts` — Regex scoring system for language detection. TypeScript bonus over JS.
- `lib/agents.ts` — Multi-agent orchestration with Judge agent for filtering.
- `lib/cache.ts` — Multi-tier in-memory caching (50MB limit, LRU eviction).
- `lib/examples.ts` — Sample code snippets for demo.

### Components
- `components/CodePanel.tsx` — Code input with syntax highlighting, language selector, inline annotations.
- `components/ReviewPanel.tsx` — Review output with progressive disclosure, collapsible sections.
- `components/AgentProgress.tsx` — Progress bar showing agent stages.
- `components/StatusBar.tsx` — Bottom status bar with model, tokens, latency.
- `components/SeverityBadge.tsx` — Color-coded severity indicators.
- `components/LineRefChip.tsx` — Clickable line reference chips.

### Hooks
- `hooks/useAgentStream.ts` — Custom hook for streaming state management, handles API calls.

### Types
- `types/review.ts` — TypeScript interfaces for ReviewResult, AgentState, CacheEntry, RAGResult.

## Non-Obvious Patterns

- **Streaming**: API route returns `ReadableStream` with `text/plain` (NOT `text/event-stream`). Client reads via `response.body.getReader()` with `TextDecoder`.
- **Line highlighting auto-clears**: `page.tsx` uses `setTimeout(() => setHighlightedLines(new Set()), 3000)` — don't add manual clear logic.
- **CSS variables → Tailwind**: Colors defined as `:root` custom properties, mapped via `@theme inline`. Use Tailwind classes (`bg-bg-surface`, `text-accent-green`), not raw CSS variables.
- **Font injection**: `DM_Mono` and `Instrument_Serif` via `next/font/google` with CSS variables. Reference as `font-mono` and `font-serif`.
- **Hydration quirk**: Disabled button renders `disabled={null}` on SSR, `disabled={true}` on client with empty code. Known React 19 behavior — not a bug.
- **Path alias**: `@/*` maps to project root.
- **No navbar/footer**: Full-viewport split layout. Header is 48px, status bar is 32px.
- **Judge Agent**: Filters low-signal findings, outputs `Note: [INFO] issues were removed because they scored low`.
- **Cache performance**: Exact-match cache provides ~3300x speedup on repeat reviews (89s → 0.027s).

## UI/UX Patterns

- **Dark theme**: `#0a0a0f` background, glassmorphism surfaces.
- **Severity colors**: CRITICAL=red (`#ff4444`), WARNING=yellow (`#f5a623`), INFO=blue (`#4a9eff`), PRAISE=green (`#00ff88`).
- **Framer Motion**: Use for complex interactions, CSS keyframes for simple loaders.
- **Progressive disclosure**: Collapsible sections in ReviewPanel for clean output.
- **Inline annotations**: Severity dots in CodePanel gutter linking to issues.
- **Status bar**: Fixed 32px at bottom, shows model, token count, latency.

## Testing

- Test files live in `tests/` mirroring source structure: `tests/lib/`, `tests/components/`, `tests/hooks/`, `tests/api/`.
- File naming: `*.test.ts` or `*.test.tsx`.
- Jest config in `jest.config.js` — uses ts-jest with jsdom environment.
- Setup file: `tests/setup.ts` — mocks TextEncoder/TextDecoder, ReadableStream, IntersectionObserver, ResizeObserver, navigator.clipboard.
- Coverage threshold: 50% across branches, functions, lines, statements.
- Pre-existing test issues: jest-dom type errors in some test files (don't fix, unrelated to source code).

## Environment

```bash
# Required in .env.local
NVIDIA_API_KEY=nvapi-...   # Get from https://build.nvidia.com

# Optional - Custom model (default: meta/llama-3.1-405b-instruct)
NVIDIA_MODEL=meta/llama-3.1-405b-instruct
```

## Gotchas

- **API errors surface in review panel**: Non-2xx responses display as `■ ERROR` — check server logs.
- **Web search failures are silent**: Check server logs, not client.
- **Stream errors append to text**: Visible as `\n\n[ERROR] message` in review panel.
- **Line highlight auto-clears**: After 3 seconds — expected behavior, not a bug.
- **Build warnings**: `themeColor` metadata warning — ignore, doesn't affect functionality.
