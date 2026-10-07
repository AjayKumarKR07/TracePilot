import { apiClient } from './client';
import type { AdminDashboardResponse, InactiveAssigneeList, IssueAgingResponse } from '../types/admin';

export const adminApi = {
  getDashboard: async (): Promise<AdminDashboardResponse> => {
    const response = await apiClient.get<AdminDashboardResponse>('/admin/dashboard');
    return response.data;
  },

  getInactiveAssignees: async (): Promise<InactiveAssigneeList> => {
    const response = await apiClient.get<InactiveAssigneeList>('/admin/alerts/inactive-assignees');
    return response.data;
  },

  getIssueAging: async (): Promise<IssueAgingResponse> => {
    const response = await apiClient.get<IssueAgingResponse>('/admin/issue-aging');
    return response.data;
  },
};
