// types/review.ts

export type AgentName = 'security' | 'quality' | 'language';

export type AgentStatus = 'pending' | 'running' | 'complete' | 'failed' | 'timeout';

export type ConfidenceScore = 1 | 2 | 3 | 4 | 5;

export interface AgentResult {
  success: boolean;
  content: string;
  agent: AgentName;
  duration: number;
  error?: string;
}

export interface JudgeResult {
  success: boolean;
  content: string;
  duration: number;
  filteredCount: number;
  totalBeforeFilter: number;
  error?: string;
}

export interface MergerInput {
  agent1: string;
  agent2: string;
  agent3: string;
}

export interface PipelineStatus {
  security: AgentStatus;
  quality: AgentStatus;
  language: AgentStatus;
  merger: AgentStatus;
  judge: AgentStatus;
}

export interface AgentConfig {
  name: AgentName;
  model: string;
  fallbackModel: string;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
  complexityThreshold?: number;
}

export interface CacheEntry {
  value: string;
  timestamp: number;
  ttl: number;
  modelVersion: string;
}

export interface RAGResult {
  query: string;
  results: RAGDocument[];
  source: string;
}

export interface RAGDocument {
  title: string;
  url: string;
  snippet: string;
  relevanceScore: number;
  source: 'documentation' | 'security' | 'stackoverflow' | 'changelog';
}

export interface IssueWithConfidence {
  severity: 'CRITICAL' | 'WARNING' | 'INFO' | 'PRAISE';
  line: string;
  title: string;
  explanation: string;
  confidence: ConfidenceScore;
}

// API Error Types
export type ApiErrorCode =
  | 'INVALID_BODY'
  | 'INVALID_CODE_TYPE'
  | 'EMPTY_CODE'
  | 'CODE_TOO_LONG'
  | 'INVALID_LANGUAGE'
  | 'INVALID_API_KEY'
  | 'RATE_LIMITED'
  | 'AGENT_FAILED'
  | 'INTERNAL_ERROR';

export interface ApiError {
  code: ApiErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

export interface ErrorResponse {
  error: string;
  code: ApiErrorCode;
}
