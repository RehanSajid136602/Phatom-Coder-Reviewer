# PHANTOM — 9/10 Improvement Plan

## Current Score: 7.5/10
## Target Score: 9/10

---

## Gap Analysis

| Category | Current | Target | Delta |
|----------|---------|--------|-------|
| Concept | 9/10 | 9/10 | ✅ |
| UI/UX | 8/10 | 9/10 | +1 |
| Tech Stack | 8/10 | 9/10 | +1 |
| Architecture | 7/10 | 9/10 | +2 |
| Code Quality | 7/10 | 9/10 | +2 |
| DX | 6/10 | 9/10 | +3 |

---

## Phase 1: DX Foundation (Quick Wins)
**Impact: +3 DX points**

### 1.1 Fix Jest Configuration
- **File**: `jest.config.js`
- **Issue**: Test runner not properly configured
- **Fix**: Update transform, moduleNameMapper for Next.js 16 + Tailwind v4

### 1.2 Add Environment Template
- **File**: `.env.local.example`
- **Content**: `NVIDIA_API_KEY=your-key-here`
- **Add to .gitignore**: Ensure .env is ignored

### 1.3 Add Type-Check Script
- **File**: `package.json`
- **Add**: `"type-check": "tsc --noEmit"`

---

## Phase 2: Code Quality
**Impact: +2 Code Quality points**

### 2.1 Add React Error Boundaries
- **New File**: `components/ErrorBoundary.tsx`
- **Purpose**: Catch render errors, show fallback UI
- **Wrap**: CodePanel and ReviewPanel

### 2.2 Improve API Error Types
- **File**: `types/review.ts`
- **Add**: `ApiError` type with codes (INVALID_BODY, RATE_LIMIT, etc.)
- **File**: `app/api/review/route.ts` — use typed errors

### 2.3 Input Sanitization
- **File**: `app/api/review/route.ts`
- **Add**: Sanitize code input before sending to agents
- **Purpose**: Prevent prompt injection

---

## Phase 3: Architecture
**Impact: +2 Architecture points**

### 3.1 Add Rate Limiting
- **File**: `app/api/review/route.ts`
- **Implementation**: In-memory rate limiter (requests per minute)
- **Limit**: 10 requests/minute per IP

### 3.2 Refactor Agents Module
- **Current**: `lib/agents.ts` (25KB monolithic)
- **Target**: Modular structure
  ```
  lib/agents/
    index.ts       # exports
    security.ts    # callSecurityScanner
    quality.ts     # callQualityReviewer
    language.ts    # callLanguageSpecialist
    merger.ts      # callMergerAgent
    types.ts       # shared types
  ```

### 3.3 Add Request Validation Middleware
- **File**: `lib/middleware/validateRequest.ts`
- **Purpose**: Reusable validation for API routes

---

## Phase 4: UI/UX Polish
**Impact: +1 UI/UX point**

### 4.1 Add Skeleton Loaders
- **File**: `components/CodePanel.tsx`
- **Add**: Loading skeleton when code is empty
- **File**: `components/ReviewPanel.tsx`
- **Add**: Streaming skeleton during analysis

### 4.2 Keyboard Shortcuts Modal
- **New File**: `components/KeyboardShortcuts.tsx`
- **Shortcuts**:
  - `Cmd/Ctrl + Enter` — Analyze code
  - `Cmd/Ctrl + /` — Show shortcuts
  - `Escape` — Clear/close modals

### 4.3 Improve Animations
- **File**: `app/globals.css`
- **Add**: Smooth easing curves for transitions
- **Refine**: Framer Motion variants

---

## Phase 5: Tech Stack Optimization
**Impact: +1 Tech Stack point**

### 5.1 Bundle Analysis
- **Add**: `npm run analyze` script with @next/bundle-analyzer
- **Goal**: Identify large dependencies

### 5.2 Lucide Icon Optimization
- **File**: `components/*.tsx`
- **Change**: Import only needed icons
- **Before**: `import { Zap } from 'lucide-react'`
- **After**: `import Zap from 'lucide-react/dist/esm/icons/zap'`

---

## Execution Order

```
Phase 1 (Foundation)
├── 1.1 Fix Jest Config
├── 1.2 Add .env.local.example
└── 1.3 Add type-check script

Phase 2 (Code Quality)
├── 2.1 Add Error Boundaries
├── 2.2 Improve Error Types
└── 2.3 Input Sanitization

Phase 3 (Architecture)
├── 3.1 Add Rate Limiting
├── 3.2 Refactor Agents
└── 3.3 Add Validation Middleware

Phase 4 (UI/UX)
├── 4.1 Add Skeletons
├── 4.2 Keyboard Modal
└── 4.3 Improve Animations

Phase 5 (Performance)
├── 5.1 Bundle Analysis
└── 5.2 Icon Optimization
```

---

## Success Metrics

- [ ] `npm test` runs successfully
- [ ] `npm run type-check` passes with zero errors
- [ ] `.env.local.example` exists and is documented
- [ ] Error boundaries catch and display fallback UI
- [ ] API returns typed errors with codes
- [ ] Rate limiting blocks excessive requests
- [ ] Agents module is modular and maintainable
- [ ] Skeleton loaders display during loading states
- [ ] Keyboard shortcuts modal works
- [ ] Bundle size reduced by 20%

---

## Estimated Timeline

- **Phase 1**: 30 minutes (quick wins)
- **Phase 2**: 1 hour
- **Phase 3**: 2 hours
- **Phase 4**: 1 hour
- **Phase 5**: 30 minutes

**Total**: ~5 hours

---

## Notes

- All changes should maintain backward compatibility
- No breaking changes to API contract
- Preserve existing functionality while adding robustness
- Test each phase before moving to next