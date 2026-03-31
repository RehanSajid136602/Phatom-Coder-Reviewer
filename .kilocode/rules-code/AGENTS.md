# Code Mode Rules

## Non-Obvious Coding Patterns

- **Streaming responses**: API route returns `ReadableStream` with `text/plain` content type (NOT `text/event-stream`). Client reads via `response.body.getReader()` with `TextDecoder`.
- **Web search is non-fatal**: `lib/webSearch.ts` DuckDuckGo scraping failures are caught and logged — review continues without search context. Never throw on search failure.
- **Line highlighting auto-clears**: `page.tsx` uses `setTimeout(() => setHighlightedLines(new Set()), 3000)` — don't add manual clear logic.
- **CSS variables → Tailwind**: Colors defined as `:root` custom properties, then mapped via `@theme inline` in `globals.css`. Use Tailwind classes (`bg-bg-surface`, `text-accent-green`), not raw CSS variables.
- **Font injection**: `DM_Mono` and `Instrument_Serif` loaded via `next/font/google` with CSS variable injection in `layout.tsx`. Reference as `font-mono` and `font-serif` in Tailwind.
- **parseReview.ts handles AI typos**: Has `'ISSUUES'` case in the section parser to handle AI misspelling of "ISSUES".
- **Language detection scoring**: `detectLanguage.ts` uses regex scoring with TypeScript bonus — type annotations boost TS score over JS.
- **No test framework**: `npm test` does not exist. Don't create test files expecting a runner.
- **Path alias**: `@/*` maps to project root. Use `@/lib/webSearch` not `../../lib/webSearch`.
