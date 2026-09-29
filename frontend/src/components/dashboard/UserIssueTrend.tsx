/**
 * UserIssueTrend — My Issue Trend chart using Recharts (already installed).
 *
 * Data: computed from loaded userIssues (created_at for reported,
 *       updated_at for resolved/closed). No extra API call.
 * Modes: 7 days / 30 days.
 */
import React, { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { TrendingUp } from 'lucide-react';
import type { Issue } from '../../types/issue';

type Range = 7 | 30;

interface DataPoint {
  label: string;
  reported: number;
  resolved: number;
}

interface Props {
  userIssues: Issue[];
}

function buildTrendData(issues: Issue[], days: Range): DataPoint[] {
  const now = new Date();
  const points: DataPoint[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10); // YYYY-MM-DD

    const label =
      days === 7
        ? d.toLocaleDateString('en-US', { weekday: 'short' })
        : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    const reported = issues.filter((iss) => iss.created_at?.slice(0, 10) === key).length;
    const resolved = issues.filter(
      (iss) =>
        (iss.status === 'RESOLVED' || iss.status === 'CLOSED') &&
        iss.updated_at?.slice(0, 10) === key
    ).length;

    points.push({ label, reported, resolved });
  }

  return points;
}

export const UserIssueTrend: React.FC<Props> = ({ userIssues }) => {
  const [range, setRange] = useState<Range>(7);
  const data = useMemo(() => buildTrendData(userIssues, range), [userIssues, range]);

  const hasData = data.some((d) => d.reported > 0 || d.resolved > 0);

  return (
    <section className="card" style={{ padding: '1.25rem' }}>
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <TrendingUp size={18} color="#818cf8" />
          <span style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-primary)' }}>
            My Issue Trend
          </span>
        </div>
        <div style={{ display: 'flex', gap: '0.35rem' }}>
          {([7, 30] as Range[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              style={{
                padding: '0.2rem 0.65rem',
                fontSize: '0.75rem',
                fontWeight: 600,
                borderRadius: 'var(--radius-sm)',
                border: range === r ? '1px solid #818cf8' : '1px solid var(--border-muted)',
                backgroundColor: range === r ? 'rgba(129,140,248,0.15)' : 'transparent',
                color: range === r ? '#818cf8' : 'var(--text-secondary)',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {r === 7 ? '7 Days' : '30 Days'}
            </button>
          ))}
        </div>
      </div>

      {!hasData ? (
        <div
          style={{
            height: '160px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-muted)',
            fontSize: '0.85rem',
            textAlign: 'center',
            flexDirection: 'column',
            gap: '0.35rem',
          }}
        >
          <TrendingUp size={28} style={{ opacity: 0.25 }} />
          <span>Not enough issue history to display a trend.</span>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={data} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
            <defs>
              <linearGradient id="grad-reported" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#818cf8" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="grad-resolved" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#34d399" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
              axisLine={false}
              tickLine={false}
              interval={range === 30 ? 4 : 0}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                background: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '6px',
                fontSize: '0.78rem',
                color: 'var(--text-primary)',
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: '0.75rem', paddingTop: '0.4rem' }}
              formatter={(value) => (
                <span style={{ color: 'var(--text-secondary)' }}>
                  {value === 'reported' ? 'Reported' : 'Resolved/Closed'}
                </span>
              )}
            />
            <Area
              type="monotone"
              dataKey="reported"
              name="reported"
              stroke="#818cf8"
              strokeWidth={2}
              fill="url(#grad-reported)"
              dot={false}
              activeDot={{ r: 4 }}
            />
            <Area
              type="monotone"
              dataKey="resolved"
              name="resolved"
              stroke="#34d399"
              strokeWidth={2}
              fill="url(#grad-resolved)"
              dot={false}
              activeDot={{ r: 4 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </section>
  );
};
