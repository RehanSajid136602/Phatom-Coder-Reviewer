export type Language = 'python' | 'javascript' | 'typescript' | 'rust' | 'go' | 'cpp' | 'sql' | 'bash' | 'other';

const languagePatterns: { lang: Language; patterns: RegExp[] }[] = [
  {
    lang: 'python',
    patterns: [
      /\bdef\s+\w+\s*\(/,
      /\bimport\s+\w+/,
      /\bfrom\s+\w+\s+import/,
      /\bclass\s+\w+.*:/,
      /\bif\s+__name__\s*==\s*['"]__main__['"]/,
    ],
  },
  {
    lang: 'javascript',
    patterns: [
      /\bfunction\s+\w+\s*\(/,
      /\bconst\s+\w+\s*=/,
      /\blet\s+\w+\s*=/,
      /\bvar\s+\w+\s*=/,
      /=>\s*\{/,
      /\brequire\s*\(/,
    ],
  },
  {
    lang: 'typescript',
    patterns: [
      /:\s*(string|number|boolean|any|void|never)\b/,
      /interface\s+\w+/,
      /type\s+\w+\s*=/,
      /<\w+>/,
      /as\s+(string|number|any)/,
    ],
  },
  {
    lang: 'rust',
    patterns: [
      /\bfn\s+\w+\s*\(/,
      /\blet\s+mut\s+/,
      /\bimpl\s+\w+/,
      /\bpub\s+fn/,
      /\buse\s+\w+::/,
      /\bmatch\s+\w+\s*\{/,
    ],
  },
  {
    lang: 'go',
    patterns: [
      /\bfunc\s+\w+\s*\(/,
      /\bpackage\s+\w+/,
      /\bimport\s*\(/,
      /\bfmt\.\w+/,
      /\b:=\s/,
      /\bgo\s+func/,
    ],
  },
  {
    lang: 'cpp',
    patterns: [
      /#include\s*</,
      /\bstd::/,
      /\bcout\s*<</,
      /\bcin\s*>>/,
      /\bint\s+main\s*\(/,
      /\btemplate\s*</,
    ],
  },
  {
    lang: 'sql',
    patterns: [
      /\bSELECT\s+/i,
      /\bFROM\s+\w+/i,
      /\bWHERE\s+/i,
      /\bINSERT\s+INTO/i,
      /\bCREATE\s+TABLE/i,
      /\bJOIN\s+\w+/i,
    ],
  },
  {
    lang: 'bash',
    patterns: [
      /^#!/,
      /\becho\s+/,
      /\bif\s+\[\s+/,
      /\bfor\s+\w+\s+in\b/,
      /\|\s*grep\b/,
      /\$\{?\w+\}?/,
    ],
  },
];

export function detectLanguage(code: string): Language {
  const scores: Record<Language, number> = {
    python: 0,
    javascript: 0,
    typescript: 0,
    rust: 0,
    go: 0,
    cpp: 0,
    sql: 0,
    bash: 0,
    other: 0,
  };

  for (const { lang, patterns } of languagePatterns) {
    for (const pattern of patterns) {
      if (pattern.test(code)) {
        scores[lang]++;
      }
    }
  }

  const tsJsCode = code.match(/:\s*(string|number|boolean|any|void|never|interface|type|<\w+>|as\s+)/);
  if (tsJsCode && scores.typescript > 0) {
    scores.typescript += tsJsCode.length;
  }

  let maxScore = 0;
  let detectedLang: Language = 'other';

  for (const [lang, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      detectedLang = lang as Language;
    }
  }

  return maxScore > 0 ? detectedLang : 'other';
}

export function getLanguageLabel(lang: Language): string {
  const labels: Record<Language, string> = {
    python: 'Python',
    javascript: 'JavaScript',
    typescript: 'TypeScript',
    rust: 'Rust',
    go: 'Go',
    cpp: 'C++',
    sql: 'SQL',
    bash: 'Bash',
    other: 'Other',
  };
  return labels[lang];
}
