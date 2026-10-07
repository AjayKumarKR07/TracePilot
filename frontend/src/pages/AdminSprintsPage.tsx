import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Download,
  FolderGit2,
  Layers,
  Play,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  UserCheck,
  TrendingUp,
  Clock,
  RotateCcw,
} from 'lucide-react';
import { SprintLifecycleIndicator } from '../components/sprints/SprintLifecycleIndicator';
import { SprintService } from '../services/SprintService';
import { projectsApi } from '../api/projects';
import { issuesApi } from '../api/issues';
import { usersApi } from '../api/users';
import { useNotifications } from '../hooks/useNotifications';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { Modal } from '../components/common/Modal';
import { PriorityBadge } from '../components/common/PriorityBadge';
import { SeverityBadge } from '../components/common/SeverityBadge';
import type { Sprint, SprintCreate } from '../types/Sprint';
import type { Project } from '../types/project';
import type { Issue } from '../types/issue';
import type { UserDetail } from '../types/user';
import { formatDate } from '../utils/formatters';

export const AdminSprintsPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const targetSprintId = searchParams.get('sprintId');

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Data
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [testers, setTesters] = useState<UserDetail[]>([]);

  // Filters
  const [selectedProjectId, setSelectedProjectId] = useState<number | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedSprintForAssign, setSelectedSprintForAssign] = useState<Sprint | null>(null);
  const [backlogModalOpen, setBacklogModalOpen] = useState(false);
  const [activeSprintForBacklog, setActiveSprintForBacklog] = useState<Sprint | null>(null);
  const [projectBacklogIssues, setProjectBacklogIssues] = useState<Issue[]>([]);
  const [backlogLoading, setBacklogLoading] = useState(false);

  // Forms
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState<{
    project_id: number;
    name: string;
    goal: string;
    start_date: string;
    end_date: string;
    estimated_team_members: number;
    working_days: number;
    hours_per_day: number;
  }>({
    project_id: 0,
    name: '',
    goal: '',
    start_date: '',
    end_date: '',
    estimated_team_members: 3,
    working_days: 10,
    hours_per_day: 6,
  });

  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);

  // Fetch initial data
  const fetchData = useCallback(async (background = false) => {
    if (!background) setLoading(true);
    else setRefreshing(true);
    setError(null);

    try {
      const [sprintList, projectRes, testerRes] = await Promise.all([
        SprintService.getAllSprints(),
        projectsApi.list({ page_size: 100 }),
        usersApi.list({ role: 'DEVELOPER', is_active: true, page_size: 100 }),
      ]);

      setSprints(sprintList || []);
      setProjects(projectRes.items || []);
      setTesters(testerRes.items || []);

      if (projectRes.items.length > 0 && createForm.project_id === 0) {
        const primaryProj = projectRes.items.find((p: Project) => p.project_key === 'ISEC' || p.name.includes('Kaggle')) || projectRes.items[0];
        setCreateForm((prev) => ({ ...prev, project_id: primaryProj.id }));
      }
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to load sprint planning data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [createForm.project_id]);

  const { wsStatus, notifications: liveNotifications } = useNotifications();

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Real-time WebSocket refresh
  const isInitialMount = useRef(true);
  const latestNotificationId = liveNotifications[0]?.id;

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    if (latestNotificationId) {
      fetchData(true);
    }
  }, [latestNotificationId, fetchData]);

  // Refetch when WebSocket reconnects
  useEffect(() => {
    if (wsStatus === 'connected') {
      fetchData(true);
    }
  }, [wsStatus, fetchData]);

  // Listen for broadcasted app-level realtime events
  useEffect(() => {
    const handleRealtime = () => {
      fetchData(true);
    };
    window.addEventListener('app:realtime_notification', handleRealtime);
    window.addEventListener('app:ws_reconnected', handleRealtime);
    return () => {
      window.removeEventListener('app:realtime_notification', handleRealtime);
      window.removeEventListener('app:ws_reconnected', handleRealtime);
    };
  }, [fetchData]);

  // Handle notification deep-link: reset filters to ALL and scroll to target sprint
  useEffect(() => {
    if (targetSprintId && sprints.length > 0) {
      const sId = parseInt(targetSprintId, 10);
      if (!isNaN(sId)) {
        const found = sprints.find((s) => s.id === sId);
        if (found) {
          setSelectedProjectId('ALL');
          setStatusFilter('ALL');
          setTimeout(() => {
            const el = document.getElementById(`admin-sprint-row-${sId}`);
            if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }, 150);
        }
      }
    }
  }, [targetSprintId, sprints]);

  // Actions
  const handleCreateSprint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.project_id || !createForm.name || !createForm.start_date || !createForm.end_date) {
      setToastMessage({ type: 'error', text: 'Please fill in all required fields' });
      return;
    }

    setCreating(true);
    try {
      const payload: SprintCreate = {
        name: createForm.name.trim(),
        goal: createForm.goal.trim() || null,
        project_id: Number(createForm.project_id),
        start_date: new Date(createForm.start_date).toISOString(),
        end_date: new Date(createForm.end_date).toISOString(),
        estimated_team_members: createForm.estimated_team_members,
        working_days: createForm.working_days,
        hours_per_day: createForm.hours_per_day,
      };

      const created = await SprintService.createSprint(payload);

      setToastMessage({ type: 'success', text: `Sprint '${createForm.name}' created successfully (placed at TOP)` });
      setCreateModalOpen(false);
      setCreateForm({
        project_id: projects[0]?.id || 0,
        name: '',
        goal: '',
        start_date: '',
        end_date: '',
        estimated_team_members: 3,
        working_days: 10,
        hours_per_day: 6,
      });
      await fetchData(true);
      setTimeout(() => {
        const el = document.getElementById(`admin-sprint-row-${created.id}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 150);
    } catch (err: any) {
      setToastMessage({ type: 'error', text: err?.response?.data?.detail || 'Failed to create sprint' });
    } finally {
      setCreating(false);
    }
  };

  const handleStartSprint = async (sprintId: number) => {
    setActionLoadingId(sprintId);
    try {
      await SprintService.startSprint(sprintId);
      setToastMessage({ type: 'success', text: 'Sprint started successfully' });
      fetchData(true);
    } catch (err: any) {
      setToastMessage({ type: 'error', text: err?.response?.data?.detail || 'Failed to start sprint' });
    } finally {
      setActionLoadingId(null);
    }
  };


  const handleDeleteSprint = async (sprint: Sprint) => {
    const isCompleted = sprint.status === 'COMPLETED';
    const confirmMessage = isCompleted
      ? `Delete completed sprint '${sprint.name}'?\n\n• The sprint itself will be deleted.\n• All linked issues and defect records will remain intact in the system.\n• Issue status, resolution details, comments, and attachments will remain.\n• Issues will simply become unassigned from this sprint.\n\nAre you sure you want to proceed?`
      : `Are you sure you want to delete planned sprint '${sprint.name}'?`;

    if (!window.confirm(confirmMessage)) return;

    setActionLoadingId(sprint.id);
    try {
      await SprintService.deleteSprint(sprint.id);
      setToastMessage({
        type: 'success',
        text: isCompleted
          ? `Completed sprint '${sprint.name}' deleted. All defect data has been safely preserved.`
          : `Sprint '${sprint.name}' deleted successfully`,
      });
      fetchData(true);
    } catch (err: any) {
      setToastMessage({ type: 'error', text: err?.response?.data?.detail || 'Failed to delete sprint' });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleAssignTester = async (testerId: number) => {
    if (!selectedSprintForAssign) return;
    setActionLoadingId(selectedSprintForAssign.id);
    try {
      await SprintService.assignTester(selectedSprintForAssign.id, testerId);
      setToastMessage({ type: 'success', text: 'Developer assigned and sprint activated' });
      setAssignModalOpen(false);
      setSelectedSprintForAssign(null);
      fetchData(true);
    } catch (err: any) {
      setToastMessage({ type: 'error', text: err?.response?.data?.detail || 'Failed to assign developer' });
    } finally {
      setActionLoadingId(null);
    }
  };

  const openBacklogModal = async (sprint: Sprint) => {
    setActiveSprintForBacklog(sprint);
    setBacklogModalOpen(true);
    setBacklogLoading(true);
    try {
      const res = await issuesApi.list({
        project_id: sprint.project_id,
        backlog: true,
        page_size: 50,
      });
      setProjectBacklogIssues(res.items || []);
    } catch (err) {
      console.error(err);
    } finally {
      setBacklogLoading(false);
    }
  };

  const handleAddIssueToSprint = async (issueId: number) => {
    if (!activeSprintForBacklog) return;
    try {
      await SprintService.addIssueToSprint(activeSprintForBacklog.id, issueId);
      setProjectBacklogIssues((prev) => prev.filter((i) => i.id !== issueId));
      setToastMessage({ type: 'success', text: 'Issue added to sprint' });
      fetchData(true);
    } catch (err: any) {
      setToastMessage({ type: 'error', text: err?.response?.data?.detail || 'Failed to add issue to sprint' });
    }
  };

  const handleDownloadReport = async (sprint: Sprint) => {
    try {
      await SprintService.downloadSprintReport(sprint.id, sprint.name);
    } catch (err) {
      setToastMessage({ type: 'error', text: 'Failed to download PDF report' });
    }
  };

  // Filtered sprints
  const filteredSprints = sprints.filter((s) => {
    if (selectedProjectId !== 'ALL' && s.project_id !== selectedProjectId) return false;
    if (statusFilter !== 'ALL' && s.status !== statusFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchName = s.name.toLowerCase().includes(q);
      const matchGoal = s.goal ? s.goal.toLowerCase().includes(q) : false;
      const matchTester = s.assigned_tester_name ? s.assigned_tester_name.toLowerCase().includes(q) : false;
      const matchProject = s.project_name ? s.project_name.toLowerCase().includes(q) : false;
      if (!matchName && !matchGoal && !matchTester && !matchProject) return false;
    }
    return true;
  }).sort((a, b) => b.id - a.id);

  if (loading && sprints.length === 0) {
    return (
      <div className="page-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <LoadingSpinner message="Loading Sprints & Planning Workspace..." />
      </div>
    );
  }

  return (
    <div className="page-container" style={{ maxWidth: '1440px', margin: '0 auto', paddingBottom: '3rem' }}>
      {/* Header */}
      <header
        className="page-header"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '1.5rem',
          paddingBottom: '1.25rem',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
              }}
            >
              <Layers size={20} />
            </div>
            <div>
              <h1 className="page-title" style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800 }}>
                Sprints &amp; Planning
              </h1>
              <p className="page-subtitle" style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                Set up sprint iterations, manage defect scopes, assign developers, and start development sprints
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            className="btn btn-secondary"
            onClick={() => fetchData(true)}
            disabled={refreshing}
            style={{ fontSize: '0.82rem' }}
          >
            <RefreshCw size={15} className={refreshing ? 'spin' : ''} />
            <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
          <button
            className="btn btn-primary"
            onClick={() => setCreateModalOpen(true)}
            style={{ fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Plus size={16} /> Create Sprint
          </button>
        </div>
      </header>

      {/* Workflow Navigation Banner */}
      <div
        style={{
          padding: '1rem 1.25rem',
          borderRadius: '10px',
          backgroundColor: 'rgba(99,102,241,0.08)',
          border: '1px solid rgba(99,102,241,0.25)',
          marginBottom: '1.75rem',
        }}
      >
        <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#818cf8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
          Admin Sprint Planning Workflow
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>1. Create Sprint</span>
          <ArrowRight size={14} style={{ color: 'var(--text-muted)' }} />
          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>2. Select Project</span>
          <ArrowRight size={14} style={{ color: 'var(--text-muted)' }} />
          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>3. View Backlog</span>
          <ArrowRight size={14} style={{ color: 'var(--text-muted)' }} />
          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>4. Add Backlog Issues</span>
          <ArrowRight size={14} style={{ color: 'var(--text-muted)' }} />
          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>5. Assign Developer</span>
          <ArrowRight size={14} style={{ color: 'var(--text-muted)' }} />
          <span style={{ fontWeight: 600, color: '#10b981' }}>6. Start Sprint (ACTIVE)</span>
        </div>
      </div>

      {error && <ErrorMessage message={error} onRetry={() => fetchData()} />}

      {/* Filters Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          flexWrap: 'wrap',
          marginBottom: '1.5rem',
          padding: '1rem',
          borderRadius: '10px',
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        {/* Project Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <FolderGit2 size={16} style={{ color: 'var(--text-muted)' }} />
          <select
            className="form-select"
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))}
            style={{ minWidth: '180px', fontSize: '0.82rem', padding: '0.4rem 0.75rem' }}
          >
            <option value="ALL">All Projects ({projects.length})</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.project_key} — {p.name}
              </option>
            ))}
          </select>
        </div>

        {/* Status Filter */}
        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
          {['ALL', 'PLANNED', 'ACTIVE', 'IN_PROGRESS', 'READY_FOR_APPROVAL', 'COMPLETED'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className="btn btn-sm"
              style={{
                fontSize: '0.75rem',
                padding: '0.35rem 0.65rem',
                backgroundColor: statusFilter === st ? '#6366f1' : 'var(--bg-surface-elevated)',
                color: statusFilter === st ? '#fff' : 'var(--text-secondary)',
                border: '1px solid var(--border-subtle)',
                fontWeight: statusFilter === st ? 700 : 500,
              }}
            >
              {st}
            </button>
          ))}
        </div>

        {/* Search */}
        <div style={{ position: 'relative', marginLeft: 'auto', minWidth: '220px' }}>
          <Search size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="form-input"
            placeholder="Search sprints, developers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingLeft: '2.2rem', fontSize: '0.82rem', width: '100%' }}
          />
        </div>
      </div>

      {/* Sprints List Table / Cards */}
      <section className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 className="card-title" style={{ fontSize: '1rem', fontWeight: 700 }}>
            Managed Sprints ({filteredSprints.length})
          </h2>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Showing real-time data from PostgreSQL
          </span>
        </div>

        <div className="card-body" style={{ padding: '1.25rem' }}>
          {filteredSprints.length === 0 ? (
            <div className="empty-state" style={{ padding: '3rem 1rem', textAlign: 'center' }}>
              <Layers size={36} style={{ color: 'var(--text-muted)', marginBottom: '0.75rem' }} />
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>No sprints found</h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                Try adjusting your project or status filters, or click "Create Sprint" to plan a new iteration.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {filteredSprints.map((sprint) => {
                const totalIssues = sprint.total_issues ?? 0;
                const completedIssues = sprint.completed_issues ?? 0;
                const remainingIssues = Math.max(0, totalIssues - completedIssues);
                const pct = sprint.progress_percentage ?? (totalIssues > 0 ? Math.round((completedIssues / totalIssues) * 100) : 0);
                const isTargeted = targetSprintId ? sprint.id === parseInt(targetSprintId, 10) : false;
                const isCompleted = sprint.status === 'COMPLETED';

                return (
                  <div
                    key={sprint.id}
                    id={`admin-sprint-row-${sprint.id}`}
                    style={{
                      backgroundColor: 'var(--bg-surface-elevated)',
                      border: isTargeted ? '2px solid var(--primary)' : '1px solid var(--border-subtle)',
                      borderRadius: '12px',
                      padding: '1.25rem',
                      boxShadow: isTargeted
                        ? '0 0 0 2px var(--primary), 0 10px 25px -5px rgba(99, 102, 241, 0.35)'
                        : '0 4px 12px rgba(0, 0, 0, 0.15)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '1rem',
                      transition: 'all 0.25s ease',
                    }}
                  >
                    {/* 1. Lifecycle Indicator at the top */}
                    <div>
                      <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem' }}>
                        Sprint Lifecycle Stage
                      </div>
                      <SprintLifecycleIndicator
                        status={sprint.status}
                        hasReviewComment={Boolean(sprint.review_comment)}
                      />
                    </div>

                    {/* 2. Top Header & Metadata */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.85rem' }}>
                      <div style={{ flex: 1, minWidth: '280px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap', marginBottom: '0.35rem' }}>
                          <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                            {sprint.name}
                          </h3>
                          {sprint.project_name && (
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '0.2rem 0.55rem', borderRadius: '6px', background: 'rgba(99,102,241,0.15)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.3)' }}>
                              {sprint.project_key ? `[${sprint.project_key}] ` : ''}{sprint.project_name}
                            </span>
                          )}
                          <span
                            style={{
                              fontSize: '0.72rem',
                              fontWeight: 800,
                              padding: '0.2rem 0.6rem',
                              borderRadius: '4px',
                              backgroundColor:
                                sprint.status === 'COMPLETED'
                                  ? 'rgba(16,185,129,0.15)'
                                  : sprint.status === 'READY_FOR_APPROVAL'
                                  ? 'rgba(129,140,248,0.2)'
                                  : sprint.status === 'IN_PROGRESS'
                                  ? 'rgba(245,158,11,0.15)'
                                  : sprint.status === 'ACTIVE'
                                  ? 'rgba(56,189,248,0.15)'
                                  : 'rgba(148,163,184,0.15)',
                              color:
                                sprint.status === 'COMPLETED'
                                  ? '#10b981'
                                  : sprint.status === 'READY_FOR_APPROVAL'
                                  ? '#818cf8'
                                  : sprint.status === 'IN_PROGRESS'
                                  ? '#fbbf24'
                                  : sprint.status === 'ACTIVE'
                                  ? '#38bdf8'
                                  : '#94a3b8',
                              border: `1px solid ${
                                sprint.status === 'COMPLETED'
                                  ? 'rgba(16,185,129,0.35)'
                                  : sprint.status === 'READY_FOR_APPROVAL'
                                  ? 'rgba(129,140,248,0.35)'
                                  : sprint.status === 'IN_PROGRESS'
                                  ? 'rgba(245,158,11,0.35)'
                                  : sprint.status === 'ACTIVE'
                                  ? 'rgba(56,189,248,0.35)'
                                  : 'rgba(148,163,184,0.35)'
                              }`,
                            }}
                          >
                            {sprint.status === 'READY_FOR_APPROVAL' ? 'AWAITING APPROVAL' : sprint.status}
                          </span>
                        </div>

                        {sprint.goal && (
                          <p style={{ margin: '0.35rem 0 0.5rem', fontSize: '0.86rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                            <strong>Goal:</strong> {sprint.goal}
                          </p>
                        )}

                        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', fontSize: '0.8rem', color: 'var(--text-muted)', flexWrap: 'wrap', marginTop: '0.35rem' }}>
                          <span>
                            <strong>Window:</strong> {formatDate(sprint.start_date)} → {formatDate(sprint.end_date)}
                          </span>
                          {sprint.working_days && (
                            <span>
                              <strong>Days:</strong> {sprint.working_days} working days
                            </span>
                          )}
                          {sprint.estimated_team_members && (
                            <span>
                              <strong>Capacity:</strong> {sprint.estimated_team_members} members
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Assigned Tester Widget */}
                      <div style={{ background: 'var(--bg-surface-elevated)', padding: '0.65rem 0.95rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', minWidth: '220px' }}>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          Assigned Developer
                        </div>
                        {sprint.assigned_tester_name ? (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.65rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                              <UserCheck size={16} style={{ color: 'var(--success)' }} />
                              <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--success)' }}>
                                {sprint.assigned_tester_name}
                              </span>
                            </div>
                            <button
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '0.2rem 0.5rem', fontSize: '0.72rem' }}
                              onClick={() => {
                                setSelectedSprintForAssign(sprint);
                                setAssignModalOpen(true);
                              }}
                              title="Change assigned developer"
                            >
                              Reassign
                            </button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>Unassigned</span>
                            <button
                              className="btn btn-primary btn-sm"
                              style={{ padding: '0.25rem 0.65rem', fontSize: '0.75rem' }}
                              onClick={() => {
                                setSelectedSprintForAssign(sprint);
                                setAssignModalOpen(true);
                              }}
                            >
                              <UserCheck size={13} /> Assign Developer
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 3. Real PostgreSQL Issue Progress & Metrics Grid */}
                    <div style={{ background: 'var(--bg-surface)', padding: '1rem', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem', marginBottom: '0.85rem' }}>
                        <div style={{ background: 'var(--bg-surface-elevated)', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Scope (Total Issues)</div>
                          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f8fafc' }}>{totalIssues}</div>
                        </div>
                        <div style={{ background: 'var(--bg-surface-elevated)', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Completed Issues</div>
                          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#10b981' }}>{completedIssues}</div>
                        </div>
                        <div style={{ background: 'var(--bg-surface-elevated)', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Remaining Issues</div>
                          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: remainingIssues > 0 ? '#f59e0b' : '#94a3b8' }}>{remainingIssues}</div>
                        </div>
                        <div style={{ background: 'var(--bg-surface-elevated)', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Sprint Progress</div>
                          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: pct >= 100 ? '#10b981' : '#6366f1' }}>{pct}%</div>
                        </div>
                        <div style={{ background: 'var(--bg-surface-elevated)', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Velocity</div>
                          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#38bdf8' }}>{completedIssues} pts</div>
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                        <span>Real PostgreSQL Defect Progress: {completedIssues} of {totalIssues} issues resolved</span>
                        <span style={{ fontWeight: 800, color: pct >= 100 ? '#10b981' : '#818cf8' }}>{pct}%</span>
                      </div>
                      <div style={{ height: '8px', borderRadius: '4px', backgroundColor: 'var(--border-subtle)', overflow: 'hidden' }}>
                        <div
                          style={{
                            height: '100%',
                            width: `${pct}%`,
                            backgroundColor: pct >= 100 ? '#10b981' : pct >= 50 ? '#6366f1' : '#f59e0b',
                            borderRadius: '4px',
                            transition: 'width 0.6s ease',
                          }}
                        />
                      </div>
                    </div>

                    {/* 4. Prominent Completed or Changes-Requested Banner */}
                    {isCompleted && totalIssues > 0 && (
                      <div
                        style={{
                          padding: '0.85rem 1.15rem',
                          borderRadius: '8px',
                          backgroundColor: 'rgba(16,185,129,0.1)',
                          border: '1px solid rgba(16,185,129,0.35)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: '0.75rem',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                          <CheckCircle2 size={18} style={{ color: '#10b981' }} />
                          <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#34d399' }}>
                            ✓ Sprint Completed &amp; Approved
                          </span>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            — {completedIssues}/{totalIssues} issues closed ({pct}% progress) • Velocity: {completedIssues} pts
                          </span>
                        </div>
                      </div>
                    )}

                    {totalIssues === 0 && (
                      <div
                        style={{
                          padding: '0.85rem 1.15rem',
                          borderRadius: '8px',
                          backgroundColor: 'rgba(239, 68, 68, 0.1)',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.6rem',
                          fontSize: '0.85rem',
                          fontWeight: 600,
                          color: '#f87171',
                        }}
                      >
                        <AlertCircle size={16} />
                        <span>⚠ Sprint has no issues assigned. Add backlog issues before starting/approving this sprint.</span>
                      </div>
                    )}

                    {sprint.review_comment && sprint.status === 'IN_PROGRESS' && (
                      <div
                        style={{
                          padding: '0.85rem 1.15rem',
                          borderRadius: '8px',
                          backgroundColor: 'rgba(245,158,11,0.1)',
                          border: '1px solid rgba(245,158,11,0.35)',
                          borderLeft: '4px solid #f59e0b',
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '0.6rem',
                        }}
                      >
                        <RotateCcw size={16} style={{ color: '#f59e0b', marginTop: '0.15rem', flexShrink: 0 }} />
                        <div>
                          <strong style={{ color: '#fbbf24', fontSize: '0.85rem' }}>Admin Requested Changes (Rework Cycle):</strong>
                          <p style={{ margin: '0.2rem 0 0', fontSize: '0.83rem', color: 'var(--text-secondary)' }}>
                            {sprint.review_comment}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* 5. Agile Actions Row */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.85rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                        {/* Add Backlog Issues (available unless completed) */}
                        {!isCompleted && (
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => openBacklogModal(sprint)}
                            style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                            title="Add PostgreSQL backlog issues to this sprint"
                          >
                            <Plus size={13} /> Add Backlog Issues
                          </button>
                        )}

                        {/* Start Sprint if PLANNED */}
                        {sprint.status === 'PLANNED' && (
                          <button
                            className="btn btn-primary btn-sm"
                            disabled={actionLoadingId === sprint.id || totalIssues === 0}
                            onClick={() => handleStartSprint(sprint.id)}
                            style={{
                              fontSize: '0.78rem',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              fontWeight: 700,
                              opacity: totalIssues === 0 ? 0.5 : 1,
                              cursor: totalIssues === 0 ? 'not-allowed' : 'pointer',
                            }}
                            title={totalIssues === 0 ? "Add backlog issues before starting this sprint" : "Start Sprint → Transitions to ACTIVE"}
                          >
                            <Play size={13} /> Start Sprint (ACTIVE)
                          </button>
                        )}

                        {/* Review & Approve Sprint if READY_FOR_APPROVAL */}
                        {sprint.status === 'READY_FOR_APPROVAL' && (
                          <Link
                            to={`/admin/sprint-approvals?sprintId=${sprint.id}`}
                            className="btn btn-primary btn-sm"
                            style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, backgroundColor: '#6366f1' }}
                            title="Open Sprint Approvals to review and sign off"
                          >
                            <Clock size={13} /> Review &amp; Approve Sprint
                          </Link>
                        )}

                        {/* View Project Sprints / Burndown Charts */}
                        <Link
                          to={`/projects/${sprint.project_id}/sprints`}
                          className="btn btn-secondary btn-sm"
                          style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                          title="View Burndown Chart & Team Workload"
                        >
                          <TrendingUp size={13} /> Burndown &amp; Workload
                        </Link>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {/* Download PDF report */}
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleDownloadReport(sprint)}
                          title="Download PDF Sprint Report"
                          style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                        >
                          <Download size={13} /> PDF Report
                        </button>

                        {/* Delete if PLANNED or COMPLETED */}
                        {(sprint.status === 'PLANNED' || sprint.status === 'COMPLETED') && (
                          <button
                            className="btn btn-secondary btn-sm"
                            disabled={actionLoadingId === sprint.id}
                            onClick={() => handleDeleteSprint(sprint)}
                            title={sprint.status === 'COMPLETED' ? "Delete Completed Sprint (Defect data preserved)" : "Delete Planned Sprint"}
                            style={{
                              fontSize: '0.78rem',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              color: '#ef4444',
                              borderColor: 'rgba(239, 68, 68, 0.35)',
                            }}
                          >
                            <Trash2 size={13} /> Delete Sprint
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ───────────────────────────────────────────────────────────────────── */}
      {/* Modals                                                                */}
      {/* ───────────────────────────────────────────────────────────────────── */}

      {/* Create Sprint Modal */}
      <Modal isOpen={createModalOpen} onClose={() => setCreateModalOpen(false)} title="Create New Sprint">
        <form onSubmit={handleCreateSprint} style={{ padding: '1.25rem' }}>
          <div className="form-group">
            <label className="form-label">Project *</label>
            <select
              className="form-select"
              required
              value={createForm.project_id}
              onChange={(e) => setCreateForm({ ...createForm, project_id: Number(e.target.value) })}
            >
              {projects
                .filter((p) => p.status === 'ACTIVE')
                .slice()
                .sort((a, b) => {
                  if (a.project_key === 'ISEC') return -1;
                  if (b.project_key === 'ISEC') return 1;
                  return a.name.localeCompare(b.name);
                })
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.project_key} — {p.name}
                  </option>
                ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Sprint Name *</label>
            <input
              type="text"
              className="form-input"
              required
              placeholder="e.g. Sprint 1 - Core Defect Remediation"
              value={createForm.name}
              onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Sprint Goal</label>
            <textarea
              className="form-textarea"
              rows={2}
              placeholder="Primary milestone or defect focus for this sprint..."
              value={createForm.goal}
              onChange={(e) => setCreateForm({ ...createForm, goal: e.target.value })}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Start Date *</label>
              <input
                type="date"
                className="form-input"
                required
                value={createForm.start_date}
                onChange={(e) => setCreateForm({ ...createForm, start_date: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">End Date *</label>
              <input
                type="date"
                className="form-input"
                required
                value={createForm.end_date}
                onChange={(e) => setCreateForm({ ...createForm, end_date: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginTop: '0.5rem' }}>
            <div className="form-group">
              <label className="form-label">Team Size</label>
              <input
                type="number"
                min={1}
                className="form-input"
                value={createForm.estimated_team_members}
                onChange={(e) => setCreateForm({ ...createForm, estimated_team_members: Number(e.target.value) })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Working Days</label>
              <input
                type="number"
                min={1}
                className="form-input"
                value={createForm.working_days}
                onChange={(e) => setCreateForm({ ...createForm, working_days: Number(e.target.value) })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Hours / Day</label>
              <input
                type="number"
                min={1}
                className="form-input"
                value={createForm.hours_per_day}
                onChange={(e) => setCreateForm({ ...createForm, hours_per_day: Number(e.target.value) })}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setCreateModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={creating}>
              {creating ? 'Creating...' : 'Create Sprint'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Assign Developer Modal */}
      <Modal
        isOpen={assignModalOpen}
        onClose={() => {
          setAssignModalOpen(false);
          setSelectedSprintForAssign(null);
        }}
        title={`Assign Developer to Sprint: ${selectedSprintForAssign?.name || ''}`}
      >
        <div style={{ padding: '1.25rem' }}>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            Assigning a developer will transition the sprint to <strong>ACTIVE</strong> status and notify the developer.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '350px', overflowY: 'auto' }}>
            {testers.map((t) => (
              <div
                key={t.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.75rem',
                  borderRadius: '8px',
                  backgroundColor: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                    {t.full_name}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.email}</div>
                </div>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => handleAssignTester(t.id)}
                  style={{ fontSize: '0.78rem', padding: '0.35rem 0.8rem' }}
                >
                  Select Developer
                </button>
              </div>
            ))}
          </div>
        </div>
      </Modal>

      {/* Add Backlog Issues to Sprint Modal */}
      <Modal
        isOpen={backlogModalOpen}
        onClose={() => {
          setBacklogModalOpen(false);
          setActiveSprintForBacklog(null);
        }}
        title={`Project Backlog: Add Issues to ${activeSprintForBacklog?.name || 'Sprint'}`}
      >
        <div style={{ padding: '1.25rem' }}>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            Available unassigned backlog defects from this project. Click <strong>Add to Sprint</strong> to include the issue in sprint scope.
          </p>

          {backlogLoading ? (
            <div style={{ padding: '2rem 0', textAlign: 'center' }}>
              <LoadingSpinner message="Fetching backlog issues..." />
            </div>
          ) : projectBacklogIssues.length === 0 ? (
            <div
              style={{
                padding: '2rem 1.5rem',
                textAlign: 'center',
                backgroundColor: 'var(--bg-surface-elevated)',
                borderRadius: '10px',
                border: '1px dashed var(--border-subtle)',
              }}
            >
              <Layers size={32} style={{ color: 'var(--text-muted)', marginBottom: '0.75rem' }} />
              <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
                No unassigned backlog defects in this project yet
              </div>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', maxWidth: '380px', margin: '0 auto' }}>
                All defects in this project are currently assigned to active sprints or already resolved.
              </p>
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  {projectBacklogIssues.length} available backlog defect{projectBacklogIssues.length === 1 ? '' : 's'}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '380px', overflowY: 'auto' }}>
                {projectBacklogIssues.map((issue) => (
                <div
                  key={issue.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.75rem',
                    borderRadius: '8px',
                    backgroundColor: 'var(--bg-surface-elevated)',
                    border: '1px solid var(--border-subtle)',
                    gap: '0.75rem',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.82rem', color: '#818cf8' }}>
                        {issue.issue_key}
                      </span>
                      <PriorityBadge priority={issue.priority} />
                      <SeverityBadge severity={issue.severity} />
                    </div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {issue.title}
                    </div>
                  </div>

                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '0.75rem', padding: '0.3rem 0.75rem', flexShrink: 0 }}
                    onClick={() => handleAddIssueToSprint(issue.id)}
                  >
                    + Add to Sprint
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
        </div>
      </Modal>

      {/* Toast */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            bottom: '1.5rem',
            right: '1.5rem',
            background: 'var(--bg-surface-elevated)',
            border: `1px solid ${toastMessage.type === 'success' ? '#10b981' : '#ef4444'}`,
            padding: '0.9rem 1.25rem',
            borderRadius: '10px',
            boxShadow: '0 8px 20px rgba(0, 0, 0, 0.4)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.85rem',
            zIndex: 9999,
          }}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 size={18} style={{ color: '#10b981' }} />
          ) : (
            <AlertCircle size={18} style={{ color: '#ef4444' }} />
          )}
          <span style={{ fontSize: '0.88rem', color: 'var(--text-primary)', fontWeight: 500 }}>
            {toastMessage.text}
          </span>
          <button
            onClick={() => setToastMessage(null)}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.1rem', marginLeft: '0.5rem' }}
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
};

