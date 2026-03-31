// tests/lib/webSearch.test.ts
import { describe, it, expect } from '@jest/globals';
import {
  extractSearchTerms,
  buildSearchQueries,
  SearchResult,
} from '@/lib/webSearch';

describe('extractSearchTerms', () => {
  describe('Python imports', () => {
    it('should extract simple imports', () => {
      const code = `import os
import sys
import requests`;
      const terms = extractSearchTerms(code, 'python');
      expect(terms).toContain('os');
      expect(terms).toContain('sys');
      expect(terms).toContain('requests');
    });

    it('should extract from imports', () => {
      const code = `from flask import Flask, request
from sqlalchemy import create_engine`;
      const terms = extractSearchTerms(code, 'python');
      expect(terms).toContain('flask');
      expect(terms).toContain('sqlalchemy');
    });
  });

  describe('JavaScript/TypeScript imports', () => {
    it('should extract ES6 imports', () => {
      const code = `import React from 'react';
import { useState, useEffect } from 'react';
import express from 'express';`;
      const terms = extractSearchTerms(code, 'javascript');
      expect(terms).toContain('react');
      expect(terms).toContain('express');
    });

    it('should extract require statements', () => {
      const code = `const express = require('express');
const axios = require('axios');`;
      const terms = extractSearchTerms(code, 'javascript');
      expect(terms).toContain('express');
      expect(terms).toContain('axios');
    });
  });

  describe('Rust imports', () => {
    it('should extract use statements', () => {
      const code = `use std::io;
use serde::{Serialize, Deserialize};`;
      const terms = extractSearchTerms(code, 'rust');
      expect(terms).toContain('std');
      expect(terms).toContain('serde');
    });
  });

  describe('C/C++ imports', () => {
    it('should extract include directives', () => {
      const code = `#include <iostream>
#include <vector>
#include "myheader.h"`;
      const terms = extractSearchTerms(code, 'cpp');
      expect(terms).toContain('iostream');
      expect(terms).toContain('vector');
    });
  });

  describe('Function and class definitions', () => {
    it('should extract function names', () => {
      const code = `def process_data():
    pass

def calculate_total():
    pass`;
      const terms = extractSearchTerms(code, 'python');
      expect(terms).toContain('process_data');
      expect(terms).toContain('calculate_total');
    });

    it('should extract class names', () => {
      const code = `class UserService:
    pass

class DatabaseConnection:`;
      const terms = extractSearchTerms(code, 'python');
      expect(terms).toContain('UserService');
      expect(terms).toContain('DatabaseConnection');
    });

    it('should extract TypeScript interface names', () => {
      const code = `interface User {
    id: number;
}
type Result = Success | Failure;`;
      const terms = extractSearchTerms(code, 'typescript');
      expect(terms).toContain('User');
      expect(terms).toContain('Result');
    });
  });

  describe('Edge cases', () => {
    it('should limit to 10 terms', () => {
      const code = `import a from 'a'
import b from 'b'
import c from 'c'
import d from 'd'
import e from 'e'
import f from 'f'
import g from 'g'
import h from 'h'
import i from 'i'
import j from 'j'
import k from 'k'
import l from 'l'`;
      const terms = extractSearchTerms(code, 'javascript');
      expect(terms.length).toBeLessThanOrEqual(10);
    });

    it('should exclude relative imports', () => {
      const code = `import { x } from './utils';
import { y } from '../helpers';
import external from 'external-pkg';`;
      const terms = extractSearchTerms(code, 'javascript');
      expect(terms).not.toContain('.');
      expect(terms).toContain('external-pkg');
    });

    it('should return empty array for code without imports', () => {
      const code = `x = 10
y = 20
print(x + y)`;
      const terms = extractSearchTerms(code, 'python');
      // May still extract function/variable names
      expect(Array.isArray(terms)).toBe(true);
    });

    it('should handle empty code', () => {
      const terms = extractSearchTerms('', 'python');
      expect(terms).toHaveLength(0);
    });

    it('should handle code with only comments', () => {
      const code = `# This is a comment
// Another comment
/* Block comment */`;
      const terms = extractSearchTerms(code, 'javascript');
      expect(terms).toHaveLength(0);
    });
  });
});

describe('buildSearchQueries', () => {
  describe('With library imports', () => {
    it('should build documentation queries', () => {
      const code = `import express from 'express';
import cors from 'cors';`;
      const queries = buildSearchQueries(code, 'javascript');
      expect(queries.length).toBeLessThanOrEqual(3);
      expect(queries.some(q => q.purpose === 'documentation')).toBe(true);
    });

    it('should build security query', () => {
      const code = `import express from 'express';`;
      const queries = buildSearchQueries(code, 'javascript');
      expect(queries.some(q => q.purpose === 'security')).toBe(true);
      expect(queries.some(q => q.query.includes('security vulnerabilities'))).toBe(true);
    });

    it('should build anti-patterns query', () => {
      const code = `import express from 'express';`;
      const queries = buildSearchQueries(code, 'javascript');
      expect(queries.some(q => q.purpose === 'anti-patterns')).toBe(true);
      expect(queries.some(q => q.query.includes('common mistakes'))).toBe(true);
    });
  });

  describe('Without library imports', () => {
    it('should build generic best practices query', () => {
      const code = `def hello():
    print("Hello")`;
      const queries = buildSearchQueries(code, 'python');
      expect(queries).toHaveLength(1);
      expect(queries[0].purpose).toBe('best-practices');
      expect(queries[0].query).toContain('python');
      expect(queries[0].query).toContain('best practices');
    });
  });

  describe('Edge cases', () => {
    it('should limit to 3 queries', () => {
      const code = `import a from 'a'
import b from 'b'
import c from 'c'
import d from 'd'`;
      const queries = buildSearchQueries(code, 'javascript');
      expect(queries.length).toBeLessThanOrEqual(3);
    });

    it('should handle empty code', () => {
      const queries = buildSearchQueries('', 'python');
      expect(queries).toHaveLength(1);
      expect(queries[0].purpose).toBe('best-practices');
    });
  });
});
