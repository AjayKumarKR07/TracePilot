export type ProjectStatus = 'ACTIVE' | 'INACTIVE';

export interface Project {
  id: number;
  project_key: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  is_test: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProjectCreate {
  name: string;
  project_key: string;
  description?: string | null;
  status?: ProjectStatus;
  is_test?: boolean;
}

export interface ProjectUpdate {
  name?: string;
  description?: string | null;
  status?: ProjectStatus;
}

export interface ProjectListResponse {
  items: Project[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}
