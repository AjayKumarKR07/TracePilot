import { apiClient } from './client';
import type {
  DeveloperAnalyticsResponse,
  DeveloperMatchResponse,
  IssueStatusDistributionResponse,
  IssueTrendResponse,
  PlotlyChartsData,
  PriorityCalcRequest,
  PriorityCalcResponse,
  ProjectAnalyticsListResponse,
  ProjectAnalyticsResponse,
  QualityMetricsResponse,
  SeverityDistributionResponse,
  PriorityDistributionResponse,
  SystemAnalyticsResponse,
  AnalyticsReportDataResponse,
  DefectTrendsHistoryResponse,
} from '../types/analytics';
import type { IssueStatus, Severity } from '../types/issue';

export interface AnalyticsFilterParams {
  project_id?: number;
  start_date?: string;
  end_date?: string;
  include_test?: boolean;
}

export interface DefectTrendsHistoryParams {
  preset?: '7d' | '30d' | '90d' | 'custom' | string;
  start_date?: string;
  end_date?: string;
  project_id?: number;
  include_test?: boolean;
}

export interface TrendFilterParams extends AnalyticsFilterParams {
  interval?: 'day' | 'week' | 'month';
}

export interface ExportReportParams {
  project_id?: number;
  status?: IssueStatus;
  severity?: Severity;
  start_date?: string;
  end_date?: string;
}

export const analyticsApi = {
  getSystemOverview: async (params?: AnalyticsFilterParams): Promise<SystemAnalyticsResponse> => {
    const response = await apiClient.get<SystemAnalyticsResponse>(
      '/analytics/overview',
      { params }
    );
    return response.data;
  },

  getStatusDistribution: async (
    params?: AnalyticsFilterParams
  ): Promise<IssueStatusDistributionResponse> => {
    const response = await apiClient.get<IssueStatusDistributionResponse>(
      '/analytics/issues/status-distribution',
      { params }
    );
    return response.data;
  },

  getSeverityDistribution: async (
    params?: AnalyticsFilterParams
  ): Promise<SeverityDistributionResponse> => {
    const response = await apiClient.get<SeverityDistributionResponse>(
      '/analytics/issues/severity-distribution',
      { params }
    );
    return response.data;
  },

  getPriorityDistribution: async (
    params?: AnalyticsFilterParams
  ): Promise<PriorityDistributionResponse> => {
    const response = await apiClient.get<PriorityDistributionResponse>(
      '/analytics/issues/priority-distribution',
      { params }
    );
    return response.data;
  },

  getTrends: async (params?: TrendFilterParams): Promise<IssueTrendResponse> => {
    const response = await apiClient.get<IssueTrendResponse>(
      '/analytics/issues/trends',
      { params }
    );
    return response.data;
  },

  getAllProjectsAnalytics: async (): Promise<ProjectAnalyticsListResponse> => {
    const response = await apiClient.get<ProjectAnalyticsListResponse>(
      '/analytics/projects'
    );
    return response.data;
  },

  getProjectAnalytics: async (
    projectId: number,
    params?: AnalyticsFilterParams
  ): Promise<ProjectAnalyticsResponse> => {
    const response = await apiClient.get<ProjectAnalyticsResponse>(
      `/analytics/projects/${projectId}`,
      { params }
    );
    return response.data;
  },

  getDeveloperPerformance: async (params?: AnalyticsFilterParams): Promise<DeveloperAnalyticsResponse> => {
    const response = await apiClient.get<DeveloperAnalyticsResponse>(
      '/analytics/developers',
      { params }
    );
    return response.data;
  },

  exportIssuesCsv: async (params?: ExportReportParams): Promise<void> => {
    const response = await apiClient.get('/analytics/reports/issues/export', {
      params,
      responseType: 'blob',
    });
    const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tracepilot_issues_report_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  downloadReport: async (period: '1d' | '7d' | '30d'): Promise<AnalyticsReportDataResponse> => {
    const response = await apiClient.get<AnalyticsReportDataResponse>(
      '/analytics/report/download',
      { params: { period } }
    );
    return response.data;
  },

  getQualityMetrics: async (params?: { project_id?: number }): Promise<QualityMetricsResponse> => {
    const response = await apiClient.get<QualityMetricsResponse>(
      '/analytics/quality-metrics',
      { params }
    );
    return response.data;
  },

  getDefectTrendsHistory: async (
    params?: DefectTrendsHistoryParams
  ): Promise<DefectTrendsHistoryResponse> => {
    const response = await apiClient.get<DefectTrendsHistoryResponse>(
      '/analytics/defect-trends/history',
      { params }
    );
    return response.data;
  },

  calculatePriority: async (body: PriorityCalcRequest): Promise<PriorityCalcResponse> => {
    const response = await apiClient.post<PriorityCalcResponse>(
      '/issues/calculate-priority',
      body
    );
    return response.data;
  },

  suggestAssignee: async (issueId: number): Promise<DeveloperMatchResponse> => {
    const response = await apiClient.get<DeveloperMatchResponse>(
      `/issues/${issueId}/suggest-assignee`
    );
    return response.data;
  },

  getPlotlyCharts: async (): Promise<PlotlyChartsData> => {
    const response = await apiClient.get<PlotlyChartsData>('/analytics/plotly-charts');
    return response.data;
  },

  simulateWebhook: async (commitMessage: string, commitId: string = 'sim-001'): Promise<any> => {
    const response = await apiClient.post('/webhooks/git', {
      commits: [{ id: commitId, message: commitMessage }],
    });
    return response.data;
  },
};
