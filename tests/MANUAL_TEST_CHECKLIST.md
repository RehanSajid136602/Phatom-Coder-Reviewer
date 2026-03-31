# PHANTOM AI Code Reviewer - Manual Testing Checklist

## Test Environment Setup
- [ ] Ensure `.env.local` has `NVIDIA_API_KEY` set
- [ ] Run `npm run dev` to start development server
- [ ] Open http://localhost:3000 in browser

---

## UI Component Tests

### CodePanel
- [ ] Empty state shows "Paste or type your code here..." placeholder
- [ ] Typing in textarea updates character and line count
- [ ] Language dropdown shows all 9 languages
- [ ] Selecting language updates dropdown value
- [ ] Tab key inserts 2 spaces (doesn't change focus)
- [ ] Line numbers scroll synchronously with code
- [ ] Highlighted lines show green background and border
- [ ] Clicking example buttons loads code into editor

### ReviewPanel
- [ ] Empty state shows "AWAITING INPUT" message
- [ ] Example buttons are visible and clickable
- [ ] SUMMARY section renders with serif font
- [ ] ISSUES section shows severity badges (CRITICAL/WARNING/INFO/PRAISE)
- [ ] Line reference chips (L12, L3-5) are clickable
- [ ] Clicking line ref highlights code for 3 seconds
- [ ] SUGGESTIONS section shows code blocks with syntax label
- [ ] Code blocks have COPY button
- [ ] Copy button changes to COPIED after clicking
- [ ] VERDICT section shows animated score (0→N)
- [ ] Streaming cursor blinks during analysis

### StatusBar
- [ ] Shows "multi-agent" model name
- [ ] Token count updates during streaming
- [ ] Shows streaming indicator when analyzing
- [ ] Shows completion state after analysis

### AgentProgress
- [ ] Shows 3 agents: Security, Quality, Language
- [ ] Agents transition: pending → running → complete/failed
- [ ] Merger agent shows after individual agents complete
- [ ] Progress panel collapses when content starts streaming

---

## Language Detection Tests

### Python
- [ ] `def function():` → Python
- [ ] `import os` → Python
- [ ] `class MyClass:` → Python
- [ ] `if __name__ == "__main__":` → Python

### JavaScript
- [ ] `function test() {}` → JavaScript
- [ ] `const x = 10` → JavaScript
- [ ] `const fn = () => {}` → JavaScript
- [ ] `require('express')` → JavaScript

### TypeScript
- [ ] `function test(x: number): number` → TypeScript
- [ ] `interface User {}` → TypeScript
- [ ] `type Result = A | B` → TypeScript
- [ ] `const x: string = "test"` → TypeScript

### Other Languages
- [ ] `fn main() {}` → Rust
- [ ] `func main() {}` → Go
- [ ] `#include <iostream>` → C++
- [ ] `SELECT * FROM users` → SQL
- [ ] `#!/bin/bash` → Bash

### Edge Cases
- [ ] Empty string → Other
- [ ] Plain text → Other
- [ ] Mixed Python + SQL → Python (def wins)
- [ ] TypeScript with type annotations → TypeScript

---

## API Endpoint Tests

### Input Validation
- [ ] Empty body → 400 INVALID_BODY
- [ ] Invalid JSON → 400 INVALID_BODY
- [ ] Missing code field → 400 INVALID_CODE_TYPE
- [ ] Non-string code → 400 INVALID_CODE_TYPE
- [ ] Empty code → 400 EMPTY_CODE
- [ ] Whitespace-only code → 400 EMPTY_CODE
- [ ] Code > 50000 chars → 400 CODE_TOO_LONG
- [ ] Missing language → 400 INVALID_LANGUAGE
- [ ] Invalid language → 400 INVALID_LANGUAGE

### API Key Validation
- [ ] Missing NVIDIA_API_KEY → 500 INVALID_API_KEY
- [ ] Placeholder key → 500 INVALID_API_KEY
- [ ] Too short key → 500 INVALID_API_KEY
- [ ] Valid key format → Proceeds to API call

### Valid Languages
- [ ] python → Accepted
- [ ] javascript → Accepted
- [ ] typescript → Accepted
- [ ] rust → Accepted
- [ ] go → Accepted
- [ ] cpp → Accepted
- [ ] sql → Accepted
- [ ] bash → Accepted
- [ ] other → Accepted

### Response Format
- [ ] Success → 200 with text/event-stream
- [ ] Error → JSON with error and code fields
- [ ] Cache-Control: no-cache header present
- [ ] Connection: keep-alive header present

---

## Streaming Behavior Tests

### SSE Events
- [ ] agent_complete event updates agent status
- [ ] agent_failed event shows error state
- [ ] merger_start event shows merger running
- [ ] merger_chunk event appends to streamed text
- [ ] review_complete event sets score and completion

### Stream Parsing
- [ ] Valid JSON events parsed correctly
- [ ] Malformed JSON treated as raw text
- [ ] Non-JSON content accumulated
- [ ] Stream completes gracefully

### Error Handling
- [ ] Network error shows ERROR section
- [ ] API error shows error message
- [ ] Timeout handled gracefully
- [ ] AbortController cancels request

---

## Error Handling Tests

### Missing API Key
- [ ] Clear error message shown
- [ ] Link to NVIDIA API portal mentioned
- [ ] No crash or undefined behavior

### Network Failures
- [ ] Offline state handled
- [ ] DNS failure handled
- [ ] Connection timeout handled
- [ ] SSL certificate error handled

### API Errors
- [ ] 401 Unauthorized → Clear message
- [ ] 429 Rate Limit → Retry suggestion
- [ ] 500 Server Error → Retry suggestion
- [ ] 503 Service Unavailable → Retry suggestion

### Timeouts
- [ ] Agent timeout (120s) handled
- [ ] Merger timeout (300s) handled
- [ ] Fetch timeout handled
- [ ] No hanging requests

---

## Web Search Tests

### Search Term Extraction
- [ ] Python imports extracted
- [ ] JavaScript ES6 imports extracted
- [ ] require() statements extracted
- [ ] Rust use statements extracted
- [ ] C++ #include extracted
- [ ] Function names extracted
- [ ] Class names extracted
- [ ] Limited to 10 terms

### Query Building
- [ ] Documentation queries generated
- [ ] Security queries generated
- [ ] Anti-pattern queries generated
- [ ] Limited to 3 queries
- [ ] Generic query for no imports

### DuckDuckGo Integration
- [ ] Search results returned
- [ ] Rate limiting handled
- [ ] Empty results handled gracefully
- [ ] Search failure non-fatal

---

## Parse Review Tests

### Section Parsing
- [ ] SUMMARY section parsed
- [ ] ISSUES section parsed
- [ ] SUGGESTIONS section parsed
- [ ] VERDICT section parsed
- [ ] Case-insensitive headers

### Issue Parsing
- [ ] CRITICAL severity parsed
- [ ] WARNING severity parsed
- [ ] INFO severity parsed
- [ ] PRAISE severity parsed
- [ ] Single line refs (L12) parsed
- [ ] Line ranges (L10-15) parsed
- [ ] "Line" prefix handled

### Edge Cases
- [ ] Empty input → Empty result
- [ ] NO_ISSUES → Empty issues array
- [ ] "ISSUUES" typo handled
- [ ] Missing score → 0
- [ ] Decimal score → Integer
- [ ] Sections in any order
- [ ] Special characters preserved
- [ ] Unicode preserved

---

## Line Highlighting Tests

### Single Lines
- [ ] L1 highlights line 1
- [ ] L12 highlights line 12
- [ ] L999 highlights line 999

### Line Ranges
- [ ] L1-5 highlights lines 1,2,3,4,5
- [ ] L10-15 highlights lines 10-15
- [ ] L1–5 (en-dash) works

### Timing
- [ ] Highlight appears immediately
- [ ] Highlight auto-clears after 3 seconds
- [ ] Multiple highlights work

### Visual
- [ ] Green background on line
- [ ] Green left border
- [ ] Line number turns green

---

## Keyboard Shortcuts Tests

### Cmd/Ctrl + Enter
- [ ] Triggers analysis
- [ ] Prevents default form submission
- [ ] Disabled when no code
- [ ] Disabled during streaming

### Tab Key
- [ ] Inserts 2 spaces in code editor
- [ ] Doesn't change focus
- [ ] Works at line start
- [ ] Works at line end
- [ ] Works with selection

---

## Accessibility Tests

### Screen Reader
- [ ] Code textarea has label
- [ ] Language selector has label
- [ ] Buttons have accessible names
- [ ] Sections have proper headings

### Keyboard Navigation
- [ ] Tab cycles through interactive elements
- [ ] Enter activates buttons
- [ ] Escape closes nothing (no modals)
- [ ] Focus visible on all elements

### ARIA
- [ ] No ARIA violations
- [ ] Live regions for streaming content
- [ ] Status updates announced

---

## Performance Tests

### Large Code
- [ ] 50000 characters accepted
- [ ] 10000 lines handled
- [ ] No UI lag when typing
- [ ] Scroll performance smooth

### Large Review Output
- [ ] 100 issues rendered
- [ ] Long code blocks rendered
- [ ] Streaming stays responsive
- [ ] Auto-scroll doesn't lag

### Memory
- [ ] No memory leaks on repeated analysis
- [ ] Aborted streams cleaned up
- [ ] Event listeners removed on unmount

---

## Browser Compatibility Tests

### Desktop
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)

### Mobile
- [ ] Chrome Mobile
- [ ] Safari iOS
- [ ] Responsive layout works

---

## Edge Case Scenarios

### Code Edge Cases
- [ ] Only comments
- [ ] Only whitespace
- [ ] Only special characters
- [ ] Only unicode
- [ ] Null bytes
- [ ] Very long single line
- [ ] Mixed line endings (\n, \r\n)

### Network Edge Cases
- [ ] Slow connection (throttled)
- [ ] Intermittent connection
- [ ] Proxy environment
- [ ] CORS headers

### User Behavior Edge Cases
- [ ] Rapid example clicking
- [ ] Multiple concurrent analyses
- [ ] Paste during streaming
- [ ] Language change during streaming
- [ ] Close tab during analysis

---

## Security Tests

### Input Sanitization
- [ ] XSS in code blocked
- [ ] Script tags in code escaped
- [ ] Event handlers blocked

### API Security
- [ ] API key not exposed to client
- [ ] Rate limiting effective
- [ ] Request size limited

---

## Notes and Issues

| Issue | Severity | Steps to Reproduce | Expected | Actual |
|-------|----------|-------------------|----------|--------|
|       |          |                   |          |        |

---

## Test Completion

- [ ] All UI tests passed
- [ ] All API tests passed
- [ ] All edge cases tested
- [ ] All browsers tested
- [ ] Performance acceptable
- [ ] No critical bugs found
- [ ] Ready for production

**Test Date:** _______________
**Tester:** _______________
**Build Version:** _______________
