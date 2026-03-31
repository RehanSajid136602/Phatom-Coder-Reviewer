# Debug Mode Rules

## Non-Obvious Debugging Patterns

- **API errors surface in review panel**: Non-2xx responses from `/api/review` are caught in `page.tsx` and displayed as `■ ERROR` in the review panel — not as toast/alert.
- **Web search failures are silent**: `lib/webSearch.ts` catches all DuckDuckGo errors and logs to console — review continues without search context. Check server logs, not client.
- **Stream errors append to text**: In-stream errors from NVIDIA NIM are appended as `\n\n[ERROR] message` to the streamed text — visible in review panel.
- **Hydration mismatch on disabled button**: SSR renders `disabled={null}`, client renders `disabled={true}` when code is empty. This is a known React 19 hydration quirk — not a bug.
- **Line highlight auto-clears**: Highlighted lines clear after 3 seconds via `setTimeout` — if highlighting "disappears", this is expected behavior, not a bug.
- **No test framework**: `npm test` does not exist. Don't try to run tests.
- **TypeScript strict mode**: `npx tsc --noEmit` is the type-check command. Build uses Turbopack (`next dev`), not Webpack.
