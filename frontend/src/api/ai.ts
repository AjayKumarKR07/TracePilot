/**
 * AI Testing Assistant API client for TracePilot.
 *
 * Uses the existing apiClient (Axios instance with JWT interceptors).
 * All requests go to the backend — the Gemini API key is NEVER exposed here.
 */

import { apiClient } from './client';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  message: string;
  conversation_id?: string;
  issue_id?: number;
  sprint_id?: number;
  conversation?: ConversationMessage[];
}

export interface ChatResponse {
  success: boolean;
  message: string;
  conversation_id: string;
  metadata: {
    model: string;
    issue_context_used: boolean;
    sprint_context_used: boolean;
    provider: string;
  };
}

export interface AnalyzeIssueRequest {
  issue_id: number;
}

export interface GenerateTestCasesRequest {
  description: string;
  issue_id?: number;
}

export interface ReproductionStepsRequest {
  description: string;
  issue_id?: number;
}

export interface RootCauseRequest {
  description: string;
  issue_id?: number;
}

export interface SprintSummaryRequest {
  sprint_id: number;
  additional_context?: string;
}

export interface ExplainMetricsRequest {
  question: string;
  metrics_context?: string;
}

export interface AIHealthResponse {
  ai_enabled: boolean;
  ai_provider: string;
  ai_model: string;
  api_key_configured: boolean;
  status: 'available' | 'disabled' | 'misconfigured';
}

// ─────────────────────────────────────────────────────────────────────────────
// API Functions
// ─────────────────────────────────────────────────────────────────────────────

export const aiApi = {
  /**
   * General AI chat with optional TracePilot context.
   */
  chat: async (data: ChatRequest): Promise<ChatResponse> => {
    const response = await apiClient.post<ChatResponse>('/ai/chat', data);
    return response.data;
  },

  /**
   * Structured analysis of a specific issue.
   */
  analyzeIssue: async (data: AnalyzeIssueRequest): Promise<ChatResponse> => {
    const response = await apiClient.post<ChatResponse>('/ai/analyze-issue', data);
    return response.data;
  },

  /**
   * Generate structured test cases.
   */
  generateTestCases: async (data: GenerateTestCasesRequest): Promise<ChatResponse> => {
    const response = await apiClient.post<ChatResponse>('/ai/generate-test-cases', data);
    return response.data;
  },

  /**
   * Generate detailed reproduction steps.
   */
  reproductionSteps: async (data: ReproductionStepsRequest): Promise<ChatResponse> => {
    const response = await apiClient.post<ChatResponse>('/ai/reproduction-steps', data);
    return response.data;
  },

  /**
   * Root cause analysis.
   */
  rootCause: async (data: RootCauseRequest): Promise<ChatResponse> => {
    const response = await apiClient.post<ChatResponse>('/ai/root-cause', data);
    return response.data;
  },

  /**
   * AI sprint summary and analysis.
   */
  sprintSummary: async (data: SprintSummaryRequest): Promise<ChatResponse> => {
    const response = await apiClient.post<ChatResponse>('/ai/sprint-summary', data);
    return response.data;
  },

  /**
   * Explain analytics metrics in plain language.
   */
  explainMetrics: async (data: ExplainMetricsRequest): Promise<ChatResponse> => {
    const response = await apiClient.post<ChatResponse>('/ai/explain-metrics', data);
    return response.data;
  },

  /**
   * Check AI service health.
   */
  health: async (): Promise<AIHealthResponse> => {
    const response = await apiClient.get<AIHealthResponse>('/ai/health');
    return response.data;
  },
};
