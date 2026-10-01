/**
 * AdminDefectTrend
 * Recharts line chart showing issue trends from /analytics/issues/trends.
 * Supports 7 / 30 / 90 day windows with live API data.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { RefreshCw, TrendingUp } from 'lucide-react';
import { analyticsApi } from '../../api/analytics';
import type { IssueTrendItem } from '../../types/analytics';

type Window = 7 | 30 | 90;

function windowToDates(days: Window): { start_date: string; end_date: string; interval: 'day' | 'week' } {
  const now = new Date();
  const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  return {
    start_date: start.toISOString(),
    end_date: now.toISOString(),
    interval: days <= 30 ? 'day' : 'week',
  };
}

function formatDate(dateStr: string, window: Window): string {
  const d = new Date(dateStr);
  if (window <= 7) return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  if (window <= 30) return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export const AdminDefectTrend: React.FC = () => {
  const [window, setWindow] = useState<Window>(30);
  const [data, setData] = useState<IssueTrendItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (w: Window) => {
    setLoading(true);
    setError(null);
    try {
      const { start_date, end_date, interval } = windowToDates(w);
      const res = await analyticsApi.getTrends({ start_date, end_date, interval });
      setData(res.items || []);
    } catch {
      setError('Failed to load trend data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(window); }, [window, load]);

  const chartData = data.map((item) => ({
    date: formatDate(item.date, window),
    Reported: item.created_count,
    Resolved: item.resolved_count,
  }));

  const totalReported = data.reduce((s, d) => s + d.created_count, 0);
  const totalResolved = data.reduce((s, d) => s + d.resolved_count, 0);

  return (
    <section className="card" style={{ marginBottom: '1.5rem', border: '1px solid var(--border-subtle)' }}>
      <div className="card-header" style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div style={{ width: '26px', height: '26px', borderRadius: '6px', background: 'rgba(59,130,246,0.15)', color: '#60a5fa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <TrendingUp size={14} />
          </div>
          <div>
            <h2 className="card-title" style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800 }}>Defect Trend Analytics</h2>
            <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
              {window}-day window &mdash; {totalReported} reported, {totalResolved} resolved
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {([7, 30, 90] as Window[]).map((w) => (
            <button
              key={w}
              onClick={() => setWindow(w)}
              style={{
                padding: '0.3rem 0.7rem',
                borderRadius: '6px',
                fontSize: '0.72rem',
                fontWeight: 700,
                border: `1px solid ${window === w ? '#3b82f6' : 'var(--border-subtle)'}`,
                background: window === w ? 'rgba(59,130,246,0.15)' : 'transparent',
                color: window === w ? '#60a5fa' : 'var(--text-muted)',
                cursor: 'pointer',
              }}
            >
              {w}d
            </button>
          ))}
          <button onClick={() => load(window)} disabled={loading} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
          </button>
        </div>
      </div>

      <div className="card-body" style={{ padding: '1.25rem' }}>
        {error ? (
          <div style={{ color: '#f87171', fontSize: '0.82rem', padding: '1rem', textAlign: 'center' }}>{error}</div>
        ) : loading ? (
          <div style={{ height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>Loading...</div>
        ) : chartData.length === 0 ? (
          <div style={{ height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>No trend data available for this period.</div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} allowDecimals={false} />
              <Tooltip
                contentStyle={{ background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', borderRadius: '8px', fontSize: '0.78rem' }}
                labelStyle={{ color: 'var(--text-primary)', fontWeight: 700 }}
              />
              <Legend wrapperStyle={{ fontSize: '0.75rem' }} />
              <Line type="monotone" dataKey="Reported" stroke="#f87171" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              <Line type="monotone" dataKey="Resolved" stroke="#10b981" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
};

export default AdminDefectTrend;
