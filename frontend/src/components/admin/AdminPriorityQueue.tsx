/**
 * AdminPriorityQueue — Production-grade Admin Priority Queue component.
 *
 * PURPOSE:
 * Provides an actionable queue of top issues requiring immediate Admin attention.
 *
 * DATA SOURCES (reusing existing APIs):
 * - issuesApi.list (GET /issues)
 * - issuesApi.assign (PATCH /issues/{id}/assign)
 * - usersApi.list (GET /users?role=DEVELOPER&is_active=true)
 *
 * PRIORITY LOGIC (using existing Issue model fields):
 * 1. Critical / Blocker issues (BLOCKER / CRITICAL severity)
 * 2. Reopened issues (status: REOPENED — regression signal)
 * 3. Unassigned Critical / High issues (!assignee_id && severity=CRITICAL or priority=URGENT/HIGH)
 * 4. Old unresolved issues (aging backlog defects)
 * 5. Issues requiring Admin review/action (status: REPORTED or TRIAGED)
 *
 * REAL-TIME:
 * Reuses existing app-level realtime events ('app:realtime_notification', 'app:ws_reconnected')
 * and accepts refreshTrigger prop from parent. Zero additional WebSocket connections opened.
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
  RefreshCw,
  RotateCcw,
  UserCheck,
  Users,
  Zap,
} from "lucide-react";

import { issuesApi } from "../../api/issues";
import { usersApi } from "../../api/users";
import type { Issue, IssueStatus, Priority, Severity } from "../../types/issue";
import type { UserDetail } from "../../types/user";
import { Modal } from "../common/Modal";
import { SeverityBadge } from "../common/SeverityBadge";
import { PriorityBadge } from "../common/PriorityBadge";

// ---------------------------------------------------------------------------
// Priority scoring & tier classification — based entirely on real Issue fields
// ---------------------------------------------------------------------------

const SEVERITY_WEIGHT: Record<Severity, number> = {
  BLOCKER: 40,
  CRITICAL: 30,
  MAJOR: 20,
  MINOR: 10,
};

const PRIORITY_WEIGHT: Record<Priority, number> = {
  URGENT: 15,
  HIGH: 10,
  MEDIUM: 5,
  LOW: 2,
};

const OPEN_STATUSES: IssueStatus[] = [
  "REPORTED",
  "TRIAGED",
  "ASSIGNED",
  "IN_DEVELOPMENT",
  "IN_REVIEW",
  "IN_TESTING",
  "REOPENED",
];

function scoreIssue(issue: Issue): number {
  let score = 0;

  // 1. Critical / Blocker issues
  if (issue.severity === "BLOCKER") score += 100;
  else if (issue.severity === "CRITICAL") score += 50;

  // 2. Reopened issues (regression)
  if (issue.status === "REOPENED") score += 65;

  // 3. Unassigned Critical / High issues
  if (!issue.assignee_id) {
    if (issue.severity === "CRITICAL" || issue.priority === "URGENT") score += 40;
    else if (issue.priority === "HIGH") score += 25;
    else score += 15;
  }

  // 4. Issues requiring Admin review/triage
  if (issue.status === "REPORTED") score += 20;
  else if (issue.status === "TRIAGED") score += 15;

  // Severity and Priority weights
  score += (SEVERITY_WEIGHT[issue.severity] ?? 0) + (PRIORITY_WEIGHT[issue.priority] ?? 0);

  // 5. Age of unresolved defect (up to 30 points)
  const ageDays = Math.floor((Date.now() - new Date(issue.created_at).getTime()) / 86_400_000);
  score += Math.min(Math.max(ageDays, 0), 30);

  return score;
}

export type PriorityTierKey =
  | "blocker"
  | "reopened"
  | "unassigned-critical"
  | "needs-triage"
  | "stale";

export interface PriorityQueueItem extends Issue {
  _score: number;
  _ageDays: number;
  _tier: PriorityTierKey;
}

function classifyTier(issue: Issue): PriorityTierKey {
  if (issue.severity === "BLOCKER") return "blocker";
  if (issue.status === "REOPENED") return "reopened";
  if (
    !issue.assignee_id &&
    (issue.severity === "CRITICAL" || issue.priority === "URGENT" || issue.priority === "HIGH")
  ) {
    return "unassigned-critical";
  }
  if (issue.status === "REPORTED" || issue.status === "TRIAGED") {
    return "needs-triage";
  }
  return "stale";
}

// ---------------------------------------------------------------------------
// Status display colours (mirrors existing issue status colour system)
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<IssueStatus, string> = {
  REPORTED: "#38bdf8",
  TRIAGED: "#818cf8",
  ASSIGNED: "#a78bfa",
  IN_DEVELOPMENT: "#34d399",
  IN_REVIEW: "#06b6d4",
  IN_TESTING: "#10b981",
  RESOLVED: "#6ee7b7",
  CLOSED: "#94a3b8",
  REOPENED: "#f87171",
};

// ---------------------------------------------------------------------------
// Tier metadata
// ---------------------------------------------------------------------------

const TIER_META: Record<
  PriorityTierKey,
  { label: string; color: string; bg: string; icon: React.ReactNode }
> = {
  blocker: {
    label: "BLOCKER",
    color: "#ef4444",
    bg: "rgba(239,68,68,0.15)",
    icon: <Zap size={11} />,
  },
  reopened: {
    label: "REOPENED",
    color: "#f87171",
    bg: "rgba(248,113,113,0.15)",
    icon: <RotateCcw size={11} />,
  },
  "unassigned-critical": {
    label: "UNASSIGNED",
    color: "#f59e0b",
    bg: "rgba(245,158,11,0.15)",
    icon: <Users size={11} />,
  },
  "needs-triage": {
    label: "NEEDS TRIAGE",
    color: "#818cf8",
    bg: "rgba(129,140,248,0.15)",
    icon: <Flame size={11} />,
  },
  stale: {
    label: "AGING DEFECT",
    color: "#a78bfa",
    bg: "rgba(167,139,250,0.15)",
    icon: <Clock size={11} />,
  },
};

// ---------------------------------------------------------------------------
// Component props
// ---------------------------------------------------------------------------

interface AdminPriorityQueueProps {
  /** Called after a successful developer assignment so parent can refresh stats */
  onAssignSuccess?: () => void;
  /** Counter or signal from parent to trigger silent refresh */
  refreshTrigger?: number | string;
}

// ---------------------------------------------------------------------------
// Component Implementation
// ---------------------------------------------------------------------------

export const AdminPriorityQueue: React.FC<AdminPriorityQueueProps> = ({
  onAssignSuccess,
  refreshTrigger,
}) => {
  const navigate = useNavigate();

  const [items, setItems] = useState<PriorityQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [assignModalIssue, setAssignModalIssue] = useState<PriorityQueueItem | null>(null);
  const [developers, setDevelopers] = useState<UserDetail[]>([]);
  const [devMap, setDevMap] = useState<Record<number, string>>({});
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
  // Data fetch — reuses existing /issues endpoint (no new backend route)
  // -------------------------------------------------------------------------

  const fetchQueue = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError(null);

    try {
      // Query high-urgency subsets using existing issue list API (exclude test-fixture projects)
      const [blockerRes, reopenedRes, unassignedCritRes, unassignedUrgentRes, reportedRes] =
        await Promise.all([
          issuesApi.list({ severity: "BLOCKER", page_size: 10, sort_by: "created_at", sort_desc: false, include_test: false }),
          issuesApi.list({ status: "REOPENED", page_size: 10, sort_by: "created_at", sort_desc: false, include_test: false }),
          issuesApi.list({ severity: "CRITICAL", unassigned: true, page_size: 10, sort_by: "created_at", sort_desc: false, include_test: false }),
          issuesApi.list({ priority: "URGENT", unassigned: true, page_size: 10, sort_by: "created_at", sort_desc: false, include_test: false }),
          issuesApi.list({ status: "REPORTED", page_size: 10, sort_by: "created_at", sort_desc: false, include_test: false }),
        ]);

      if (!isMounted.current) return;

      const seen = new Set<number>();
      const merged: PriorityQueueItem[] = [];

      for (const issue of [
        ...blockerRes.items,
        ...reopenedRes.items,
        ...unassignedCritRes.items,
        ...unassignedUrgentRes.items,
        ...reportedRes.items,
      ]) {
        if (seen.has(issue.id)) continue;
        if (!OPEN_STATUSES.includes(issue.status)) continue;
        seen.add(issue.id);

        const ageDays = Math.floor(
          (Date.now() - new Date(issue.created_at).getTime()) / 86_400_000
        );
        merged.push({
          ...issue,
          _score: scoreIssue(issue),
          _ageDays: ageDays,
          _tier: classifyTier(issue),
        });
      }

      // Sort descending by calculated priority score
      merged.sort((a, b) => b._score - a._score);
      // Top 8-10 highest-priority issues
      setItems(merged.slice(0, 10));
    } catch (err: unknown) {
      if (!isMounted.current) return;
      const msg =
        err &&
        typeof err === "object" &&
        "response" in err &&
        (err as { response?: { data?: { detail?: string } } }).response?.data?.detail;
      setError(msg || "Failed to load priority queue");
    } finally {
      if (isMounted.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  // Parent refreshTrigger hook
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (refreshTrigger !== undefined) {
      fetchQueue(true);
    }
  }, [refreshTrigger, fetchQueue]);

  // Real-time synchronization using existing app-level realtime window events
  useEffect(() => {
    const handleRealtime = () => {
      fetchQueue(true);
    };
    window.addEventListener("app:realtime_notification", handleRealtime);
    window.addEventListener("app:ws_reconnected", handleRealtime);
    return () => {
      window.removeEventListener("app:realtime_notification", handleRealtime);
      window.removeEventListener("app:ws_reconnected", handleRealtime);
    };
  }, [fetchQueue]);

  // -------------------------------------------------------------------------
  // Assignment — reuses existing issuesApi.assign & usersApi.list(DEVELOPER)
  // -------------------------------------------------------------------------

  // Load active developers on mount to display names in table
  useEffect(() => {
    let active = true;
    usersApi
      .list({ role: "DEVELOPER", is_active: true, page_size: 100 })
      .then((res) => {
        if (!active) return;
        const validDevs = res.items.filter((u) => !u.email.endsWith("@example.com"));
        setDevelopers(validDevs);
        const map: Record<number, string> = {};
        for (const d of validDevs) {
          map[d.id] = d.full_name;
        }
        setDevMap(map);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const openAssignModal = async (item: PriorityQueueItem) => {
    setAssignModalIssue(item);
    setAssignError(null);
    if (developers.length === 0) {
      setDevLoading(true);
      try {
        const res = await usersApi.list({ role: "DEVELOPER", is_active: true, page_size: 100 });
        const validDevs = res.items.filter((u) => !u.email.endsWith("@example.com"));
        setDevelopers(validDevs);
        const map: Record<number, string> = {};
        for (const d of validDevs) {
          map[d.id] = d.full_name;
        }
        setDevMap(map);
      } catch {
        setDevelopers([]);
      } finally {
        setDevLoading(false);
      }
    }
  };

  const handleAssign = async (developerId: number) => {
    if (!assignModalIssue) return;
    setAssigning(true);
    setAssignError(null);
    try {
      await issuesApi.assign(assignModalIssue.id, { tester_id: developerId });
      setAssignModalIssue(null);
      fetchQueue(true);
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

  const handleViewIssue = (issueId: number) => {
    navigate(`/issues/${issueId}`);
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
          border: "1px solid rgba(239,68,68,0.2)",
        }}
      >
        <div
          className="card-header"
          style={{
            padding: "1rem 1.5rem",
            borderBottom: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            gap: "0.6rem",
          }}
        >
          <AlertTriangle size={18} style={{ color: "#ef4444" }} />
          <h2 className="card-title" style={{ margin: 0, fontSize: "1.1rem" }}>
            Admin Priority Queue
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
            Loading priority queue&hellip;
          </div>
        </div>
      </section>
    );
  }

  // -------------------------------------------------------------------------
  // Error State
  // -------------------------------------------------------------------------

  if (error) {
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
            padding: "1rem 1.5rem",
            borderBottom: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            gap: "0.6rem",
          }}
        >
          <AlertTriangle size={18} style={{ color: "#ef4444" }} />
          <h2 className="card-title" style={{ margin: 0, fontSize: "1.1rem" }}>
            Admin Priority Queue
          </h2>
        </div>
        <div className="card-body" style={{ padding: "2rem 1.5rem", textAlign: "center" }}>
          <p style={{ color: "#f87171", fontSize: "0.85rem", marginBottom: "1rem" }}>
            {error}
          </p>
          <button
            className="btn btn-secondary btn-sm"
            style={{ fontSize: "0.82rem", display: "inline-flex", alignItems: "center", gap: "0.4rem" }}
            onClick={() => fetchQueue()}
          >
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      </section>
    );
  }

  // -------------------------------------------------------------------------
  // Main Render
  // -------------------------------------------------------------------------

  return (
    <>
      <section
        className="card"
        style={{
          marginBottom: "2rem",
          border: "1px solid rgba(239,68,68,0.25)",
        }}
      >
        {/* Header */}
        <div
          className="card-header"
          style={{
            padding: "1rem 1.5rem",
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
                background: "rgba(239,68,68,0.15)",
                color: "#ef4444",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <AlertTriangle size={16} />
            </div>
            <div>
              <h2
                className="card-title"
                style={{ margin: 0, fontSize: "1.05rem", fontWeight: 800 }}
              >
                Admin Priority Queue
              </h2>
              <p
                style={{
                  margin: 0,
                  fontSize: "0.75rem",
                  color: "var(--text-secondary)",
                }}
              >
                Actionable defects requiring immediate Admin triage, assignment, or resolution
              </p>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            {items.length > 0 && (
              <span
                style={{
                  padding: "0.2rem 0.6rem",
                  borderRadius: "999px",
                  background: "rgba(239,68,68,0.15)",
                  color: "#ef4444",
                  fontSize: "0.72rem",
                  fontWeight: 700,
                  letterSpacing: "0.03em",
                }}
              >
                {items.length} ACTIVE {items.length === 1 ? "ITEM" : "ITEMS"}
              </span>
            )}
            <button
              className="btn btn-secondary btn-sm"
              style={{
                fontSize: "0.76rem",
                padding: "0.3rem 0.7rem",
                display: "inline-flex",
                alignItems: "center",
                gap: "0.35rem",
              }}
              onClick={() => fetchQueue(true)}
              disabled={refreshing}
              title="Refresh priority queue"
            >
              <RefreshCw size={13} className={refreshing ? "spinning" : ""} />
              {refreshing ? "Refreshing\u2026" : "Refresh"}
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="card-body" style={{ padding: 0 }}>
          {items.length === 0 ? (
            <div style={{ padding: "3rem 1.5rem", textAlign: "center" }}>
              <CheckCircle2
                size={34}
                style={{ color: "#10b981", marginBottom: "0.75rem" }}
              />
              <p
                style={{
                  fontSize: "0.92rem",
                  color: "var(--text-secondary)",
                  margin: 0,
                  fontWeight: 500,
                }}
              >
                No issues currently require immediate Admin action.
              </p>
              <p
                style={{
                  fontSize: "0.75rem",
                  color: "var(--text-muted)",
                  marginTop: "0.4rem",
                  marginBottom: 0,
                }}
              >
                All blocker, reopened, and unassigned critical defects have been addressed.
              </p>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: "0.82rem",
                  minWidth: "780px",
                }}
              >
                <thead>
                  <tr
                    style={{
                      borderBottom: "1px solid var(--border-subtle)",
                      backgroundColor: "var(--bg-surface-elevated)",
                    }}
                  >
                    {[
                      "Priority",
                      "Issue",
                      "Project",
                      "Severity",
                      "Status",
                      "Assignee",
                      "Age",
                      "Action",
                    ].map((col) => (
                      <th
                        key={col}
                        style={{
                          padding: "0.65rem 1rem",
                          textAlign: "left",
                          fontSize: "0.7rem",
                          fontWeight: 700,
                          color: "var(--text-muted)",
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => {
                    const tier = TIER_META[item._tier];
                    const rowBg =
                      idx % 2 === 0 ? "transparent" : "rgba(255,255,255,0.015)";

                    const projectDisplay = item.issue_key.split("-")[0];

                    const devName = item.assignee_id ? devMap[item.assignee_id] : null;

                    const assigneeDisplay = devName ? (
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "0.3rem",
                          color: "#34d399",
                          fontWeight: 500,
                        }}
                      >
                        <UserCheck size={13} />
                        {devName}
                      </span>
                    ) : item.assignee_id ? (
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "0.3rem",
                          color: "#34d399",
                        }}
                      >
                        <UserCheck size={13} />
                        Assigned
                      </span>
                    ) : (
                      <span
                        style={{
                          color: "#f59e0b",
                          fontStyle: "italic",
                          fontSize: "0.75rem",
                          fontWeight: 600,
                        }}
                      >
                        Unassigned
                      </span>
                    );

                    return (
                      <tr
                        key={item.id}
                        style={{
                          borderBottom:
                            idx < items.length - 1
                              ? "1px solid var(--border-subtle)"
                              : "none",
                          backgroundColor: rowBg,
                          transition: "background 0.15s ease",
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLTableRowElement).style.backgroundColor =
                            "rgba(99,102,241,0.07)";
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLTableRowElement).style.backgroundColor =
                            rowBg;
                        }}
                      >
                        {/* Priority column: Priority badge + urgency tier badge */}
                        <td style={{ padding: "0.75rem 1rem", whiteSpace: "nowrap" }}>
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: "0.3rem",
                              alignItems: "flex-start",
                            }}
                          >
                            <PriorityBadge priority={item.priority} />
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "0.25rem",
                                padding: "0.1rem 0.45rem",
                                borderRadius: "999px",
                                backgroundColor: tier.bg,
                                color: tier.color,
                                fontSize: "0.64rem",
                                fontWeight: 700,
                                letterSpacing: "0.02em",
                              }}
                            >
                              {tier.icon}
                              {tier.label}
                            </span>
                          </div>
                        </td>

                        {/* Issue: Key + Title (both actionable and clickable) */}
                        <td style={{ padding: "0.75rem 1rem", maxWidth: "250px" }}>
                          <button
                            onClick={() => handleViewIssue(item.id)}
                            style={{
                              background: "none",
                              border: "none",
                              padding: 0,
                              cursor: "pointer",
                              textAlign: "left",
                              display: "block",
                              width: "100%",
                            }}
                            title={`View issue ${item.issue_key}`}
                          >
                            <div
                              style={{
                                fontSize: "0.74rem",
                                fontWeight: 700,
                                color: "#818cf8",
                                fontFamily: "monospace",
                                marginBottom: "0.15rem",
                              }}
                            >
                              {item.issue_key}
                            </div>
                            <div
                              style={{
                                fontSize: "0.82rem",
                                color: "var(--text-primary)",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                maxWidth: "220px",
                                fontWeight: 500,
                              }}
                              title={item.title}
                            >
                              {item.title}
                            </div>
                          </button>
                        </td>

                        {/* Project */}
                        <td
                          style={{
                            padding: "0.75rem 1rem",
                            color: "var(--text-secondary)",
                            fontSize: "0.78rem",
                            whiteSpace: "nowrap",
                            fontWeight: 500,
                          }}
                        >
                          {projectDisplay}
                        </td>

                        {/* Severity */}
                        <td style={{ padding: "0.75rem 1rem", whiteSpace: "nowrap" }}>
                          <SeverityBadge severity={item.severity} />
                        </td>

                        {/* Status */}
                        <td style={{ padding: "0.75rem 1rem", whiteSpace: "nowrap" }}>
                          <span
                            style={{
                              padding: "0.15rem 0.5rem",
                              borderRadius: "4px",
                              fontSize: "0.68rem",
                              fontWeight: 700,
                              backgroundColor: `${STATUS_COLORS[item.status]}22`,
                              color: STATUS_COLORS[item.status],
                              letterSpacing: "0.02em",
                            }}
                          >
                            {item.status.replace(/_/g, " ")}
                          </span>
                        </td>

                        {/* Assignee */}
                        <td
                          style={{
                            padding: "0.75rem 1rem",
                            fontSize: "0.78rem",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {assigneeDisplay}
                        </td>

                        {/* Age */}
                        <td
                          style={{
                            padding: "0.75rem 1rem",
                            fontSize: "0.75rem",
                            color:
                              item._ageDays > 7
                                ? "#f87171"
                                : item._ageDays > 3
                                ? "#f59e0b"
                                : "var(--text-secondary)",
                            whiteSpace: "nowrap",
                            fontWeight: 500,
                          }}
                        >
                          {item._ageDays === 0
                            ? "Today"
                            : item._ageDays === 1
                            ? "1 day"
                            : `${item._ageDays} days`}
                        </td>

                        {/* Actions */}
                        <td style={{ padding: "0.75rem 1rem", whiteSpace: "nowrap" }}>
                          <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
                            <button
                              className="btn btn-secondary btn-sm"
                              style={{
                                fontSize: "0.72rem",
                                padding: "0.25rem 0.6rem",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "0.25rem",
                              }}
                              onClick={() => handleViewIssue(item.id)}
                              title="View Issue Detail"
                            >
                              <ExternalLink size={12} />
                              View
                            </button>
                            <button
                              className="btn btn-primary btn-sm"
                              style={{
                                fontSize: "0.72rem",
                                padding: "0.25rem 0.6rem",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "0.25rem",
                              }}
                              onClick={() => openAssignModal(item)}
                              title={
                                item.assignee_id
                                  ? "Reassign Developer"
                                  : "Assign Developer"
                              }
                            >
                              <UserCheck size={12} />
                              {item.assignee_id ? "Reassign" : "Assign"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Footer Legend */}
          {items.length > 0 && (
            <div
              style={{
                padding: "0.65rem 1.25rem",
                borderTop: "1px solid var(--border-subtle)",
                display: "flex",
                gap: "1.25rem",
                flexWrap: "wrap",
                fontSize: "0.7rem",
                color: "var(--text-muted)",
                backgroundColor: "rgba(0,0,0,0.08)",
              }}
            >
              {(Object.entries(TIER_META) as [PriorityTierKey, typeof TIER_META[PriorityTierKey]][]).map(
                ([key, meta]) => (
                  <span
                    key={key}
                    style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}
                  >
                    <span style={{ color: meta.color }}>{meta.icon}</span>
                    {meta.label}
                  </span>
                )
              )}
              <span
                style={{
                  marginLeft: "auto",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.25rem",
                }}
              >
                <ArrowRight size={11} />
                Click issue key or title to open full details
              </span>
            </div>
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
                <SeverityBadge severity={assignModalIssue.severity} />
                <span
                  style={{
                    color: STATUS_COLORS[assignModalIssue.status],
                    fontWeight: 600,
                    fontSize: "0.74rem",
                  }}
                >
                  {assignModalIssue.status.replace(/_/g, " ")}
                </span>
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
