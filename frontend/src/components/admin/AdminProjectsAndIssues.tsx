import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bug,
  ExternalLink,
  Filter,
  FolderGit2,
  RefreshCw,
  Search,
  UserCheck,
  X,
} from 'lucide-react';
import { issuesApi } from '../../api/issues';
import { projectsApi } from '../../api/projects';
import { usersApi } from '../../api/users';
import { getApiErrorMessage } from '../../api/client';
import { Modal } from '../common/Modal';
import { PriorityBadge } from '../common/PriorityBadge';
import { SeverityBadge } from '../common/SeverityBadge';
import { StatusBadge } from '../common/StatusBadge';
import type { Issue, IssueStatus, Priority, Severity } from '../../types/issue';
import type { Project } from '../../types/project';
import type { UserDetail } from '../../types/user';
import { formatDate, formatRelativeTime } from '../../utils/formatters';

interface AdminProjectsAndIssuesProps {
  onActionSuccess?: (msg: string) => void;
  onActionError?: (msg: string) => void;
  refreshTrigger?: number;
}

export const AdminProjectsAndIssues: React.FC<AdminProjectsAndIssuesProps> = ({
  onActionSuccess,
  onActionError,
  refreshTrigger,
}) => {
  // ── Sub-view toggle: 'all' | 'projects' | 'issues' ──
  const [activeSection, setActiveSection] = useState<'both' | 'projects' | 'issues'>('both');

  // ── Projects state ──
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectsError, setProjectsError] = useState<string | null>(null);

  // ── Issues state ──
  const [issues, setIssues] = useState<Issue[]>([]);
  const [issuesTotal, setIssuesTotal] = useState(0);
  const [issuesPage, setIssuesPage] = useState(1);
  const [issuesPageSize] = useState(15);
  const [issuesTotalPages, setIssuesTotalPages] = useState(1);
  const [issueSearch, setIssueSearch] = useState('');
  const [issueStatusFilter, setIssueStatusFilter] = useState<IssueStatus | ''>('');
  const [issueSeverityFilter, setIssueSeverityFilter] = useState<Severity | ''>('');
  const [issuePriorityFilter, setIssuePriorityFilter] = useState<Priority | ''>('');
  const [selectedProjectId, setSelectedProjectId] = useState<number | ''>('');
  const [issuesLoading, setIssuesLoading] = useState(false);
  const [issuesError, setIssuesError] = useState<string | null>(null);

  // ── Quick Assign Modal State ──
  const [assignModalIssue, setAssignModalIssue] = useState<Issue | null>(null);
  const [availableDevs, setAvailableDevs] = useState<UserDetail[]>([]);
  const [selectedDevId, setSelectedDevId] = useState<number | ''>('');
  const [assignLoading, setAssignLoading] = useState(false);
  const [devsLoading, setDevsLoading] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  // Map of projects by ID for quick lookup
  const projectMap = useMemo(() => {
    const map = new Map<number, Project>();
    projects.forEach((p) => map.set(p.id, p));
    return map;
  }, [projects]);

  // Map of developers by ID for assignee name lookup
  const devMap = useMemo(() => {
    const map = new Map<number, UserDetail>();
    availableDevs.forEach((d) => map.set(d.id, d));
    return map;
  }, [availableDevs]);

  // Load available developers on mount
  useEffect(() => {
    usersApi
      .list({ role: 'DEVELOPER', is_active: true, page_size: 50 })
      .then((res) => setAvailableDevs(res.items))
      .catch(() => {});
  }, []);

  // ── Fetch Projects ──
  const fetchProjects = useCallback(async () => {
    setProjectsLoading(true);
    setProjectsError(null);
    try {
      const res = await projectsApi.list({ page_size: 50 });
      setProjects(res.items || []);
    } catch (err: unknown) {
      setProjectsError(getApiErrorMessage(err));
    } finally {
      setProjectsLoading(false);
    }
  }, []);

  // ── Fetch Issues ──
  const fetchIssues = useCallback(async () => {
    setIssuesLoading(true);
    setIssuesError(null);
    try {
      const res = await issuesApi.list({
        page: issuesPage,
        page_size: issuesPageSize,
        search: issueSearch.trim() || undefined,
        status: issueStatusFilter || undefined,
        severity: issueSeverityFilter || undefined,
        priority: issuePriorityFilter || undefined,
        project_id: selectedProjectId !== '' ? Number(selectedProjectId) : undefined,
      });
      setIssues(res.items || []);
      setIssuesTotal(res.total || 0);
      setIssuesTotalPages(res.total_pages || 1);
    } catch (err: unknown) {
      setIssuesError(getApiErrorMessage(err));
    } finally {
      setIssuesLoading(false);
    }
  }, [issuesPage, issuesPageSize, issueSearch, issueStatusFilter, issueSeverityFilter, issuePriorityFilter, selectedProjectId]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects, refreshTrigger]);

  useEffect(() => {
    fetchIssues();
  }, [fetchIssues, refreshTrigger]);

  // ── Quick Assign Handlers ──
  const openAssignModal = async (issue: Issue) => {
    setAssignModalIssue(issue);
    setSelectedDevId(issue.assignee_id || '');
    setAssignError(null);
    setDevsLoading(true);
    try {
      const res = await usersApi.list({ role: 'DEVELOPER', is_active: true, page_size: 50 });
      setAvailableDevs(res.items);
    } catch (err: unknown) {
      setAssignError(getApiErrorMessage(err));
    } finally {
      setDevsLoading(false);
    }
  };

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignModalIssue || !selectedDevId) return;
    setAssignLoading(true);
    setAssignError(null);
    try {
      await issuesApi.assign(assignModalIssue.id, {
        developer_id: Number(selectedDevId),
        tester_id: Number(selectedDevId),
      });
      const assignedDev = availableDevs.find((d) => d.id === Number(selectedDevId));
      onActionSuccess?.(`Issue ${assignModalIssue.issue_key} successfully assigned to ${assignedDev?.full_name || 'developer'}.`);
      setAssignModalIssue(null);
      fetchIssues();
    } catch (err: unknown) {
      const msg = getApiErrorMessage(err);
      setAssignError(msg);
      onActionError?.(msg);
    } finally {
      setAssignLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* ── Sub-nav Section Pills ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div
          style={{
            display: 'flex',
            gap: '0.35rem',
            background: 'var(--bg-surface-elevated)',
            padding: '0.25rem',
            borderRadius: '8px',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <button
            onClick={() => setActiveSection('both')}
            style={{
              padding: '0.4rem 0.85rem',
              fontSize: '0.8rem',
              fontWeight: activeSection === 'both' ? 700 : 500,
              borderRadius: '6px',
              border: 'none',
              background: activeSection === 'both' ? 'var(--primary, #6366f1)' : 'transparent',
              color: activeSection === 'both' ? '#ffffff' : 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            All Sections
          </button>
          <button
            onClick={() => setActiveSection('projects')}
            style={{
              padding: '0.4rem 0.85rem',
              fontSize: '0.8rem',
              fontWeight: activeSection === 'projects' ? 700 : 500,
              borderRadius: '6px',
              border: 'none',
              background: activeSection === 'projects' ? 'var(--primary, #6366f1)' : 'transparent',
              color: activeSection === 'projects' ? '#ffffff' : 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            Projects ({projects.length})
          </button>
          <button
            onClick={() => setActiveSection('issues')}
            style={{
              padding: '0.4rem 0.85rem',
              fontSize: '0.8rem',
              fontWeight: activeSection === 'issues' ? 700 : 500,
              borderRadius: '6px',
              border: 'none',
              background: activeSection === 'issues' ? 'var(--primary, #6366f1)' : 'transparent',
              color: activeSection === 'issues' ? '#ffffff' : 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            Issues ({issuesTotal})
          </button>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Link
            to="/projects"
            className="btn btn-secondary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem' }}
          >
            <FolderGit2 size={13} />
            <span>Manage All Projects &rarr;</span>
          </Link>
          <Link
            to="/issues"
            className="btn btn-secondary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem' }}
          >
            <Bug size={13} />
            <span>All System Issues &rarr;</span>
          </Link>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 1. PROJECTS SECTION                                                */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {(activeSection === 'both' || activeSection === 'projects') && (
        <div
          className="card"
          style={{
            padding: '1.25rem 1.5rem',
            borderRadius: 'var(--radius-lg, 12px)',
            background: 'var(--card-bg, #ffffff)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '1rem',
              flexWrap: 'wrap',
              gap: '0.5rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <div
                style={{
                  width: '30px',
                  height: '30px',
                  borderRadius: '8px',
                  background: 'rgba(99, 102, 241, 0.12)',
                  color: '#818cf8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <FolderGit2 size={16} />
              </div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                Active System Projects
              </h3>
              <span
                style={{
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  padding: '0.15rem 0.5rem',
                  borderRadius: '999px',
                  background: 'rgba(99, 102, 241, 0.15)',
                  color: '#818cf8',
                }}
              >
                {projects.length}
              </span>
            </div>

            <button
              onClick={() => fetchProjects()}
              disabled={projectsLoading}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem' }}
            >
              <RefreshCw size={13} className={projectsLoading ? 'animate-spin' : ''} />
              <span>Refresh Projects</span>
            </button>
          </div>

          {projectsError && (
            <div style={{ color: '#f87171', fontSize: '0.84rem', marginBottom: '0.75rem' }}>
              {projectsError}
            </div>
          )}

          {projectsLoading && projects.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <RefreshCw size={22} className="animate-spin" style={{ margin: '0 auto 0.5rem auto' }} />
              <p style={{ margin: 0, fontSize: '0.86rem' }}>Loading projects…</p>
            </div>
          ) : projects.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.86rem' }}>
              No projects configured in the system.
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '1rem',
              }}
            >
              {projects.map((p) => {
                const isSelected = selectedProjectId === p.id;
                return (
                  <div
                    key={p.id}
                    style={{
                      padding: '1rem 1.15rem',
                      borderRadius: '10px',
                      background: isSelected ? 'rgba(99, 102, 241, 0.08)' : 'var(--bg-surface-elevated)',
                      border: isSelected ? '1px solid #6366f1' : '1px solid var(--border-subtle)',
                      transition: 'all 0.15s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: '0.75rem',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.4rem' }}>
                        <span
                          style={{
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            padding: '0.15rem 0.45rem',
                            borderRadius: '4px',
                            background: 'rgba(99, 102, 241, 0.2)',
                            color: '#818cf8',
                            letterSpacing: '0.04em',
                          }}
                        >
                          {p.project_key}
                        </span>
                        <span
                          style={{
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            padding: '0.1rem 0.45rem',
                            borderRadius: '999px',
                            background: p.status === 'ACTIVE' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(148, 163, 184, 0.12)',
                            color: p.status === 'ACTIVE' ? '#34d399' : 'var(--text-muted)',
                            border: `1px solid ${p.status === 'ACTIVE' ? 'rgba(16, 185, 129, 0.3)' : 'var(--border-subtle)'}`,
                          }}
                        >
                          {p.status}
                        </span>
                      </div>

                      <h4 style={{ margin: '0 0 0.3rem 0', fontSize: '0.94rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                        {p.name}
                      </h4>
                      <p
                        style={{
                          margin: 0,
                          fontSize: '0.78rem',
                          color: 'var(--text-secondary)',
                          lineHeight: 1.4,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {p.description || 'No description provided.'}
                      </p>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingTop: '0.55rem',
                        borderTop: '1px solid var(--border-subtle)',
                        fontSize: '0.76rem',
                      }}
                    >
                      <button
                        onClick={() => {
                          if (selectedProjectId === p.id) {
                            setSelectedProjectId('');
                          } else {
                            setSelectedProjectId(p.id);
                            setActiveSection('both');
                          }
                          setIssuesPage(1);
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: isSelected ? '#818cf8' : 'var(--text-muted)',
                          fontWeight: 700,
                          cursor: 'pointer',
                          padding: 0,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                        }}
                      >
                        <Filter size={12} />
                        <span>{isSelected ? 'Filtered' : 'Filter Issues'}</span>
                      </button>

                      <div style={{ display: 'flex', gap: '0.65rem' }}>
                        <Link
                          to={`/projects/${p.id}/sprints`}
                          style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontWeight: 600 }}
                          title="View Sprints"
                        >
                          Sprints &rarr;
                        </Link>
                        <Link
                          to={`/projects/${p.id}/backlog`}
                          style={{ color: '#818cf8', textDecoration: 'none', fontWeight: 600 }}
                          title="View Backlog"
                        >
                          Backlog &rarr;
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 2. ISSUES MANAGEMENT SECTION                                        */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {(activeSection === 'both' || activeSection === 'issues') && (
        <div
          className="card"
          style={{
            padding: '1.25rem 1.5rem',
            borderRadius: 'var(--radius-lg, 12px)',
            background: 'var(--card-bg, #ffffff)',
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '0.75rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <div
                style={{
                  width: '30px',
                  height: '30px',
                  borderRadius: '8px',
                  background: 'rgba(239, 68, 68, 0.12)',
                  color: '#ef4444',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Bug size={16} />
              </div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                Issue &amp; Defect Management
              </h3>
              <span
                style={{
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  padding: '0.15rem 0.5rem',
                  borderRadius: '999px',
                  background: 'rgba(239, 68, 68, 0.15)',
                  color: '#f87171',
                }}
              >
                {issuesTotal} Total
              </span>
              {selectedProjectId && (
                <span
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    padding: '0.15rem 0.5rem',
                    borderRadius: '4px',
                    background: 'rgba(99, 102, 241, 0.15)',
                    color: '#818cf8',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                  }}
                >
                  Project Filter Active
                  <button
                    onClick={() => {
                      setSelectedProjectId('');
                      setIssuesPage(1);
                    }}
                    style={{ background: 'none', border: 'none', color: '#818cf8', cursor: 'pointer', padding: 0 }}
                  >
                    <X size={12} />
                  </button>
                </span>
              )}
            </div>

            <button
              onClick={() => fetchIssues()}
              disabled={issuesLoading}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem' }}
            >
              <RefreshCw size={13} className={issuesLoading ? 'animate-spin' : ''} />
              <span>Refresh Issues</span>
            </button>
          </div>

          {/* Filter Bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem',
              flexWrap: 'wrap',
            }}
          >
            {/* Search input */}
            <div style={{ position: 'relative', flex: '1 1 200px', minWidth: '180px' }}>
              <Search
                size={14}
                style={{
                  position: 'absolute',
                  left: '0.7rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                }}
              />
              <input
                type="text"
                placeholder="Search issues by key, title…"
                value={issueSearch}
                onChange={(e) => {
                  setIssueSearch(e.target.value);
                  setIssuesPage(1);
                }}
                style={{
                  width: '100%',
                  padding: '0.45rem 0.75rem 0.45rem 2.1rem',
                  fontSize: '0.82rem',
                  borderRadius: '6px',
                  border: '1px solid var(--border-subtle)',
                  background: 'var(--bg-input, #0f172a)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>

            {/* Quick Status Filter Tabs */}
            <div
              style={{
                display: 'flex',
                gap: '0.25rem',
                background: 'var(--bg-surface-elevated)',
                padding: '0.2rem',
                borderRadius: '6px',
                border: '1px solid var(--border-subtle)',
                flexWrap: 'wrap',
              }}
            >
              {[
                { id: '', label: 'All Status' },
                { id: 'REPORTED', label: 'Reported' },
                { id: 'IN_DEVELOPMENT', label: 'In Dev' },
                { id: 'IN_REVIEW', label: 'In Review' },
                { id: 'IN_TESTING', label: 'In Testing' },
                { id: 'RESOLVED', label: 'Resolved' },
                { id: 'REOPENED', label: 'Reopened' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setIssueStatusFilter(tab.id as IssueStatus | '');
                    setIssuesPage(1);
                  }}
                  style={{
                    padding: '0.3rem 0.6rem',
                    fontSize: '0.75rem',
                    fontWeight: issueStatusFilter === tab.id ? 700 : 500,
                    borderRadius: '4px',
                    border: 'none',
                    background: issueStatusFilter === tab.id ? 'var(--primary, #6366f1)' : 'transparent',
                    color: issueStatusFilter === tab.id ? '#ffffff' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Severity Filter */}
            <select
              value={issueSeverityFilter}
              onChange={(e) => {
                setIssueSeverityFilter(e.target.value as Severity | '');
                setIssuesPage(1);
              }}
              style={{
                padding: '0.4rem 0.65rem',
                fontSize: '0.78rem',
                borderRadius: '6px',
                border: '1px solid var(--border-subtle)',
                background: 'var(--bg-input, #0f172a)',
                color: 'var(--text-primary)',
              }}
            >
              <option value="">All Severity</option>
              <option value="BLOCKER">Blocker</option>
              <option value="CRITICAL">Critical</option>
              <option value="MAJOR">Major</option>
              <option value="MINOR">Minor</option>
            </select>

            {/* Priority Filter */}
            <select
              value={issuePriorityFilter}
              onChange={(e) => {
                setIssuePriorityFilter(e.target.value as Priority | '');
                setIssuesPage(1);
              }}
              style={{
                padding: '0.4rem 0.65rem',
                fontSize: '0.78rem',
                borderRadius: '6px',
                border: '1px solid var(--border-subtle)',
                background: 'var(--bg-input, #0f172a)',
                color: 'var(--text-primary)',
              }}
            >
              <option value="">All Priority</option>
              <option value="URGENT">Urgent</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
          </div>

          {issuesError && (
            <div style={{ color: '#f87171', fontSize: '0.84rem' }}>{issuesError}</div>
          )}

          {/* Issues Table */}
          <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr
                  style={{
                    background: 'var(--bg-surface-elevated)',
                    borderBottom: '1px solid var(--border-subtle)',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    color: 'var(--text-muted)',
                  }}
                >
                  <th style={{ padding: '0.75rem 1rem' }}>Issue</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Severity</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Priority</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Assignee</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Created</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {issuesLoading && issues.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                      <RefreshCw size={22} className="animate-spin" style={{ margin: '0 auto 0.5rem auto' }} />
                      <p style={{ margin: 0, fontSize: '0.84rem' }}>Loading defects…</p>
                    </td>
                  </tr>
                ) : issues.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                      <Bug size={28} style={{ margin: '0 auto 0.5rem auto', opacity: 0.5 }} />
                      <p style={{ margin: 0, fontSize: '0.88rem', fontWeight: 600 }}>No issues found matching your filters</p>
                    </td>
                  </tr>
                ) : (
                  issues.map((issue) => {
                    const project = projectMap.get(issue.project_id);
                    const assignedDev = issue.assignee_id ? devMap.get(issue.assignee_id) : null;

                    return (
                      <tr
                        key={issue.id}
                        style={{
                          borderBottom: '1px solid var(--border-subtle)',
                          transition: 'background-color 0.15s ease',
                        }}
                      >
                        {/* Key & Title */}
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <div>
                            <Link
                              to={`/issues/${issue.id}`}
                              style={{
                                fontSize: '0.82rem',
                                fontWeight: 800,
                                color: '#818cf8',
                                textDecoration: 'none',
                                marginRight: '0.45rem',
                              }}
                            >
                              {issue.issue_key}
                            </Link>
                            <span style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                              {issue.title}
                            </span>
                          </div>
                          {project && (
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                              {project.name} ({project.project_key})
                            </span>
                          )}
                        </td>

                        {/* Status */}
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <StatusBadge status={issue.status} />
                        </td>

                        {/* Severity */}
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <SeverityBadge severity={issue.severity} />
                        </td>

                        {/* Priority */}
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <PriorityBadge priority={issue.priority} />
                        </td>

                        {/* Assignee */}
                        <td style={{ padding: '0.75rem 1rem', fontSize: '0.78rem' }}>
                          {issue.assignee_id ? (
                            <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                              {assignedDev ? assignedDev.full_name : `Developer #${issue.assignee_id}`}
                            </span>
                          ) : (
                            <span
                              style={{
                                fontSize: '0.72rem',
                                padding: '0.15rem 0.45rem',
                                borderRadius: '4px',
                                background: 'rgba(239, 68, 68, 0.1)',
                                color: '#f87171',
                                fontWeight: 700,
                              }}
                            >
                              Unassigned
                            </span>
                          )}
                        </td>

                        {/* Created */}
                        <td style={{ padding: '0.75rem 1rem', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                          <span title={formatDate(issue.created_at)}>{formatRelativeTime(issue.created_at)}</span>
                        </td>

                        {/* Actions */}
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
                            <button
                              onClick={() => openAssignModal(issue)}
                              className="btn btn-secondary btn-sm"
                              style={{
                                fontSize: '0.72rem',
                                padding: '0.25rem 0.55rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.3rem',
                              }}
                            >
                              <UserCheck size={12} />
                              <span>{issue.assignee_id ? 'Reassign' : 'Assign'}</span>
                            </button>
                            <Link
                              to={`/issues/${issue.id}`}
                              className="btn btn-secondary btn-sm"
                              style={{ fontSize: '0.72rem', padding: '0.25rem 0.45rem' }}
                              title="View defect detail"
                            >
                              <ExternalLink size={12} />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {issuesTotalPages > 1 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '0.8rem',
                color: 'var(--text-secondary)',
                flexWrap: 'wrap',
                gap: '0.5rem',
              }}
            >
              <span>
                Showing {(issuesPage - 1) * issuesPageSize + 1}–{Math.min(issuesPage * issuesPageSize, issuesTotal)} of {issuesTotal} defects
              </span>
              <div style={{ display: 'flex', gap: '0.35rem' }}>
                <button
                  onClick={() => setIssuesPage((p) => Math.max(p - 1, 1))}
                  disabled={issuesPage <= 1}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '0.76rem', padding: '0.25rem 0.6rem' }}
                >
                  Previous
                </button>
                <span style={{ display: 'flex', alignItems: 'center', padding: '0 0.4rem', fontWeight: 600 }}>
                  Page {issuesPage} of {issuesTotalPages}
                </span>
                <button
                  onClick={() => setIssuesPage((p) => Math.min(p + 1, issuesTotalPages))}
                  disabled={issuesPage >= issuesTotalPages}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '0.76rem', padding: '0.25rem 0.6rem' }}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* Assign Modal                                                        */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <Modal
        isOpen={!!assignModalIssue}
        onClose={() => setAssignModalIssue(null)}
        title={assignModalIssue ? `Assign Defect ${assignModalIssue.issue_key}` : 'Assign Issue'}
        maxWidth="460px"
      >
        {assignModalIssue && (
          <form onSubmit={handleAssignSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <p style={{ margin: '0 0 0.85rem 0', fontSize: '0.86rem', color: 'var(--text-secondary)' }}>
                Select an active developer to investigate and resolve{' '}
                <strong>{assignModalIssue.title}</strong>.
              </p>

              {assignError && (
                <div
                  style={{
                    padding: '0.65rem',
                    borderRadius: '6px',
                    backgroundColor: 'rgba(239, 68, 68, 0.12)',
                    color: '#f87171',
                    fontSize: '0.82rem',
                    marginBottom: '0.85rem',
                  }}
                >
                  {assignError}
                </div>
              )}

              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.4rem' }}>
                Select Developer:
              </label>
              {devsLoading ? (
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Loading active developers…</div>
              ) : (
                <select
                  value={selectedDevId}
                  onChange={(e) => setSelectedDevId(Number(e.target.value))}
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.85rem',
                    fontSize: '0.86rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--bg-input, #0f172a)',
                    color: 'var(--text-primary)',
                  }}
                  required
                >
                  <option value="">— Choose a Developer —</option>
                  {availableDevs.map((dev) => (
                    <option key={dev.id} value={dev.id}>
                      {dev.full_name} ({dev.email})
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem' }}>
              <button
                type="button"
                onClick={() => setAssignModalIssue(null)}
                className="btn btn-secondary"
                disabled={assignLoading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={assignLoading || !selectedDevId}
              >
                {assignLoading ? 'Assigning…' : 'Assign Defect'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};
