import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { SprintService } from "../services/SprintService";
import { issuesApi } from "../api/issues";
import { usersApi } from "../api/users";
import type { Sprint, SprintAnalytics, SprintOverview } from "../types/Sprint";
import type { Issue } from "../types/issue";
import type { UserDetail } from "../types/user";
import { LoadingSpinner } from "../components/common/LoadingSpinner";
import { ErrorMessage } from "../components/common/ErrorMessage";
import { EmptyState } from "../components/common/EmptyState";
import { getApiErrorMessage } from "../api/client";
import { Modal } from "../components/common/Modal";
import { useAuth } from "../hooks/useAuth";
import { Plus, Download, Play, CheckCircle2, Trash2, Calendar, Archive, AlertTriangle, TrendingUp, Activity, Users, Target, UserCheck, RotateCcw } from "lucide-react";
import { SprintLifecycleIndicator } from "../components/sprints/SprintLifecycleIndicator";
import { formatDate } from "../utils/formatters";
import { Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, AreaChart, Area, ComposedChart } from "recharts";

const STATUS_COLORS: Record<string, string> = { open: "#6366f1", in_progress: "#f59e0b", resolved: "#10b981", closed: "#94a3b8" };
const HEALTH_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  ON_TRACK: { color: "#10b981", bg: "rgba(16,185,129,0.15)", label: "On Track" },
  AT_RISK: { color: "#f59e0b", bg: "rgba(245,158,11,0.15)", label: "At Risk" },
  OFF_TRACK: { color: "#ef4444", bg: "rgba(239,68,68,0.15)", label: "Off Track" },
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)", padding: "0.75rem 1rem", fontSize: "0.82rem", color: "var(--text-primary)", boxShadow: "var(--shadow-md)" }}>
      {label && <div style={{ fontWeight: 700, marginBottom: "0.4rem", color: "var(--text-secondary)" }}>{label}</div>}
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: p.color }} />
          <span style={{ color: "var(--text-secondary)" }}>{p.name}:</span>
          <span style={{ fontWeight: 600 }}>{p.value}</span>
        </div>
      ))}
    </div>
  );
};

const IssueCompositionChart: React.FC<{ analytics: SprintAnalytics }> = ({ analytics }) => {
  const data = [
    { name: "Open", value: analytics.open_issues, color: STATUS_COLORS.open },
    { name: "In Progress", value: analytics.in_progress_issues, color: STATUS_COLORS.in_progress },
    { name: "Resolved", value: analytics.resolved_issues, color: STATUS_COLORS.resolved },
    { name: "Closed", value: analytics.closed_issues, color: STATUS_COLORS.closed },
  ].filter((d) => d.value > 0);
  const total = analytics.total_issues;
  if (total === 0) return (
    <div style={{ height: 200, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>
      <Target size={32} style={{ marginBottom: "0.5rem", opacity: 0.4 }} />
      <span style={{ fontSize: "0.85rem" }}>No issues in sprint yet</span>
    </div>
  );
  return (
    <div style={{ height: 200, display: "flex", alignItems: "center", gap: "1rem" }}>
      <ResponsiveContainer width="55%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" cx="50%" cy="50%" innerRadius={50} outerRadius={80} strokeWidth={0} paddingAngle={3}>
            {data.map((d, i) => <Cell key={i} fill={d.color} />)}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", flex: 1 }}>
        {data.map((d, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: d.color, flexShrink: 0 }} />
              <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>{d.name}</span>
            </div>
            <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
              <span style={{ fontSize: "0.85rem", fontWeight: 700 }}>{d.value}</span>
              <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>({Math.round((d.value / total) * 100)}%)</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const BurndownChartPanel: React.FC<{ analytics: SprintAnalytics; sprint: Sprint }> = ({ analytics, sprint }) => {
  const hasData = analytics.burndown_points && analytics.burndown_points.length > 0;
  if (!hasData) {
    const start = new Date(sprint.start_date);
    const end = new Date(sprint.end_date);
    const totalDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000));
    const total = analytics.total_issues || 0;
    if (total === 0) return (
      <div style={{ height: 240, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", textAlign: "center", padding: "1rem" }}>
        <TrendingUp size={32} style={{ marginBottom: "0.5rem", opacity: 0.4 }} />
        <p style={{ margin: 0, fontWeight: 500, fontSize: "0.9rem" }}>No burndown data yet</p>
        <p style={{ margin: "0.35rem 0 0", fontSize: "0.78rem" }}>Add issues and start the sprint to begin tracking</p>
      </div>
    );
    const step = Math.max(1, Math.ceil(totalDays / 10));
    const idealPoints: { date: string; ideal: number }[] = [];
    for (let i = 0; i <= totalDays; i += step) {
      const d = new Date(start); d.setDate(d.getDate() + i);
      idealPoints.push({ date: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }), ideal: Math.round(total - (total / totalDays) * i) });
    }
    return (
      <div>
        <div style={{ marginBottom: "0.5rem", padding: "0.5rem 0.75rem", background: "rgba(99,102,241,0.1)", borderRadius: "6px", fontSize: "0.78rem", color: "#94a3b8", display: "flex", alignItems: "center", gap: "0.4rem" }}>
          <Activity size={13} /> Showing ideal trajectory - actual data appears as issues are resolved
        </div>
        <div style={{ height: 210 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={idealPoints}>
              <defs>
                <linearGradient id="idealGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="date" stroke="#475569" fontSize={10} tick={{ fill: "#64748b" }} />
              <YAxis stroke="#475569" fontSize={10} tick={{ fill: "#64748b" }} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="ideal" stroke="#6366f1" strokeDasharray="6 3" strokeWidth={2} fill="url(#idealGrad)" name="Ideal Remaining" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }
  return (
    <div style={{ height: 240 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={analytics.burndown_points}>
          <defs>
            <linearGradient id="actualGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis dataKey="date" stroke="#475569" fontSize={10} tick={{ fill: "#64748b" }} />
          <YAxis stroke="#475569" fontSize={10} tick={{ fill: "#64748b" }} allowDecimals={false} />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: "0.78rem", paddingTop: "6px", color: "#94a3b8" }} />
          <Line type="monotone" dataKey="ideal" stroke="#475569" strokeDasharray="6 3" name="Ideal" dot={false} strokeWidth={1.5} />
          <Area type="monotone" dataKey="remaining" stroke="#6366f1" strokeWidth={2.5} fill="url(#actualGrad)" name="Actual Remaining" dot={{ r: 3, fill: "#6366f1", strokeWidth: 0 }} activeDot={{ r: 5 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

const TeamWorkloadChart: React.FC<{ workload: SprintAnalytics["workload"] }> = ({ workload }) => {
  if (workload.length === 0) return (
    <div style={{ height: 200, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>
      <Users size={32} style={{ marginBottom: "0.5rem", opacity: 0.4 }} />
      <span style={{ fontSize: "0.85rem" }}>No workload data yet</span>
    </div>
  );
  const data = workload.map((wl) => ({
    name: (wl.tester_name || wl.developer_name || "DEVELOPER").split(" ")[0],
    Completed: wl.completed_issues,
    "In Progress": wl.in_progress_issues,
    Open: wl.open_issues,
  }));
  return (
    <div>
      <div style={{ height: 190, marginBottom: "1rem" }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barSize={16}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
            <XAxis dataKey="name" stroke="#475569" fontSize={10} tick={{ fill: "#64748b" }} />
            <YAxis stroke="#475569" fontSize={10} tick={{ fill: "#64748b" }} allowDecimals={false} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: "0.75rem", color: "#94a3b8" }} />
            <Bar dataKey="Completed" fill="#10b981" stackId="a" />
            <Bar dataKey="In Progress" fill="#f59e0b" stackId="a" />
            <Bar dataKey="Open" fill="#6366f1" stackId="a" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Real Team Member Workload Breakdown Table */}
      <div className="table-container" style={{ marginTop: "0.5rem" }}>
        <table className="data-table" style={{ fontSize: "0.82rem" }}>
          <thead>
            <tr>
              <th>Member Name</th>
              <th>Role</th>
              <th>Assigned Issues</th>
              <th>Estimated Effort</th>
              <th>Completed</th>
              <th>Remaining</th>
              <th>Workload %</th>
            </tr>
          </thead>
          <tbody>
            {workload.map((wl) => (
              <tr key={wl.tester_id || wl.developer_id}>
                <td style={{ fontWeight: 600, color: "#f8fafc" }}>{wl.tester_name || wl.developer_name}</td>
                <td>
                  <span style={{
                    fontSize: "0.7rem",
                    padding: "0.15rem 0.5rem",
                    borderRadius: "10px",
                    background: "rgba(99,102,241,0.15)",
                    color: "#818cf8",
                    fontWeight: 600,
                  }}>
                    {wl.role || "DEVELOPER"}
                  </span>
                </td>
                <td style={{ fontWeight: 700 }}>{wl.assigned_issues}</td>
                <td style={{ color: "#a78bfa", fontWeight: 600 }}>{wl.estimated_effort ?? 0} pts</td>
                <td style={{ color: "#10b981", fontWeight: 700 }}>{wl.completed_issues}</td>
                <td style={{ color: (wl.remaining_issues ?? 0) > 0 ? "#f59e0b" : "#94a3b8", fontWeight: 600 }}>
                  {wl.remaining_issues ?? (wl.assigned_issues - wl.completed_issues)}
                </td>
                <td>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <div style={{ flex: 1, height: "5px", background: "var(--bg-primary)", borderRadius: "3px", overflow: "hidden", minWidth: "45px" }}>
                      <div style={{ width: `${wl.workload_percentage ?? 0}%`, height: "100%", background: "#6366f1", borderRadius: "3px" }} />
                    </div>
                    <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)" }}>
                      {wl.workload_percentage ?? 0}%
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const SprintComparisonChart: React.FC<{ sprints: Sprint[]; analytics: Record<number, SprintAnalytics> }> = ({ sprints, analytics }) => {
  const data = sprints.filter((s) => analytics[s.id]).map((s) => ({
    name: s.name.length > 18 ? s.name.slice(0, 17) + "..." : s.name,
    "Completion %": analytics[s.id].completion_rate,
    "Total Issues": analytics[s.id].total_issues,
    Completed: analytics[s.id].completed_issues,
    Velocity: analytics[s.id].completed_issues,
  }));
  if (data.length === 0) return null;
  return (
    <div style={{ height: 200 }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} barGap={4}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
          <XAxis dataKey="name" stroke="#475569" fontSize={10} tick={{ fill: "#64748b" }} />
          <YAxis yAxisId="left" stroke="#475569" fontSize={10} tick={{ fill: "#64748b" }} allowDecimals={false} />
          <YAxis yAxisId="right" orientation="right" stroke="#475569" fontSize={10} tick={{ fill: "#64748b" }} tickFormatter={(v) => `${v}%`} domain={[0, 100]} />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: "0.75rem", color: "#94a3b8" }} />
          <Bar yAxisId="left" dataKey="Total Issues" fill="#334155" barSize={12} radius={[3, 3, 0, 0]} />
          <Bar yAxisId="left" dataKey="Completed" fill="#6366f1" barSize={12} radius={[3, 3, 0, 0]} />
          <Bar yAxisId="left" dataKey="Velocity" fill="#38bdf8" barSize={12} radius={[3, 3, 0, 0]} />
          <Line yAxisId="right" type="monotone" dataKey="Completion %" stroke="#10b981" strokeWidth={2} dot={{ r: 4, fill: "#10b981" }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

export const SprintsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const projectId = Number(id);
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";

  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [overview, setOverview] = useState<SprintOverview | null>(null);
  const [sprintIssues, setSprintIssues] = useState<Record<number, Issue[]>>({});
  const [analytics, setAnalytics] = useState<Record<number, SprintAnalytics>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [formName, setFormName] = useState("");
  const [formGoal, setFormGoal] = useState("");
  const [formStart, setFormStart] = useState("");
  const [formEnd, setFormEnd] = useState("");
  const [formCapacityMembers, setFormCapacityMembers] = useState("");
  const [formCapacityDays, setFormCapacityDays] = useState("");
  const [formCapacityHours, setFormCapacityHours] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);


  const [isExtendOpen, setIsExtendOpen] = useState(false);
  const [extendSprintId, setExtendSprintId] = useState<number | null>(null);
  const [formExtendEnd, setFormExtendEnd] = useState("");

  // Assign tester state
  const [isAssignTesterOpen, setIsAssignTesterOpen] = useState(false);
  const [assignTesterSprintId, setAssignTesterSprintId] = useState<number | null>(null);
  const [testerList, setTesterList] = useState<UserDetail[]>([]);
  const [selectedTesterId, setSelectedTesterId] = useState<number | "">("");
  const [assigningTester, setAssigningTester] = useState(false);

  const fetchData = async () => {
    setIsLoading(true); setError(null);
    try {
      const [sprintsData, overviewData] = await Promise.all([
        SprintService.getSprintsByProject(projectId),
        SprintService.getProjectSprintSummary(projectId),
      ]);
      const sortedSprints = [...sprintsData].sort((a, b) => b.id - a.id);
      setSprints(sortedSprints); setOverview(overviewData);
      const issuesMap: Record<number, Issue[]> = {};
      const analyticsMap: Record<number, SprintAnalytics> = {};
      await Promise.all(sprintsData.map(async (sprint) => {
        const [issuesResponse, analyticsResponse] = await Promise.all([
          issuesApi.list({ sprint_id: sprint.id, page_size: 100 }),
          SprintService.getSprintAnalytics(sprint.id),
        ]);
        issuesMap[sprint.id] = issuesResponse.items;
        analyticsMap[sprint.id] = analyticsResponse;
      }));
      setSprintIssues(issuesMap); setAnalytics(analyticsMap);
    } catch (err) { setError(getApiErrorMessage(err)); }
    finally { setIsLoading(false); }
  };

  useEffect(() => { if (projectId) fetchData(); }, [projectId]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setFormError(null); setIsSubmitting(true);
    try {
      await SprintService.createSprint({ name: formName, goal: formGoal || null, start_date: new Date(formStart).toISOString(), end_date: new Date(formEnd).toISOString(), project_id: projectId, estimated_team_members: formCapacityMembers ? parseInt(formCapacityMembers) : null, working_days: formCapacityDays ? parseInt(formCapacityDays) : null, hours_per_day: formCapacityHours ? parseInt(formCapacityHours) : null });
      setIsCreateOpen(false); fetchData();
    } catch (err) { setFormError(getApiErrorMessage(err)); }
    finally { setIsSubmitting(false); }
  };

  const handleStartSprint = async (sprintId: number) => { try { await SprintService.startSprint(sprintId); fetchData(); } catch (err) { alert(getApiErrorMessage(err)); } };
  const handleRemoveIssue = async (sprintId: number, issueId: number) => { if (!window.confirm("Remove this issue from the sprint?")) return; try { await SprintService.removeIssueFromSprint(sprintId, issueId); fetchData(); } catch (err) { alert(getApiErrorMessage(err)); } };
  const handleArchiveSprint = async (sprintId: number) => { if (!window.confirm("Archive this sprint?")) return; try { await SprintService.archiveSprint(sprintId); fetchData(); } catch (err) { alert(getApiErrorMessage(err)); } };
  const handleExtendSubmit = async (e: React.FormEvent) => { e.preventDefault(); if (!extendSprintId || !formExtendEnd) return; try { await SprintService.extendSprint(extendSprintId, { new_end_date: new Date(formExtendEnd).toISOString() }); setIsExtendOpen(false); fetchData(); } catch (err) { alert(getApiErrorMessage(err)); } };
  const handleDeleteSprint = async (sprint: Sprint) => {
    const isCompleted = sprint.status === 'COMPLETED';
    const confirmMessage = isCompleted
      ? `Delete completed sprint '${sprint.name}'?\n\nâ€¢ The sprint itself will be deleted.\nâ€¢ All linked issues and defect records will remain intact in the system.\nâ€¢ Issue status, resolution details, comments, and attachments will remain.\nâ€¢ Issues will simply become unassigned from this sprint.\n\nAre you sure you want to proceed?`
      : `Permanently delete planned sprint '${sprint.name}'?`;
    if (!window.confirm(confirmMessage)) return;
    try {
      await SprintService.deleteSprint(sprint.id);
      fetchData();
    } catch (err) {
      alert(getApiErrorMessage(err));
    }
  };

  const openAssignTesterModal = async (sprintId: number) => {
    setAssignTesterSprintId(sprintId);
    setSelectedTesterId("");
    setIsAssignTesterOpen(true);
    try {
      const res = await usersApi.list({ role: 'DEVELOPER', is_active: true, page_size: 100 });
      setTesterList(res.items);
    } catch (err) { console.error(err); }
  };

  const handleAssignTester = async () => {
    if (!assignTesterSprintId || !selectedTesterId) return;
    setAssigningTester(true);
    try {
      await SprintService.assignTester(assignTesterSprintId, Number(selectedTesterId));
      setIsAssignTesterOpen(false);
      fetchData();
    } catch (err) { alert(getApiErrorMessage(err)); }
    finally { setAssigningTester(false); }
  };

  if (isLoading) return <LoadingSpinner message="Loading sprints..." />;
  if (error) return <ErrorMessage message={error} onRetry={fetchData} />;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Sprints Dashboard</h1>
          <p className="page-subtitle">Manage agile sprints, track progress, and view analytics.</p>
        </div>
        {isAdmin && <button className="btn btn-primary" onClick={() => setIsCreateOpen(true)}><Plus size={16} /> Create Sprint</button>}
      </div>

      {overview && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
          {[
            { label: "Total Sprints", value: overview.total_sprints, suffix: "", color: "#6366f1" },
            { label: "Completed", value: overview.completed_sprints, suffix: "", color: "#10b981" },
            { label: "Avg Velocity", value: overview.avg_velocity, suffix: " pts", color: "#f59e0b" },
            { label: "Avg Completion", value: overview.avg_completion_rate, suffix: "%", color: "#06b6d4" },
            { label: "Overdue Sprints", value: overview.overdue_sprints, suffix: "", color: overview.overdue_sprints > 0 ? "#ef4444" : "#94a3b8" },
          ].map((kpi, i) => (
            <div key={i} className="card" style={{ padding: "1.25rem 1.5rem", background: "var(--bg-secondary)", border: "1px solid var(--border)", borderTop: `3px solid ${kpi.color}` }}>
              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginBottom: "0.4rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>{kpi.label}</div>
              <div style={{ fontSize: "1.8rem", fontWeight: 800, color: kpi.color, lineHeight: 1 }}>{kpi.value}{kpi.suffix}</div>
            </div>
          ))}
        </div>
      )}

      {sprints.length > 1 && Object.keys(analytics).length > 0 && (
        <div className="card" style={{ padding: "1.25rem", marginBottom: "1.5rem", border: "1px solid var(--border)" }}>
          <h3 style={{ margin: "0 0 1rem 0", fontSize: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <TrendingUp size={16} style={{ color: "#6366f1" }} /> Sprint Comparison
          </h3>
          <SprintComparisonChart sprints={sprints} analytics={analytics} />
        </div>
      )}

      {sprints.length === 0 ? (
        <EmptyState title="No sprints found" description="Create your first sprint to start planning work." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
          {sprints.map((sprint) => {
            const sa = analytics[sprint.id];
            const healthCfg = sa?.sprint_health ? HEALTH_CONFIG[sa.sprint_health] : null;
            return (
              <div key={sprint.id} className="card" style={{ padding: "1.5rem", border: "1px solid var(--border)" }}>
                {/* Agile Sprint Lifecycle Indicator */}
                <div style={{ marginBottom: "1.25rem" }}>
                  <SprintLifecycleIndicator
                    status={sprint.status}
                    hasReviewComment={Boolean(sprint.review_comment)}
                  />
                </div>

                {/* COMPLETED Sprint Agile Showcase */}
                {sprint.status === "COMPLETED" && (sa?.total_issues ?? 0) > 0 && (
                  <div style={{
                    marginBottom: "1.25rem",
                    padding: "1rem 1.25rem",
                    background: "rgba(16, 185, 129, 0.08)",
                    border: "1px solid rgba(16, 185, 129, 0.3)",
                    borderRadius: "10px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.75rem",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                        <CheckCircle2 size={20} style={{ color: "#10b981" }} />
                        <span style={{ fontSize: "1rem", fontWeight: 700, color: "#34d399", letterSpacing: "0.02em" }}>
                          âœ“ COMPLETED
                        </span>
                      </div>
                    </div>
                    
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "0.75rem" }}>
                      <div style={{ padding: "0.6rem 0.75rem", background: "var(--bg-secondary)", borderRadius: "6px", border: "1px solid var(--border)" }}>
                        <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Progress</div>
                        <div style={{ fontSize: "1.15rem", fontWeight: 800, color: "#10b981" }}>{sa?.completion_rate ?? 0}%</div>
                      </div>
                      <div style={{ padding: "0.6rem 0.75rem", background: "var(--bg-secondary)", borderRadius: "6px", border: "1px solid var(--border)" }}>
                        <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Issues Completed</div>
                        <div style={{ fontSize: "1.15rem", fontWeight: 800, color: "#34d399" }}>{sa?.completed_issues ?? 0} / {sa?.total_issues ?? 0} completed</div>
                      </div>
                      <div style={{ padding: "0.6rem 0.75rem", background: "var(--bg-secondary)", borderRadius: "6px", border: "1px solid var(--border)" }}>
                        <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Remaining</div>
                        <div style={{ fontSize: "1.15rem", fontWeight: 800, color: "#94a3b8" }}>{sa?.remaining_issues ?? 0}</div>
                      </div>
                      <div style={{ padding: "0.6rem 0.75rem", background: "var(--bg-secondary)", borderRadius: "6px", border: "1px solid var(--border)" }}>
                        <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Velocity</div>
                        <div style={{ fontSize: "1.15rem", fontWeight: 800, color: "#f59e0b" }}>{sa?.completed_issues ?? 0} pts</div>
                      </div>
                    </div>
                  </div>
                )}

                {(sa?.total_issues ?? 0) === 0 && (
                  <div style={{
                    marginBottom: "1.25rem",
                    padding: "0.85rem 1.25rem",
                    background: "rgba(239, 68, 68, 0.1)",
                    border: "1px solid rgba(239, 68, 68, 0.3)",
                    borderRadius: "8px",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.6rem",
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    color: "#f87171",
                  }}>
                    <AlertTriangle size={18} />
                    <span>âš  Sprint has no issues assigned. Add backlog issues before starting/approving this sprint.</span>
                  </div>
                )}

                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1.25rem", borderBottom: "1px solid var(--border)", paddingBottom: "1rem", flexWrap: "wrap", gap: "0.75rem" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                      <h3 style={{ margin: 0, fontSize: "1.3rem" }}>{sprint.name}</h3>
                      <span style={{
                        fontSize: "0.75rem", padding: "0.2rem 0.65rem", borderRadius: "12px", fontWeight: 600,
                        backgroundColor:
                          sprint.status === "ACTIVE" ? "rgba(99,102,241,0.2)" :
                          sprint.status === "IN_PROGRESS" ? "rgba(245,158,11,0.2)" :
                          sprint.status === "READY_FOR_APPROVAL" ? "rgba(6,182,212,0.2)" :
                          sprint.status === "COMPLETED" ? "rgba(16,185,129,0.2)" : "var(--bg-secondary)",
                        color:
                          sprint.status === "ACTIVE" ? "#818cf8" :
                          sprint.status === "IN_PROGRESS" ? "#fbbf24" :
                          sprint.status === "READY_FOR_APPROVAL" ? "#22d3ee" :
                          sprint.status === "COMPLETED" ? "#34d399" : "var(--text-muted)",
                        border: `1px solid ${
                          sprint.status === "ACTIVE" ? "#4f46e5" :
                          sprint.status === "IN_PROGRESS" ? "#d97706" :
                          sprint.status === "READY_FOR_APPROVAL" ? "#0891b2" :
                          sprint.status === "COMPLETED" ? "#059669" : "var(--border)"
                        }`
                      }}>
                        {sprint.status === "IN_PROGRESS" ? "In Progress" :
                         sprint.status === "READY_FOR_APPROVAL" ? "Awaiting Approval" :
                         sprint.status}
                      </span>
                      {sprint.assigned_tester_name && (
                        <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "0.3rem" }}>
                          <UserCheck size={12} /> {sprint.assigned_tester_name}
                        </span>
                      )}
                      {healthCfg && <span style={{ fontSize: "0.72rem", padding: "0.2rem 0.6rem", borderRadius: "12px", fontWeight: 600, backgroundColor: healthCfg.bg, color: healthCfg.color, border: `1px solid ${healthCfg.color}44` }}>{healthCfg.label}</span>}
                    </div>
                    <p style={{ margin: "0.4rem 0 0.25rem", color: "var(--text-secondary)", fontSize: "0.9rem" }}>{sprint.goal}</p>
                    <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "0.4rem" }}><Calendar size={12} /> {formatDate(sprint.start_date)} - {formatDate(sprint.end_date)}</p>
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start", flexWrap: "wrap" }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => SprintService.downloadSprintReport(sprint.id, sprint.name)}><Download size={14} /> PDF Report</button>
                    {isAdmin && sprint.status === "PLANNED" && <button className="btn btn-primary btn-sm" onClick={() => handleStartSprint(sprint.id)}><Play size={14} /> Start Sprint</button>}
                    {isAdmin && (sprint.status === "ACTIVE" || sprint.status === "PLANNED") && <button className="btn btn-secondary btn-sm" onClick={() => { setExtendSprintId(sprint.id); setIsExtendOpen(true); }}><Calendar size={14} /> Extend</button>}
                    {isAdmin && sprint.status === "READY_FOR_APPROVAL" && <Link to="/admin/sprint-approvals" className="btn btn-primary btn-sm"><CheckCircle2 size={14} /> Review in Approvals</Link>}
                    {isAdmin && sprint.status === "COMPLETED" && <button className="btn btn-secondary btn-sm" onClick={() => handleArchiveSprint(sprint.id)}><Archive size={14} /> Archive</button>}
                    {isAdmin && (sprint.status === "PLANNED" || sprint.status === "COMPLETED") && (
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDeleteSprint(sprint)}
                        title={sprint.status === "COMPLETED" ? "Delete Completed Sprint (Defect data preserved)" : "Delete Planned Sprint"}
                      >
                        <Trash2 size={14} /> Delete
                      </button>
                    )}
                    {isAdmin && (sprint.status === "PLANNED" || sprint.status === "ACTIVE" || sprint.status === "IN_PROGRESS") && (
                      <button className="btn btn-secondary btn-sm" onClick={() => openAssignTesterModal(sprint.id)}>
                        <UserCheck size={14} /> {sprint.assigned_tester_name ? 'Reassign Tester' : 'Assign Tester'}
                      </button>
                    )}
                  </div>
                </div>

                {sa?.is_overdue && (
                  <div className="alert-box alert-danger" style={{ marginBottom: "1.25rem", display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem" }}>
                    <AlertTriangle size={16} /> This sprint is overdue by {sa.days_overdue} day{sa.days_overdue !== 1 ? "s" : ""}!
                  </div>
                )}

                {sprint.review_comment && sprint.status === "IN_PROGRESS" && (
                  <div style={{ marginBottom: "1.25rem", padding: "0.85rem 1rem", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.4)", borderRadius: "8px", borderLeft: "4px solid #f59e0b", display: "flex", alignItems: "flex-start", gap: "0.75rem", fontSize: "0.875rem" }}>
                    <RotateCcw size={16} style={{ color: "#f59e0b", flexShrink: 0, marginTop: "0.1rem" }} />
                    <div>
                      <strong style={{ color: "#fbbf24" }}>Changes Requested by Admin:</strong>
                      <p style={{ margin: "0.25rem 0 0", color: "var(--text-secondary)" }}>{sprint.review_comment}</p>
                    </div>
                  </div>
                )}

                {sa && (
                  <>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "0.75rem", marginBottom: "1.5rem" }}>
                      {[
                        { label: "Progress", value: `${sa.completion_rate}%`, color: "#6366f1", bar: sa.completion_rate },
                        { label: "Total Scope", value: `${sa.total_issues} issues`, color: "#94a3b8", bar: null },
                        { label: "Completed", value: `${sa.completed_issues} issues`, color: "#10b981", bar: null },
                        { label: "Remaining", value: `${sa.remaining_issues} issues`, color: "#f59e0b", bar: null },
                        { label: "Capacity", value: sa.total_capacity_hours ? `${sa.total_capacity_hours} hrs` : "Not set", color: "#06b6d4", bar: null },
                        { label: "Est. Effort", value: `${sa.total_estimated_effort} pts`, color: "#a78bfa", bar: null },
                      ].map((stat, i) => (
                        <div key={i} className="card" style={{ padding: "0.85rem 1rem", backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
                          <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginBottom: "0.3rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>{stat.label}</div>
                          <div style={{ fontSize: "1.15rem", fontWeight: 700, color: stat.color }}>{stat.value}</div>
                          {stat.bar !== null && (
                            <div style={{ marginTop: "0.4rem", height: "4px", background: "var(--bg-primary)", borderRadius: "2px", overflow: "hidden" }}>
                              <div style={{ width: `${stat.bar}%`, height: "100%", background: stat.color, borderRadius: "2px", transition: "width 0.5s ease" }} />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
                      <div className="card" style={{ padding: "1rem", border: "1px solid var(--border)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                          <h4 style={{ margin: 0, fontSize: "0.95rem", display: "flex", alignItems: "center", gap: "0.4rem" }}><TrendingUp size={14} style={{ color: "#6366f1" }} /> Burndown Chart</h4>
                          <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>{sa.burndown_points?.length > 0 ? `${sa.burndown_points.length} data points` : "Ideal trajectory"}</span>
                        </div>
                        <BurndownChartPanel analytics={sa} sprint={sprint} />
                      </div>
                      <div className="card" style={{ padding: "1rem", border: "1px solid var(--border)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                          <h4 style={{ margin: 0, fontSize: "0.95rem", display: "flex", alignItems: "center", gap: "0.4rem" }}><Target size={14} style={{ color: "#f59e0b" }} /> Issue Breakdown</h4>
                          <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>{sa.total_issues} total</span>
                        </div>
                        <IssueCompositionChart analytics={sa} />
                      </div>
                    </div>

                    <div className="card" style={{ padding: "1rem", border: "1px solid var(--border)", marginBottom: "1.5rem" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                        <h4 style={{ margin: 0, fontSize: "0.95rem", display: "flex", alignItems: "center", gap: "0.4rem" }}><Users size={14} style={{ color: "#10b981" }} /> Team Workload Distribution</h4>
                        <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>{sa.workload.length} members</span>
                      </div>
                      <TeamWorkloadChart workload={sa.workload} />
                    </div>
                  </>
                )}

                <h4 style={{ marginBottom: "0.75rem", fontSize: "0.95rem" }}>Sprint Issues</h4>
                {sprintIssues[sprint.id]?.length === 0 ? (
                  <p style={{ fontSize: "0.875rem", color: "var(--text-muted)", fontStyle: "italic" }}>No issues assigned to this sprint.</p>
                ) : (
                  <div className="table-container">
                    <table className="data-table">
                      <thead><tr><th>Key</th><th>Title</th><th>Status</th>{isAdmin && sprint.status !== "COMPLETED" && <th>Action</th>}</tr></thead>
                      <tbody>
                        {sprintIssues[sprint.id]?.map((issue) => (
                          <tr key={issue.id}>
                            <td><Link to={`/issues/${issue.id}`} className="text-primary font-mono">{issue.issue_key}</Link></td>
                            <td>{issue.title}</td>
                            <td>{issue.status}</td>
                            {isAdmin && sprint.status !== "COMPLETED" && <td><button className="btn btn-secondary btn-sm" onClick={() => handleRemoveIssue(sprint.id, issue.id)}>Remove</button></td>}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Create Sprint">
        {formError && <div className="alert-box alert-danger">{formError}</div>}
        <form onSubmit={handleCreateSubmit}>
          <div className="form-group"><label className="form-label">Sprint Name *</label><input type="text" className="form-input" required value={formName} onChange={(e) => setFormName(e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Sprint Goal</label><textarea className="form-textarea" value={formGoal} onChange={(e) => setFormGoal(e.target.value)} /></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div className="form-group"><label className="form-label">Start Date *</label><input type="date" className="form-input" required value={formStart} onChange={(e) => setFormStart(e.target.value)} /></div>
            <div className="form-group"><label className="form-label">End Date *</label><input type="date" className="form-input" required value={formEnd} onChange={(e) => setFormEnd(e.target.value)} /></div>
          </div>
          <h4 style={{ margin: "1.5rem 0 0.5rem", paddingBottom: "0.5rem", borderBottom: "1px solid var(--border)" }}>Capacity Planning (Optional)</h4>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem" }}>
            <div className="form-group"><label className="form-label">Team Members</label><input type="number" className="form-input" min="1" value={formCapacityMembers} onChange={(e) => setFormCapacityMembers(e.target.value)} placeholder="e.g. 5" /></div>
            <div className="form-group"><label className="form-label">Working Days</label><input type="number" className="form-input" min="1" value={formCapacityDays} onChange={(e) => setFormCapacityDays(e.target.value)} placeholder="e.g. 10" /></div>
            <div className="form-group"><label className="form-label">Hours / Day</label><input type="number" className="form-input" min="1" value={formCapacityHours} onChange={(e) => setFormCapacityHours(e.target.value)} placeholder="e.g. 8" /></div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1.5rem" }}>
            <button type="button" className="btn btn-secondary" onClick={() => setIsCreateOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>Create Sprint</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isExtendOpen} onClose={() => setIsExtendOpen(false)} title="Extend Sprint">
        <form onSubmit={handleExtendSubmit}>
          <div className="form-group"><label className="form-label">New End Date *</label><input type="date" className="form-input" required value={formExtendEnd} onChange={(e) => setFormExtendEnd(e.target.value)} /></div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1.25rem" }}>
            <button type="button" className="btn btn-secondary" onClick={() => setIsExtendOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary">Extend Sprint</button>
          </div>
        </form>
      </Modal>

      {/* Assign Tester Modal */}
      <Modal isOpen={isAssignTesterOpen} onClose={() => setIsAssignTesterOpen(false)} title="Assign Tester to Sprint">
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <p style={{ fontSize: "0.9rem", color: "var(--text-secondary)", margin: 0 }}>
            Select a tester to assign. The sprint will move to <strong>ACTIVE</strong> if currently PLANNED.
          </p>
          <div className="form-group">
            <label className="form-label">Tester</label>
            <select
              className="form-select"
              value={selectedTesterId}
              onChange={e => setSelectedTesterId(Number(e.target.value) || "")}
            >
              <option value="">â€” Select a tester â€”</option>
              {testerList.map(t => (
                <option key={t.id} value={t.id}>{t.full_name} ({t.email})</option>
              ))}
            </select>
            {testerList.length === 0 && (
              <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "0.5rem" }}>No active testers found.</p>
            )}
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
            <button className="btn btn-secondary" onClick={() => setIsAssignTesterOpen(false)}>Cancel</button>
            <button
              className="btn btn-primary"
              disabled={!selectedTesterId || assigningTester}
              onClick={handleAssignTester}
            >
              {assigningTester ? "Assigning..." : "Assign Tester"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

