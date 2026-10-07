/**
 * AdminUnassignedBacklog — Real-time Unassigned Backlog Intelligence component.
 *
 * PURPOSE:
 * Provides operational intelligence and actionable insights on unassigned backlog issues.
 *
 * DATA SOURCES (reusing existing APIs):
 * - issuesApi.list (GET /issues with unassigned=true and priority/severity filters)
 * - issuesApi.assign (PATCH /issues/{id}/assign)
 * - usersApi.list (GET /users with role=DEVELOPER, excluding @example.com test fixtures)
 * - adminApi.getDashboard (GET /admin/dashboard for total issue count and backlog baseline)
 *
 * IMPORTANT DATA RULES:
 * - 100% real PostgreSQL data via existing APIs. Zero mock data.
 * - No automatic/round-robin assignment; Admin remains responsible for triage.
 * - No new backend endpoints or duplicate WebSocket connections.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  ExternalLink,
  Flame,
  Layers,
  RefreshCw,
  ShieldAlert,
  UserCheck,
} from "lucide-react";

import { adminApi } from "../../api/admin";
import { issuesApi } from "../../api/issues";
import { usersApi } from "../../api/users";
import type { Issue } from "../../types/issue";
import type { UserDetail } from "../../types/user";
import { Modal } from "../common/Modal";
import { PriorityBadge } from "../common/PriorityBadge";
import { SeverityBadge } from "../common/SeverityBadge";

// ---------------------------------------------------------------------------
// Component Interfaces
// ---------------------------------------------------------------------------

export interface BacklogIntelligenceData {
  totalUnassigned: number;
  totalSystemIssues: number;
  priorityCounts: {
    urgent: number;
    high: number;
    medium: number;
    low: number;
  };
  severityCounts: {
    blocker: number;
    critical: number;
  };
  oldestIssue: Issue | null;
  oldestAgeDays: number;
  recentPreview: Issue[];
}

interface AdminUnassignedBacklogProps {
  /** Optional baseline total issues from parent dashboard */
  totalSystemIssues?: number;
  /** Optional callback to trigger parent assign modal */
  onAssignClick?: (issueId: number) => void;
  /** Callback fired after successfully assigning a developer */
  onAssignSuccess?: () => void;
  /** Reactive trigger from parent to refresh state silently */
  refreshTrigger?: number | string;
}

// ---------------------------------------------------------------------------
// Component Implementation
// ---------------------------------------------------------------------------

export const AdminUnassignedBacklog: React.FC<AdminUnassignedBacklogProps> = ({
  totalSystemIssues: propTotalIssues,
  onAssignClick,
  onAssignSuccess,
  refreshTrigger,
}) => {
  const navigate = useNavigate();

  const [data, setData] = useState<BacklogIntelligenceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Assign Developer modal state
  const [assignModalIssue, setAssignModalIssue] = useState<Issue | null>(null);
  const [developers, setDevelopers] = useState<UserDetail[]>([]);
  const [devLoading, setDevLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  // -------------------------------------------------------------------------
  // Fetch Backlog Intelligence — reuses existing issuesApi.list (no new API)
  // -------------------------------------------------------------------------

  const fetchBacklog = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError(null);

    try {
      // Execute lightweight parallel count queries (page_size: 1)
      const [
        totalRes,
        urgentRes,
        highRes,
        mediumRes,
        lowRes,
        blockerRes,
        criticalRes,
        oldestRes,
        previewRes,
        dashboardRes,
      ] = await Promise.all([
        issuesApi.list({ unassigned: true, page_size: 1, include_test: false }),
        issuesApi.list({ unassigned: true, priority: "URGENT", page_size: 1, include_test: false }),
        issuesApi.list({ unassigned: true, priority: "HIGH", page_size: 1, include_test: false }),
        issuesApi.list({ unassigned: true, priority: "MEDIUM", page_size: 1, include_test: false }),
        issuesApi.list({ unassigned: true, priority: "LOW", page_size: 1, include_test: false }),
        issuesApi.list({ unassigned: true, severity: "BLOCKER", page_size: 1, include_test: false }),
        issuesApi.list({ unassigned: true, severity: "CRITICAL", page_size: 1, include_test: false }),
        issuesApi.list({ unassigned: true, sort_by: "created_at", sort_desc: false, page_size: 1, include_test: false }),
        issuesApi.list({ unassigned: true, sort_by: "created_at", sort_desc: true, page_size: 4, include_test: false }),
        propTotalIssues ? Promise.resolve(null) : adminApi.getDashboard().catch(() => null),
      ]);

      if (!isMounted.current) return;

      const oldest = oldestRes.items[0] || null;
      let oldestDays = 0;
      if (oldest && oldest.created_at) {
        oldestDays = Math.max(
          0,
          Math.floor((Date.now() - new Date(oldest.created_at).getTime()) / 86_400_000)
        );
      }

      const totalIssues =
        propTotalIssues ||
        dashboardRes?.issues?.total ||
        (totalRes.total > 0 ? totalRes.total : 0);

      setData({
        totalUnassigned: totalRes.total,
        totalSystemIssues: totalIssues,
        priorityCounts: {
          urgent: urgentRes.total,
          high: highRes.total,
          medium: mediumRes.total,
          low: lowRes.total,
        },
        severityCounts: {
          blocker: blockerRes.total,
          critical: criticalRes.total,
        },
        oldestIssue: oldest,
        oldestAgeDays: oldestDays,
        recentPreview: previewRes.items,
      });
    } catch (err: unknown) {
      if (!isMounted.current) return;
      const msg =
        err &&
        typeof err === "object" &&
        "response" in err &&
        (err as { response?: { data?: { detail?: string } } }).response?.data?.detail;
      setError(msg || "Failed to load unassigned backlog intelligence");
    } finally {
      if (isMounted.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [propTotalIssues]);

  // Initial fetch
  useEffect(() => {
    fetchBacklog();
  }, [fetchBacklog]);

  // Reactive updates on parent refreshTrigger
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (refreshTrigger !== undefined) {
      fetchBacklog(true);
    }
  }, [refreshTrigger, fetchBacklog]);

  // Real-time synchronization via existing window events
  useEffect(() => {
    const handleRealtime = () => {
      fetchBacklog(true);
    };
    window.addEventListener("app:realtime_notification", handleRealtime);
    window.addEventListener("app:ws_reconnected", handleRealtime);
    return () => {
      window.removeEventListener("app:realtime_notification", handleRealtime);
      window.removeEventListener("app:ws_reconnected", handleRealtime);
    };
  }, [fetchBacklog]);

  // -------------------------------------------------------------------------
  // Assignment handling — reuses existing assignment workflow
  // -------------------------------------------------------------------------

  const openAssignModal = async (issue: Issue) => {
    setAssignModalIssue(issue);
    setAssignError(null);
    setDevLoading(true);
    try {
      const res = await usersApi.list({ role: "DEVELOPER", is_active: true, page_size: 100 });
      // Filter out @example.com fixture developers
      setDevelopers(res.items.filter((u) => !u.email.endsWith("@example.com")));
    } catch {
      setDevelopers([]);
    } finally {
      setDevLoading(false);
    }
  };

  const handleAssign = async (developerId: number) => {
    if (!assignModalIssue) return;
    setAssigning(true);
    setAssignError(null);
    try {
      await issuesApi.assign(assignModalIssue.id, { tester_id: developerId });
      setAssignModalIssue(null);
      fetchBacklog(true);
      onAssignSuccess?.();
    } catch (err: unknown) {
      const msg =
        err &&
        typeof err === "object" &&
        "response" in err &&
        (err as { response?: { data?: { detail?: string } } }).response?.data?.detail;
      setAssignError(msg || "Failed to assign developer");
    } finally {
      setAssigning(false);
    }
  };

  const handleNavigateToUnassignedIssues = () => {
    navigate("/issues?unassigned=true");
  };

  // -------------------------------------------------------------------------
  // Loading State
  // -------------------------------------------------------------------------

  if (loading) {
    return (
      <section
        className="card"
        style={{
          marginBottom: "2rem",
          border: "1px solid rgba(245,158,11,0.2)",
        }}
      >
        <div
          className="card-header"
          style={{
            padding: "1rem 1.25rem",
            borderBottom: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <Layers size={18} style={{ color: "#f59e0b" }} />
          <h2 className="card-title" style={{ margin: 0, fontSize: "1.05rem" }}>
            Unassigned Backlog Intelligence
          </h2>
        </div>
        <div className="card-body" style={{ padding: "2.5rem 1.5rem", textAlign: "center" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              color: "var(--text-muted)",
              fontSize: "0.85rem",
            }}
          >
            <RefreshCw size={16} className="spinning" />
            Loading backlog intelligence&hellip;
          </div>
        </div>
      </section>
    );
  }

  // -------------------------------------------------------------------------
  // Error State
  // -------------------------------------------------------------------------

  if (error || !data) {
    return (
      <section
        className="card"
        style={{
          marginBottom: "2rem",
          border: "1px solid rgba(239,68,68,0.25)",
        }}
      >
        <div
          className="card-header"
          style={{
            padding: "1rem 1.25rem",
            borderBottom: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <AlertTriangle size={18} style={{ color: "#ef4444" }} />
          <h2 className="card-title" style={{ margin: 0, fontSize: "1.05rem" }}>
            Unassigned Backlog Intelligence
          </h2>
        </div>
        <div className="card-body" style={{ padding: "2rem 1.5rem", textAlign: "center" }}>
          <p style={{ color: "#f87171", fontSize: "0.85rem", marginBottom: "1rem" }}>
            {error || "Unable to load unassigned backlog metrics"}
          </p>
          <button
            className="btn btn-secondary btn-sm"
            style={{ fontSize: "0.82rem", display: "inline-flex", alignItems: "center", gap: "0.4rem" }}
            onClick={() => fetchBacklog()}
          >
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      </section>
    );
  }

  // -------------------------------------------------------------------------
  // Calculations
  // -------------------------------------------------------------------------

  const unassignedRatio =
    data.totalSystemIssues > 0
      ? ((data.totalUnassigned / data.totalSystemIssues) * 100).toFixed(1)
      : "0.0";

  const criticalBlockerCount = data.severityCounts.blocker + data.severityCounts.critical;
  const highPriorityCount = data.priorityCounts.urgent + data.priorityCounts.high;

  // -------------------------------------------------------------------------
  // Main Render
  // -------------------------------------------------------------------------

  return (
    <>
      <section
        className="card"
        style={{
          marginBottom: "2rem",
          border: "1px solid rgba(245,158,11,0.25)",
        }}
      >
        {/* Header */}
        <div
          className="card-header"
          style={{
            padding: "1rem 1.25rem",
            borderBottom: "1px solid var(--border-subtle)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "0.75rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <div
              style={{
                width: "30px",
                height: "30px",
                borderRadius: "6px",
                background: "rgba(245,158,11,0.15)",
                color: "#f59e0b",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Layers size={16} />
            </div>
            <div>
              <h2
                className="card-title"
                style={{ margin: 0, fontSize: "1.05rem", fontWeight: 800 }}
              >
                Unassigned Backlog Intelligence
              </h2>
              <p
                style={{
                  margin: 0,
                  fontSize: "0.75rem",
                  color: "var(--text-secondary)",
                }}
              >
                Defect triage repository &amp; operational backlog capacity
              </p>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <button
              className="btn btn-secondary btn-sm"
              style={{
                fontSize: "0.76rem",
                padding: "0.3rem 0.7rem",
                display: "inline-flex",
                alignItems: "center",
                gap: "0.35rem",
              }}
              onClick={() => fetchBacklog(true)}
              disabled={refreshing}
              title="Refresh backlog metrics"
            >
              <RefreshCw size={13} className={refreshing ? "spinning" : ""} />
              {refreshing ? "Refreshing\u2026" : "Refresh"}
            </button>
            <button
              className="btn btn-primary btn-sm"
              style={{
                fontSize: "0.76rem",
                padding: "0.3rem 0.8rem",
                display: "inline-flex",
                alignItems: "center",
                gap: "0.35rem",
              }}
              onClick={handleNavigateToUnassignedIssues}
              title="Open filtered unassigned issues list"
            >
              <ExternalLink size={13} />
              View Unassigned Issues
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="card-body" style={{ padding: "1.25rem" }}>
          {data.totalUnassigned === 0 ? (
            <div style={{ padding: "2.5rem 1.5rem", textAlign: "center" }}>
              <CheckCircle2
                size={34}
                style={{ color: "#10b981", marginBottom: "0.75rem" }}
              />
              <p
                style={{
                  fontSize: "0.95rem",
                  color: "var(--text-primary)",
                  fontWeight: 600,
                  margin: 0,
                }}
              >
                All current issues are assigned.
              </p>
              <p
                style={{
                  fontSize: "0.75rem",
                  color: "var(--text-muted)",
                  marginTop: "0.35rem",
                  marginBottom: 0,
                }}
              >
                No unassigned defects found awaiting developer assignment.
              </p>
            </div>
          ) : (
            <>
              {/* Primary Total & Ratio Display */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: "1rem",
                  marginBottom: "1.25rem",
                }}
              >
                {/* Big Metric Box */}
                <div
                  style={{
                    padding: "1.25rem",
                    borderRadius: "10px",
                    background: "var(--bg-surface-elevated)",
                    border: "1px solid var(--border-subtle)",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span
                      style={{
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        color: "var(--text-muted)",
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                      }}
                    >
                      Total Unassigned
                    </span>
                    <span
                      style={{
                        padding: "0.15rem 0.5rem",
                        borderRadius: "999px",
                        background: "rgba(245,158,11,0.15)",
                        color: "#f59e0b",
                        fontSize: "0.7rem",
                        fontWeight: 700,
                      }}
                    >
                      {unassignedRatio}% of Total
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: "2rem",
                      fontWeight: 800,
                      color: "#f59e0b",
                      marginTop: "0.35rem",
                      lineHeight: 1.1,
                    }}
                  >
                    {data.totalUnassigned.toLocaleString()}
                  </div>
                  <div
                    style={{
                      fontSize: "0.74rem",
                      color: "var(--text-secondary)",
                      marginTop: "0.4rem",
                    }}
                  >
                    Out of {data.totalSystemIssues.toLocaleString()} total reported defects
                  </div>
                </div>

                {/* Priority Breakdown Box */}
                <div
                  style={{
                    padding: "1.25rem",
                    borderRadius: "10px",
                    background: "var(--bg-surface-elevated)",
                    border: "1px solid var(--border-subtle)",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                  }}
                >
                  <div
                    style={{
                      fontSize: "0.72rem",
                      fontWeight: 700,
                      color: "var(--text-muted)",
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      marginBottom: "0.75rem",
                    }}
                  >
                    Priority Distribution
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(4, 1fr)",
                      gap: "0.5rem",
                      textAlign: "center",
                    }}
                  >
                    <div style={{ padding: "0.4rem 0.2rem", borderRadius: "6px", background: "rgba(239,68,68,0.08)" }}>
                      <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "#ef4444" }}>Critical</div>
                      <div style={{ fontSize: "1.05rem", fontWeight: 800, color: "#ef4444", marginTop: "0.15rem" }}>
                        {data.priorityCounts.urgent.toLocaleString()}
                      </div>
                    </div>
                    <div style={{ padding: "0.4rem 0.2rem", borderRadius: "6px", background: "rgba(249,115,22,0.08)" }}>
                      <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "#f97316" }}>High</div>
                      <div style={{ fontSize: "1.05rem", fontWeight: 800, color: "#f97316", marginTop: "0.15rem" }}>
                        {data.priorityCounts.high.toLocaleString()}
                      </div>
                    </div>
                    <div style={{ padding: "0.4rem 0.2rem", borderRadius: "6px", background: "rgba(59,130,246,0.08)" }}>
                      <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "#3b82f6" }}>Medium</div>
                      <div style={{ fontSize: "1.05rem", fontWeight: 800, color: "#3b82f6", marginTop: "0.15rem" }}>
                        {data.priorityCounts.medium.toLocaleString()}
                      </div>
                    </div>
                    <div style={{ padding: "0.4rem 0.2rem", borderRadius: "6px", background: "rgba(148,163,184,0.08)" }}>
                      <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "#94a3b8" }}>Low</div>
                      <div style={{ fontSize: "1.05rem", fontWeight: 800, color: "#94a3b8", marginTop: "0.15rem" }}>
                        {data.priorityCounts.low.toLocaleString()}
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      fontSize: "0.72rem",
                      color: "var(--text-muted)",
                      marginTop: "0.6rem",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <span>High &amp; Urgent Demand:</span>
                    <strong style={{ color: "var(--text-primary)" }}>{highPriorityCount.toLocaleString()}</strong>
                  </div>
                </div>
              </div>

              {/* Operational Intelligence Cards (3-col row) */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: "0.75rem",
                  marginBottom: "1.25rem",
                }}
              >
                {/* 1. Oldest Unassigned Issue */}
                <div
                  style={{
                    padding: "0.9rem 1rem",
                    borderRadius: "8px",
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid var(--border-subtle)",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "0.65rem",
                  }}
                >
                  <Clock size={16} style={{ color: "#a78bfa", marginTop: "0.15rem", flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 600 }}>
                      Oldest Unassigned Defect
                    </div>
                    <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--text-primary)", marginTop: "0.15rem" }}>
                      {data.oldestAgeDays} days old
                    </div>
                    {data.oldestIssue && (
                      <button
                        onClick={() => navigate(`/issues/${data.oldestIssue?.id}`)}
                        style={{
                          background: "none",
                          border: "none",
                          padding: 0,
                          cursor: "pointer",
                          color: "#818cf8",
                          fontSize: "0.72rem",
                          fontWeight: 600,
                          marginTop: "0.2rem",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "0.2rem",
                        }}
                      >
                        {data.oldestIssue.issue_key} <ArrowRight size={10} />
                      </button>
                    )}
                  </div>
                </div>

                {/* 2. Critical & Blocker Severity */}
                <div
                  style={{
                    padding: "0.9rem 1rem",
                    borderRadius: "8px",
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid var(--border-subtle)",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "0.65rem",
                  }}
                >
                  <ShieldAlert size={16} style={{ color: "#ef4444", marginTop: "0.15rem", flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 600 }}>
                      Critical &amp; Blocker Unassigned
                    </div>
                    <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "#ef4444", marginTop: "0.15rem" }}>
                      {criticalBlockerCount.toLocaleString()}
                    </div>
                    <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)", marginTop: "0.2rem" }}>
                      {data.severityCounts.blocker} Blocker • {data.severityCounts.critical.toLocaleString()} Critical
                    </div>
                  </div>
                </div>

                {/* 3. Backlog Aging */}
                <div
                  style={{
                    padding: "0.9rem 1rem",
                    borderRadius: "8px",
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid var(--border-subtle)",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "0.65rem",
                  }}
                >
                  <Flame size={16} style={{ color: "#f97316", marginTop: "0.15rem", flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 600 }}>
                      Backlog Longevity (&gt;7 Days)
                    </div>
                    <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--text-primary)", marginTop: "0.15rem" }}>
                      Active Archive
                    </div>
                    <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)", marginTop: "0.2rem" }}>
                      Includes Kaggle dataset &amp; historical defect backlog
                    </div>
                  </div>
                </div>
              </div>

              {/* Actionable Preview List */}
              {data.recentPreview.length > 0 && (
                <div
                  style={{
                    borderRadius: "8px",
                    border: "1px solid var(--border-subtle)",
                    overflow: "hidden",
                    marginBottom: "1rem",
                  }}
                >
                  <div
                    style={{
                      padding: "0.6rem 0.9rem",
                      backgroundColor: "var(--bg-surface-elevated)",
                      borderBottom: "1px solid var(--border-subtle)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      fontSize: "0.72rem",
                      fontWeight: 700,
                      color: "var(--text-muted)",
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                    }}
                  >
                    <span>Recent Unassigned Defect Stream</span>
                    <span>Action Required</span>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column" }}>
                    {data.recentPreview.map((item) => (
                      <div
                        key={item.id}
                        style={{
                          padding: "0.65rem 0.9rem",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          borderBottom: "1px solid var(--border-subtle)",
                          backgroundColor: "transparent",
                          fontSize: "0.82rem",
                          gap: "0.5rem",
                        }}
                      >
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <button
                              onClick={() => navigate(`/issues/${item.id}`)}
                              style={{
                                background: "none",
                                border: "none",
                                padding: 0,
                                cursor: "pointer",
                                color: "#818cf8",
                                fontWeight: 700,
                                fontFamily: "monospace",
                                fontSize: "0.75rem",
                              }}
                            >
                              {item.issue_key}
                            </button>
                            <PriorityBadge priority={item.priority} />
                            <SeverityBadge severity={item.severity} />
                          </div>
                          <div
                            style={{
                              color: "var(--text-primary)",
                              fontSize: "0.8rem",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              maxWidth: "380px",
                              marginTop: "0.15rem",
                            }}
                            title={item.title}
                          >
                            {item.title}
                          </div>
                        </div>

                        <div style={{ display: "flex", gap: "0.35rem", alignItems: "center", flexShrink: 0 }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: "0.72rem", padding: "0.25rem 0.55rem" }}
                            onClick={() => navigate(`/issues/${item.id}`)}
                            title="View defect detail"
                          >
                            <ExternalLink size={12} />
                            View
                          </button>
                          <button
                            className="btn btn-primary btn-sm"
                            style={{ fontSize: "0.72rem", padding: "0.25rem 0.55rem" }}
                            onClick={() => (onAssignClick ? onAssignClick(item.id) : openAssignModal(item))}
                            title="Assign developer"
                          >
                            <UserCheck size={12} />
                            Assign
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Footer CTA */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "0.75rem",
                  paddingTop: "0.25rem",
                }}
              >
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                  Showing operational metrics computed from live PostgreSQL defect repository.
                </div>
                <button
                  className="btn btn-secondary btn-sm"
                  style={{
                    fontSize: "0.78rem",
                    padding: "0.35rem 0.9rem",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.4rem",
                  }}
                  onClick={handleNavigateToUnassignedIssues}
                >
                  <Layers size={13} />
                  Open All Unassigned Defects ({data.totalUnassigned.toLocaleString()})
                  <ArrowRight size={12} />
                </button>
              </div>
            </>
          )}
        </div>
      </section>

      {/* Assign Developer Modal */}
      <Modal
        isOpen={!!assignModalIssue}
        onClose={() => {
          setAssignModalIssue(null);
          setAssignError(null);
        }}
        title={`Assign Developer — ${assignModalIssue?.issue_key ?? ""}`}
      >
        <div style={{ padding: "1.25rem" }}>
          {assignModalIssue && (
            <div
              style={{
                marginBottom: "1rem",
                padding: "0.75rem",
                backgroundColor: "var(--bg-surface-elevated)",
                borderRadius: "8px",
                border: "1px solid var(--border-subtle)",
              }}
            >
              <div
                style={{
                  fontWeight: 600,
                  fontSize: "0.85rem",
                  color: "var(--text-primary)",
                  marginBottom: "0.35rem",
                }}
              >
                {assignModalIssue.title}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <PriorityBadge priority={assignModalIssue.priority} />
                <SeverityBadge severity={assignModalIssue.severity} />
              </div>
            </div>
          )}

          {assignError && (
            <div
              style={{
                color: "#f87171",
                fontSize: "0.82rem",
                marginBottom: "0.75rem",
                padding: "0.5rem 0.75rem",
                background: "rgba(239,68,68,0.1)",
                borderRadius: "6px",
              }}
            >
              {assignError}
            </div>
          )}

          {devLoading ? (
            <div
              style={{
                textAlign: "center",
                padding: "1.5rem",
                color: "var(--text-muted)",
                fontSize: "0.85rem",
              }}
            >
              <RefreshCw size={16} className="spinning" style={{ marginRight: "0.4rem" }} />
              Loading active developers&hellip;
            </div>
          ) : developers.length === 0 ? (
            <p
              style={{
                color: "var(--text-muted)",
                fontSize: "0.85rem",
                textAlign: "center",
                padding: "1rem",
              }}
            >
              No active developers found.
            </p>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
                maxHeight: "340px",
                overflowY: "auto",
              }}
            >
              {developers.map((dev) => (
                <div
                  key={dev.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "0.65rem 0.9rem",
                    borderRadius: "8px",
                    backgroundColor: "var(--bg-surface-elevated)",
                    border: "1px solid var(--border-subtle)",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: "0.86rem",
                        color: "var(--text-primary)",
                      }}
                    >
                      {dev.full_name}
                    </div>
                    <div style={{ fontSize: "0.74rem", color: "var(--text-muted)" }}>
                      {dev.email}
                    </div>
                  </div>
                  <button
                    className="btn btn-primary btn-sm"
                    style={{ fontSize: "0.78rem", padding: "0.3rem 0.75rem" }}
                    disabled={assigning}
                    onClick={() => handleAssign(dev.id)}
                  >
                    {assigning ? "\u2026" : "Assign"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </>
  );
};
