# PHANTOM — AI Code Reviewer

Surgical-precision AI-powered code review tool that analyzes your code for security vulnerabilities, best practices, performance issues, and provides actionable feedback.

![PHANTOM](https://img.shields.io/badge/PHANTOM-Code%20Reviewer-00ff88?style=for-the-badge&logoColor=0a0a0a)

## Features

- **Multi-Agent Analysis** — Parallel security, best practices, performance, and code quality agents
- **Streaming Results** — Real-time analysis as AI generates findings
- **Smart Caching** — Instant repeat reviews (up to 3300x faster)
- **RAG-Enhanced Search** — Context-aware recommendations using OSV.dev security advisories
- **Judge Agent** — Intelligent filtering to remove low-signal findings
- **Inline Annotations** — Clickable severity dots in code gutter linking to issues
- **Progressive Disclosure** — Collapsible sections for clean review output
- **Line Reference Highlighting** — Click issues to highlight relevant code lines

## Quick Start

### Prerequisites

- Node.js 18+ 
- NVIDIA API Key (get from [build.nvidia.com](https://build.nvidia.com))

### Installation

```bash
# Clone the repository
git clone https://github.com/RehanSajid136602/Phantom-Code-Reviewer.git
cd Phantom-Code-Reviewer

# Install dependencies
npm install

# Create environment file
echo "NVIDIA_API_KEY=nvapi-your-key-here" > .env.local
```

### Development

```bash
# Start development server (Turbopack)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production

```bash
# Build for production
npm run build

# Start production server
npm start
```

## Usage Guide

### 1. Paste or Write Code

- Paste your code into the left panel
- Select the programming language from the dropdown (auto-detected by default)
- Supported languages: JavaScript, TypeScript, Python, Go, Rust, Java, C++, Ruby, PHP, SQL

### 2. Run Analysis

**Method A — Button**
- Click the **ANALYZE** button in the header

**Method B — Keyboard Shortcut**
- Press `Ctrl+Enter` (or `Cmd+Enter` on Mac)

### 3. Review Results

The review panel displays findings organized by severity:

| Severity | Color | Meaning |
|----------|-------|---------|
| **CRITICAL** | Red | Security vulnerabilities, potential crashes |
| **WARNING** | Yellow | Code smells, performance issues, best practice violations |
| **INFO** | Blue | Suggestions, improvements, educational notes |
| **PRAISE** | Green | Well-written code patterns, good practices |

### 4. Interactive Features

- **Click Issue Title** — Highlights corresponding code lines for 3 seconds
- **Click Gutter Dots** — Jump to specific issues in your code
- **Collapse Sections** — Click section headers to expand/collapse
- **Use Examples** — Click example buttons to load sample code

### 5. Understanding the Output

```
┌─────────────────────────────────────────────────┐
│ ■ SUMMARY                                       │
│ Concise overview of the review                  │
├─────────────────────────────────────────────────┤
│ ■ ISSUES (5)                                    │ ← Collapsible
│ ┌─ [CRITICAL] L12-14 — SQL Injection           │
│ │   Problem: Unsanitized user input in query   │
│ │   Fix: Use parameterized queries              │
│ └────────────────────────────────────────────── │
├─────────────────────────────────────────────────┤
│ ■ VERDICT                                       │
│ ┌─ SCORE: 6/10                                  │
│ │ Overall code quality assessment              │
└─────────────────────────────────────────────────┘
```

## Configuration

### Environment Variables

Create a `.env.local` file in the project root:

```bash
# Required
NVIDIA_API_KEY=nvapi-your-api-key

# Optional - Custom model (default: meta/llama-3.1-405b-instruct)
NVIDIA_MODEL=meta/llama-3.1-405b-instruct
```

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server with Turbopack |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run type-check` | TypeScript check without emit |

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         page.tsx                            │
│              (orchestrates state & components)             │
└─────────────────────────────────────────────────────────────┘
                              │
         ┌────────────────────┼────────────────────┐
         │                    │                    │
         v                    v                    v
┌─────────────────┐  ┌───────────────┐  ┌─────────────────┐
│   CodePanel     │  │  ReviewPanel  │  │  StatusBar      │
│  (input/edit)   │  │  (output)     │  │  (metadata)     │
└─────────────────┘  └───────────────┘  └─────────────────┘
                              │
                              v
                    ┌─────────────────┐
                    │   API Route     │
                    │ /api/review     │
                    └─────────────────┘
                              │
         ┌────────────────────┼────────────────────┐
         │                    │                    │
         v                    v                    v
    ┌─────────┐       ┌────────────┐       ┌───────────┐
    │ Cache   │──────▶│ RAG Search │──────▶│   Agents  │
    │ (hit)   │       │ (context)  │       │ (analyze) │
    └─────────┘       └────────────┘       └───────────┘
                                                      │
                                      ┌───────────────┼───────────────┐
                                      │               │               │
                                      v               v               v
                                ┌──────────┐   ┌──────────┐   ┌──────────┐
                                │Security  │   │Quality   │   │Performance
                                │Agent     │   │Agent     │   │Agent     │
                                └──────────┘   └──────────┘   └──────────┘
                                                      │
                                                      v
                                            ┌─────────────────┐
                                            │  Judge Agent    │
                                            │ (filter/dedup) │
                                            └─────────────────┘
                                                      │
                                                      v
                                            ┌─────────────────┐
                                            │ Stream Response │
                                            └─────────────────┘
```

## API

### POST /api/review

Analyzes code and streams review results.

**Request:**
```json
{
  "code": "const query = `SELECT * FROM users WHERE id = ${userId}`",
  "language": "javascript"
}
```

**Response:** `text/plain` stream

```markdown
■ SUMMARY
The code contains a critical SQL injection vulnerability...

■ ISSUES
[CRITICAL] L1 — SQL Injection Vulnerability
Problem: User input directly interpolated into SQL query...
Fix: Use parameterized queries...
[WARNING] L1 — Hardcoded Credentials
Problem: ...

■ VERDICT
SCORE: 3/10 — Significant security issues require immediate attention.
```

## Troubleshooting

### Favicon Not Showing

Hard refresh your browser: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)

### API Errors

1. Check your `NVIDIA_API_KEY` is set in `.env.local`
2. Verify the key is valid at [build.nvidia.com](https://build.nvidia.com)
3. Check server logs for detailed error messages

### Slow First Review

- First review may take 30-90 seconds (cold start)
- Subsequent reviews of similar code are instant (caching)
- Check status bar for streaming progress

### No Issues Found

- This is good! Your code may be clean
- Try with example code to verify the system works
- Check if the Judge Agent filtered all findings

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS v4
- **AI**: NVIDIA NIM (Llama 3.1 405B)
- **State**: Zustand + React hooks
- **Testing**: Jest + React Testing Library

## License

MIT

---

Built with ⚡ by [Rehan Sajid](https://github.com/RehanSajid136602)
