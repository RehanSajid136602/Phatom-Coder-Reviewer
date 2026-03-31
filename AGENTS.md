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

### Error Handling
- **API routes**: Return proper HTTP status codes with JSON error bodies.
- **Web search is non-fatal**: `lib/webSearch.ts` catches all DuckDuckGo errors silently — review continues without search context. Never throw on search failure.
- **Stream errors**: In-stream errors from NVIDIA NIM are appended as `\n\n[ERROR] message` to streamed text.
- **Client errors**: Non-2xx responses from `/api/review` display as `■ ERROR` in the review panel — not as toast/alert.

## Architecture

- `app/page.tsx` — Client component (`'use client'`), orchestrates all state. NOT a server component.
- `app/api/review/route.ts` — POST endpoint. Calls NVIDIA NIM API via raw fetch with streaming. Requires `NVIDIA_API_KEY`.
- `lib/webSearch.ts` — DuckDuckGo HTML scraping for context gathering.
- `lib/parseReview.ts` — Parses streamed AI output into sections. Handles AI typos (e.g., `'ISSUUES'`).
- `lib/detectLanguage.ts` — Regex scoring system for language detection.
- `lib/agents.ts` — Multi-agent orchestration logic.
- `hooks/useAgentStream.ts` — Custom hook for streaming state management.

## Non-Obvious Patterns

- **Streaming**: API route returns `ReadableStream` with `text/plain` (NOT `text/event-stream`). Client reads via `response.body.getReader()` with `TextDecoder`.
- **Line highlighting auto-clears**: `page.tsx` uses `setTimeout(() => setHighlightedLines(new Set()), 3000)` — don't add manual clear logic.
- **CSS variables → Tailwind**: Colors defined as `:root` custom properties, mapped via `@theme inline`. Use Tailwind classes (`bg-bg-surface`, `text-accent-green`), not raw CSS variables.
- **Font injection**: `DM_Mono` and `Instrument_Serif` via `next/font/google` with CSS variables. Reference as `font-mono` and `font-serif`.
- **Hydration quirk**: Disabled button renders `disabled={null}` on SSR, `disabled={true}` on client with empty code. Known React 19 behavior — not a bug.
- **Path alias**: `@/*` maps to project root.
- **No navbar/footer**: Full-viewport split layout. Header is 48px, status bar is 32px.

## Testing

- Test files live in `tests/` mirroring source structure: `tests/lib/`, `tests/components/`, `tests/hooks/`, `tests/api/`.
- File naming: `*.test.ts` or `*.test.tsx`.
- Jest config in `jest.config.js` — uses ts-jest with jsdom environment.
- Setup file: `tests/setup.ts` — mocks TextEncoder/TextDecoder, ReadableStream, IntersectionObserver, ResizeObserver, navigator.clipboard.
- Coverage threshold: 50% across branches, functions, lines, statements.

## Environment

```bash
# Required in .env.local
NVIDIA_API_KEY=nvapi-...   # Get from https://build.nvidia.com
```
