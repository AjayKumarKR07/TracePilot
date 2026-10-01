/**
 * AdminProjectHealth
 * Shows per-project health from analytics API.
 * Respects is_test filtering via backend (non-test projects only via /analytics/projects).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronUp, ExternalLink, FolderGit2, RefreshCw } from 'lucide-react';
import { analyticsApi } from '../../api/analytics';
import type { ProjectAnalyticsResponse } from '../../types/analytics';

export const AdminProjectHealth: React.FC = () => {
  const [projects, setProjects] = useState<ProjectAnalyticsResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await analyticsApi.getAllProjectsAnalytics();
      setProjects(res.items || []);
    } catch {
      setError('Failed to load project data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function projectHealthColor(p: ProjectAnalyticsResponse): string {
    if (p.critical_issues > 5) return '#ef4444';
    if (p.resolution_rate < 40) return '#f59e0b';
    return '#10b981';
  }

  function projectHealthLabel(p: ProjectAnalyticsResponse): string {
    if (p.critical_issues > 5) return 'Critical';
    if (p.resolution_rate < 40) return 'At Risk';
    return 'Healthy';
  }

  const sorted = [...projects].sort((a, b) => (b.critical_issues - a.critical_issues));
  const visible = showAll ? sorted : sorted.slice(0, 6);

  return (
    <section className="card" style={{ marginBottom: '1.5rem', border: '1px solid var(--border-subtle)' }}>
      <div className="card-header" style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div style={{ width: '26px', height: '26px', borderRadius: '6px', background: 'rgba(99,102,241,0.15)', color: '#818cf8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FolderGit2 size={14} />
          </div>
          <h2 className="card-title" style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800 }}>Project Health</h2>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button onClick={load} disabled={loading} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}>
            <RefreshCw size={13} className={loading ? 'spin' : ''} />
          </button>
          <Link to="/projects" style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <ExternalLink size={12} /> Manage
          </Link>
        </div>
      </div>

      <div className="card-body" style={{ padding: '0.85rem 1.25rem' }}>
        {error ? (
          <div style={{ color: '#f87171', fontSize: '0.82rem', padding: '1rem', textAlign: 'center' }}>{error}</div>
        ) : loading ? (
          <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>Loading...</div>
        ) : projects.length === 0 ? (
          <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>No projects found</div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.65rem' }}>
              {visible.map((p) => {
                const hColor = projectHealthColor(p);
                const hLabel = projectHealthLabel(p);
                return (
                  <div key={p.project_id} style={{ padding: '0.85rem', borderRadius: '9px', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.project_name}</div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600 }}>{p.project_key}</div>
                      </div>
                      <span style={{ fontSize: '0.62rem', fontWeight: 800, color: hColor, background: `${hColor}18`, padding: '0.15rem 0.45rem', borderRadius: '4px', flexShrink: 0, marginLeft: '0.4rem' }}>
                        {hLabel}
                      </span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.35rem', fontSize: '0.7rem' }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{p.total_issues}</div>
                        <div style={{ color: 'var(--text-muted)' }}>Total</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontWeight: 800, color: '#ef4444' }}>{p.critical_issues}</div>
                        <div style={{ color: 'var(--text-muted)' }}>Critical</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontWeight: 800, color: '#10b981' }}>{p.resolution_rate.toFixed(0)}%</div>
                        <div style={{ color: 'var(--text-muted)' }}>Resolved</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {sorted.length > 6 && (
              <button onClick={() => setShowAll((v) => !v)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', margin: '0.75rem auto 0', padding: '0.3rem 0' }}>
                {showAll ? <><ChevronUp size={12} /> Show less</> : <><ChevronDown size={12} /> Show {sorted.length - 6} more</>}
              </button>
            )}
          </>
        )}
      </div>
    </section>
  );
};

export default AdminProjectHealth;
