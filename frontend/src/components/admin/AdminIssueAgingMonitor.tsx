/**
 * AdminIssueAgingMonitor — Real-time Issue Aging Monitor component.
 *
 * PURPOSE:
 * Helps Admin identify unresolved defects that are becoming old or require operational attention.
 *
 * SLA NOTICE:
 * TracePilot does not have a formal SLA system (no SLA policies, breach thresholds, or due dates).
 * All metrics here are genuine AGE indicators computed from PostgreSQL timestamps (created_at, updated_at).
 *
 * DATA SOURCE:
 * - adminApi.getIssueAging (GET /admin/issue-aging)
 * - 100% real PostgreSQL data, single aggregation query. Zero mock data.
 *
 * REAL-TIME:
 * Listens to existing window events 'app:realtime_notification' and 'app:ws_reconnected'.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  Clock,
  ExternalLink,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  UserX,
} from "lucide-react";

import { adminApi } from "../../api/admin";
import type { IssueAgingResponse } from "../../types/admin";
import { PriorityBadge } from "../common/PriorityBadge";
import { SeverityBadge } from "../common/SeverityBadge";
import { StatusBadge } from "../common/StatusBadge";
import type { IssueStatus, Priority, Severity } from "../../types/issue";

interface AdminIssueAgingMonitorProps {
  refreshTrigger?: number;
  compact?: boolean;
}

export const AdminIssueAgingMonitor: React.FC<AdminIssueAgingMonitorProps> = ({
  refreshTrigger,
  compact = false,
}) => {
  const navigate = useNavigate();
  const [data, setData] = useState<IssueAgingResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const isMounted = useRef<boolean>(true);
  const debounceTimer = useRef<number | null>(null);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      if (debounceTimer.current) {
        window.clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  const fetchData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);
    setError(null);

    try {
      const res = await adminApi.getIssueAging();
      if (!isMounted.current) return;
      setData(res);
    } catch (err: unknown) {
      if (!isMounted.current) return;
      const msg =
        err &&
        typeof err === "object" &&
        "response" in err &&
        (err as { response?: { data?: { detail?: string } } }).response?.data?.detail;
      setError(msg || "Failed to load issue aging data.");
    } finally {
      if (isMounted.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Synchronize on parent trigger
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (refreshTrigger !== undefined) {
      fetchData(true);
    }
  }, [refreshTrigger, fetchData]);

  // Real-time synchronization using existing TracePilot WebSocket event bus
  useEffect(() => {
    const handleRealtime = () => {
      if (debounceTimer.current) {
        window.clearTimeout(debounceTimer.current);
      }
      debounceTimer.current = window.setTimeout(() => {
        fetchData(true);
      }, 400);
    };

    window.addEventListener("app:realtime_notification", handleRealtime);
    window.addEventListener("app:ws_reconnected", handleRealtime);
    return () => {
      window.removeEventListener("app:realtime_notification", handleRealtime);
      window.removeEventListener("app:ws_reconnected", handleRealtime);
    };
  }, [fetchData]);

  // ---------------------------------------------------------------------------
  // Loading skeleton
  // ---------------------------------------------------------------------------
  if (loading && !data) {
    return (
      <div
        className="admin-dashboard-card"
        style={{
          padding: "1.25rem 1.5rem",
          borderRadius: "12px",
          background: "var(--card-bg, #ffffff)",
          border: "1px solid var(--border-subtle, #e2e8f0)",
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <div style={{ width: "160px", height: "1.2rem", background: "rgba(148,163,184,0.15)", borderRadius: "4px" }} />
          <div style={{ width: "60px", height: "1.2rem", background: "rgba(148,163,184,0.15)", borderRadius: "4px" }} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.75rem", marginBottom: "1.25rem" }}>
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              style={{
                height: "64px",
                background: "rgba(148,163,184,0.1)",
                borderRadius: "8px",
                animation: "pulse 1.5s infinite",
              }}
            />
          ))}
        </div>
        <div style={{ height: "70px", background: "rgba(148,163,184,0.1)", borderRadius: "8px", marginBottom: "1rem" }} />
        <div style={{ height: "40px", background: "rgba(148,163,184,0.1)", borderRadius: "8px" }} />
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Error state
  // ---------------------------------------------------------------------------
  if (error && !data) {
    return (
      <div
        className="admin-dashboard-card"
        style={{
          padding: "1.5rem",
          borderRadius: "12px",
          background: "var(--card-bg, #ffffff)",
          border: "1px solid #fecaca",
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          textAlign: "center",
        }}
      >
        <AlertTriangle size={28} style={{ color: "#ef4444", margin: "0 auto 0.5rem" }} />
        <div style={{ fontWeight: 600, color: "#991b1b", marginBottom: "0.25rem" }}>
          Error Loading Aging Metrics
        </div>
        <div style={{ fontSize: "0.85rem", color: "#b91c1c", marginBottom: "1rem" }}>{error}</div>
        <button
          onClick={() => fetchData()}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.4rem",
            padding: "0.45rem 0.9rem",
            borderRadius: "6px",
            background: "#ef4444",
            color: "#ffffff",
            fontSize: "0.8rem",
            fontWeight: 600,
            border: "none",
            cursor: "pointer",
          }}
        >
          <RefreshCw size={13} /> Retry
        </button>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Empty state (no unresolved issues at all)
  // ---------------------------------------------------------------------------
  if (!data || data.total_unresolved === 0) {
    return (
      <div
        className="admin-dashboard-card"
        style={{
          padding: "1.5rem",
          borderRadius: "12px",
          background: "var(--card-bg, #ffffff)",
          border: "1px solid var(--border-subtle, #e2e8f0)",
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          textAlign: "center",
        }}
      >
        <Clock size={28} style={{ color: "#10b981", margin: "0 auto 0.5rem" }} />
        <div style={{ fontWeight: 600, color: "var(--text-primary)", marginBottom: "0.25rem" }}>
          Issue Aging Monitor
        </div>
        <div style={{ fontSize: "0.875rem", color: "var(--text-muted)", marginBottom: "0.75rem" }}>
          No unresolved issues require aging attention.
        </div>
        <button
          onClick={() => fetchData(true)}
          style={{
            background: "none",
            border: "none",
            color: "var(--primary-color, #4f46e5)",
            fontSize: "0.8rem",
            fontWeight: 600,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "0.3rem",
          }}
        >
          <RefreshCw size={12} className={refreshing ? "spin" : ""} /> Refresh Status
        </button>
      </div>
    );
  }

  // Calculate bucket percentages
  const total = data.total_unresolved;
  const under24Pct = total > 0 ? Math.round((data.under_24h / total) * 100) : 0;
  const hours24To72Pct = total > 0 ? Math.round((data.hours_24_to_72 / total) * 100) : 0;
  const days3To7Pct = total > 0 ? Math.round((data.days_3_to_7 / total) * 100) : 0;
  const over7dPct = total > 0 ? Math.round((data.over_7d / total) * 100) : 0;

  if (compact) {
    return (
      <div
        className="card admin-dashboard-card"
        style={{
          padding: "1.25rem 1.5rem",
          borderRadius: "12px",
          background: "var(--card-bg, #ffffff)",
          border: "1px solid var(--border-subtle, #e2e8f0)",
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          height: "100%",
          boxSizing: "border-box",
        }}
      >
        <div>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.85rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <div
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "8px",
                  background: "rgba(239,68,68,0.1)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#ef4444",
                }}
              >
                <Clock size={16} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700, color: "var(--text-primary)" }}>
                  Issue Aging &amp; Urgent Backlog
                </h3>
                <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--text-muted)" }}>
                  {total.toLocaleString()} active unresolved defects tracking
                </p>
              </div>
            </div>
            <button
              onClick={() => fetchData(true)}
              disabled={refreshing}
              style={{
                background: "none",
                border: "none",
                padding: "0.3rem",
                borderRadius: "6px",
                color: "var(--text-muted)",
                cursor: refreshing ? "not-allowed" : "pointer",
                display: "inline-flex",
                alignItems: "center",
              }}
              title="Refresh aging metrics"
              aria-label="Refresh aging metrics"
            >
              <RefreshCw size={13} className={refreshing ? "spin" : ""} />
            </button>
          </div>

          {/* 3 Metric Cards Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "0.5rem",
              marginBottom: "0.85rem",
            }}
          >
            {/* 7+ Days Old */}
            <div
              onClick={() => navigate("/issues?sort_by=created_at&sort_desc=false")}
              style={{
                padding: "0.6rem 0.5rem",
                borderRadius: "8px",
                background: data.over_7d > 0 ? "rgba(239,68,68,0.06)" : "rgba(148,163,184,0.05)",
                border: data.over_7d > 0 ? "1px solid rgba(239,68,68,0.2)" : "1px solid var(--border-subtle, #e2e8f0)",
                cursor: "pointer",
                textAlign: "center",
                transition: "all 0.15s ease",
              }}
              title="Click to view 7+ day unresolved issues"
            >
              <div style={{ fontSize: "0.65rem", fontWeight: 700, color: "#dc2626", textTransform: "uppercase" }}>
                7+ Days Old
              </div>
              <div style={{ fontSize: "1.2rem", fontWeight: 800, color: "#dc2626", margin: "0.15rem 0" }}>
                {data.over_7d.toLocaleString()}
              </div>
              <div style={{ fontSize: "0.62rem", color: "var(--text-muted)" }}>
                Unresolved
              </div>
            </div>

            {/* Critical/Blocker Aging */}
            <div
              onClick={() => navigate("/issues?severity=CRITICAL")}
              style={{
                padding: "0.6rem 0.5rem",
                borderRadius: "8px",
                background: data.critical_blocker_over_24h > 0 ? "rgba(249,115,22,0.06)" : "rgba(148,163,184,0.05)",
                border: data.critical_blocker_over_24h > 0 ? "1px solid rgba(249,115,22,0.2)" : "1px solid var(--border-subtle, #e2e8f0)",
                cursor: "pointer",
                textAlign: "center",
                transition: "all 0.15s ease",
              }}
              title="Click to view Critical/Blocker issues > 24h"
            >
              <div style={{ fontSize: "0.65rem", fontWeight: 700, color: "#ea580c", textTransform: "uppercase" }}>
                Crit/Block &gt;24h
              </div>
              <div style={{ fontSize: "1.2rem", fontWeight: 800, color: "#ea580c", margin: "0.15rem 0" }}>
                {data.critical_blocker_over_24h.toLocaleString()}
              </div>
              <div style={{ fontSize: "0.62rem", color: "var(--text-muted)" }}>
                High-impact
              </div>
            </div>

            {/* Unassigned Aging */}
            <div
              onClick={() => navigate("/issues?unassigned=true")}
              style={{
                padding: "0.6rem 0.5rem",
                borderRadius: "8px",
                background: data.unassigned_over_7d > 0 ? "rgba(168,85,247,0.06)" : "rgba(148,163,184,0.05)",
                border: data.unassigned_over_7d > 0 ? "1px solid rgba(168,85,247,0.2)" : "1px solid var(--border-subtle, #e2e8f0)",
                cursor: "pointer",
                textAlign: "center",
                transition: "all 0.15s ease",
              }}
              title="Click to view unassigned backlog > 7d"
            >
              <div style={{ fontSize: "0.65rem", fontWeight: 700, color: "#9333ea", textTransform: "uppercase" }}>
                Unassigned &gt;7d
              </div>
              <div style={{ fontSize: "1.2rem", fontWeight: 800, color: "#9333ea", margin: "0.15rem 0" }}>
                {data.unassigned_over_7d.toLocaleString()}
              </div>
              <div style={{ fontSize: "0.62rem", color: "var(--text-muted)" }}>
                Unowned
              </div>
            </div>
          </div>

          {/* Oldest Unresolved Issue preview */}
          {data.oldest_unresolved && (
            <div
              style={{
                padding: "0.55rem 0.75rem",
                borderRadius: "8px",
                background: "rgba(241,245,249,0.6)",
                border: "1px solid var(--border-subtle, #e2e8f0)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "0.5rem",
                marginBottom: "0.85rem",
              }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                  <span style={{ fontSize: "0.65rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>
                    Oldest:
                  </span>
                  <button
                    onClick={() => navigate(`/issues/${data.oldest_unresolved?.id}`)}
                    style={{
                      background: "none",
                      border: "none",
                      padding: 0,
                      color: "var(--primary-color, #4f46e5)",
                      fontWeight: 700,
                      fontSize: "0.8rem",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.2rem",
                    }}
                  >
                    {data.oldest_unresolved.issue_key}
                    <ExternalLink size={11} />
                  </button>
                  <span
                    style={{
                      fontSize: "0.75rem",
                      color: "var(--text-secondary)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {data.oldest_unresolved.title}
                  </span>
                </div>
              </div>
              <span
                style={{
                  fontSize: "0.72rem",
                  fontWeight: 700,
                  color: "#dc2626",
                  flexShrink: 0,
                  background: "rgba(239,68,68,0.1)",
                  padding: "0.15rem 0.45rem",
                  borderRadius: "4px",
                }}
              >
                {data.oldest_unresolved.age_days}d old
              </span>
            </div>
          )}
        </div>

        {/* Footer Action */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            paddingTop: "0.5rem",
            borderTop: "1px solid var(--border-subtle, #e2e8f0)",
          }}
        >
          <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
            Tracking age risks across active defects
          </span>
          <button
            onClick={() => navigate("/issues?sort_by=created_at&sort_desc=false")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.35rem",
              padding: "0.35rem 0.75rem",
              borderRadius: "6px",
              background: "var(--primary-color, #4f46e5)",
              color: "#ffffff",
              fontSize: "0.78rem",
              fontWeight: 600,
              border: "none",
              cursor: "pointer",
            }}
          >
            View Aging Issues
            <ArrowRight size={13} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="admin-dashboard-card"
      style={{
        padding: "1.25rem 1.5rem",
        borderRadius: "12px",
        background: "var(--card-bg, #ffffff)",
        border: "1px solid var(--border-subtle, #e2e8f0)",
        boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
        display: "flex",
        flexDirection: "column",
        gap: "1.1rem",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Clock size={18} style={{ color: "var(--primary-color, #6366f1)" }} />
            <h3
              style={{
                margin: 0,
                fontSize: "1rem",
                fontWeight: 700,
                color: "var(--text-primary, #0f172a)",
                letterSpacing: "-0.01em",
              }}
            >
              Issue Aging Monitor
            </h3>
            <span
              style={{
                fontSize: "0.7rem",
                fontWeight: 600,
                padding: "0.15rem 0.5rem",
                borderRadius: "9999px",
                background: "rgba(99,102,241,0.08)",
                color: "var(--primary-color, #6366f1)",
                border: "1px solid rgba(99,102,241,0.2)",
              }}
              title="Age calculations derived from real database timestamps; no arbitrary SLA policy applied"
            >
              Actual Age
            </span>
          </div>
          <p
            style={{
              margin: "0.25rem 0 0",
              fontSize: "0.78rem",
              color: "var(--text-muted, #64748b)",
            }}
          >
            Tracking {total.toLocaleString()} active unresolved defects across operational age buckets
          </p>
        </div>

        <button
          onClick={() => fetchData(true)}
          disabled={refreshing}
          style={{
            background: "none",
            border: "none",
            padding: "0.35rem",
            borderRadius: "6px",
            color: "var(--text-muted, #94a3b8)",
            cursor: refreshing ? "not-allowed" : "pointer",
            display: "inline-flex",
            alignItems: "center",
          }}
          title="Refresh aging metrics"
          aria-label="Refresh aging metrics"
        >
          <RefreshCw size={14} className={refreshing ? "spin" : ""} />
        </button>
      </div>

      {/* 4 Aging Buckets */}
      <div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
            gap: "0.6rem",
          }}
        >
          {/* Under 24h */}
          <div
            style={{
              padding: "0.75rem 0.6rem",
              borderRadius: "8px",
              background: "rgba(16,185,129,0.06)",
              border: "1px solid rgba(16,185,129,0.2)",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "#059669", textTransform: "uppercase" }}>
              Under 24h
            </div>
            <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "#059669", margin: "0.2rem 0" }}>
              {data.under_24h.toLocaleString()}
            </div>
            <div style={{ fontSize: "0.68rem", color: "#10b981", fontWeight: 600 }}>
              {under24Pct}% • Fresh
            </div>
          </div>

          {/* 24–72h */}
          <div
            style={{
              padding: "0.75rem 0.6rem",
              borderRadius: "8px",
              background: "rgba(59,130,246,0.06)",
              border: "1px solid rgba(59,130,246,0.2)",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "#2563eb", textTransform: "uppercase" }}>
              24–72h
            </div>
            <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "#2563eb", margin: "0.2rem 0" }}>
              {data.hours_24_to_72.toLocaleString()}
            </div>
            <div style={{ fontSize: "0.68rem", color: "#3b82f6", fontWeight: 600 }}>
              {hours24To72Pct}% • Normal
            </div>
          </div>

          {/* 3–7 Days */}
          <div
            style={{
              padding: "0.75rem 0.6rem",
              borderRadius: "8px",
              background: "rgba(245,158,11,0.06)",
              border: "1px solid rgba(245,158,11,0.25)",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "#d97706", textTransform: "uppercase" }}>
              3–7 Days
            </div>
            <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "#d97706", margin: "0.2rem 0" }}>
              {data.days_3_to_7.toLocaleString()}
            </div>
            <div style={{ fontSize: "0.68rem", color: "#f59e0b", fontWeight: 600 }}>
              {days3To7Pct}% • Aging
            </div>
          </div>

          {/* Over 7 Days */}
          <div
            style={{
              padding: "0.75rem 0.6rem",
              borderRadius: "8px",
              background: "rgba(239,68,68,0.06)",
              border: "1px solid rgba(239,68,68,0.25)",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "#dc2626", textTransform: "uppercase" }}>
              &gt; 7 Days
            </div>
            <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "#dc2626", margin: "0.2rem 0" }}>
              {data.over_7d.toLocaleString()}
            </div>
            <div style={{ fontSize: "0.68rem", color: "#ef4444", fontWeight: 600 }}>
              {over7dPct}% • Stale
            </div>
          </div>
        </div>

        {/* Stacked visual distribution bar */}
        <div
          style={{
            height: "6px",
            width: "100%",
            borderRadius: "4px",
            overflow: "hidden",
            display: "flex",
            marginTop: "0.65rem",
            background: "rgba(148,163,184,0.15)",
          }}
          title="Distribution across age buckets"
        >
          {data.under_24h > 0 && (
            <div style={{ width: `${under24Pct}%`, background: "#10b981", height: "100%" }} />
          )}
          {data.hours_24_to_72 > 0 && (
            <div style={{ width: `${hours24To72Pct}%`, background: "#3b82f6", height: "100%" }} />
          )}
          {data.days_3_to_7 > 0 && (
            <div style={{ width: `${days3To7Pct}%`, background: "#f59e0b", height: "100%" }} />
          )}
          {data.over_7d > 0 && (
            <div style={{ width: `${over7dPct}%`, background: "#ef4444", height: "100%" }} />
          )}
        </div>
      </div>

      {/* Oldest Unresolved Issue Highlight */}
      {data.oldest_unresolved && (
        <div
          style={{
            padding: "0.85rem 1rem",
            borderRadius: "8px",
            background: "rgba(241,245,249,0.6)",
            border: "1px solid var(--border-subtle, #e2e8f0)",
            display: "flex",
            flexDirection: "column",
            gap: "0.45rem",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-muted, #64748b)", textTransform: "uppercase" }}>
              Oldest Unresolved Defect
            </span>
            <span
              style={{
                fontSize: "0.78rem",
                fontWeight: 700,
                color: "#dc2626",
                display: "inline-flex",
                alignItems: "center",
                gap: "0.25rem",
              }}
            >
              <Clock size={12} /> {data.oldest_unresolved.age_days} days old
            </span>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem" }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <button
                  onClick={() => navigate(`/issues/${data.oldest_unresolved?.id}`)}
                  style={{
                    background: "none",
                    border: "none",
                    padding: 0,
                    color: "var(--primary-color, #4f46e5)",
                    fontWeight: 700,
                    fontSize: "0.875rem",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.2rem",
                  }}
                  title="View issue details"
                >
                  {data.oldest_unresolved.issue_key}
                  <ExternalLink size={12} />
                </button>
                <span
                  style={{
                    fontSize: "0.82rem",
                    color: "var(--text-primary, #1e293b)",
                    fontWeight: 500,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {data.oldest_unresolved.title}
                </span>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", flexShrink: 0 }}>
              <SeverityBadge severity={data.oldest_unresolved.severity as Severity} />
              <PriorityBadge priority={data.oldest_unresolved.priority as Priority} />
              <StatusBadge status={data.oldest_unresolved.status as IssueStatus} />
            </div>
          </div>
        </div>
      )}

      {/* Operational Attention Indicators (Real age alerts) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "0.6rem",
        }}
      >
        {/* Critical/Blocker >24h */}
        <div
          onClick={() => navigate("/issues?severity=CRITICAL")}
          style={{
            padding: "0.7rem 0.85rem",
            borderRadius: "8px",
            background: data.critical_blocker_over_24h > 0 ? "rgba(239,68,68,0.05)" : "rgba(148,163,184,0.04)",
            border: data.critical_blocker_over_24h > 0 ? "1px solid rgba(239,68,68,0.2)" : "1px solid var(--border-subtle, #e2e8f0)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            transition: "all 0.15s ease",
          }}
          title="Click to view Critical issues"
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <ShieldAlert size={16} style={{ color: data.critical_blocker_over_24h > 0 ? "#ef4444" : "#94a3b8" }} />
            <div>
              <div style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--text-secondary, #475569)" }}>
                Critical/Blocker &gt; 24h
              </div>
              <div style={{ fontSize: "0.65rem", color: "var(--text-muted, #94a3b8)" }}>
                High-impact age alert
              </div>
            </div>
          </div>
          <span
            style={{
              fontSize: "0.95rem",
              fontWeight: 800,
              color: data.critical_blocker_over_24h > 0 ? "#ef4444" : "var(--text-muted, #94a3b8)",
            }}
          >
            {data.critical_blocker_over_24h.toLocaleString()}
          </span>
        </div>

        {/* Unassigned >7 days */}
        <div
          onClick={() => navigate("/issues?unassigned=true")}
          style={{
            padding: "0.7rem 0.85rem",
            borderRadius: "8px",
            background: data.unassigned_over_7d > 0 ? "rgba(249,115,22,0.05)" : "rgba(148,163,184,0.04)",
            border: data.unassigned_over_7d > 0 ? "1px solid rgba(249,115,22,0.2)" : "1px solid var(--border-subtle, #e2e8f0)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            transition: "all 0.15s ease",
          }}
          title="Click to view Unassigned backlog"
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <UserX size={16} style={{ color: data.unassigned_over_7d > 0 ? "#f97316" : "#94a3b8" }} />
            <div>
              <div style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--text-secondary, #475569)" }}>
                Unassigned &gt; 7 days
              </div>
              <div style={{ fontSize: "0.65rem", color: "var(--text-muted, #94a3b8)" }}>
                Neglected backlog
              </div>
            </div>
          </div>
          <span
            style={{
              fontSize: "0.95rem",
              fontWeight: 800,
              color: data.unassigned_over_7d > 0 ? "#f97316" : "var(--text-muted, #94a3b8)",
            }}
          >
            {data.unassigned_over_7d.toLocaleString()}
          </span>
        </div>

        {/* Reopened >24h */}
        <div
          onClick={() => navigate("/issues?status=REOPENED")}
          style={{
            padding: "0.7rem 0.85rem",
            borderRadius: "8px",
            background: data.reopened_over_24h > 0 ? "rgba(168,85,247,0.05)" : "rgba(148,163,184,0.04)",
            border: data.reopened_over_24h > 0 ? "1px solid rgba(168,85,247,0.2)" : "1px solid var(--border-subtle, #e2e8f0)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            transition: "all 0.15s ease",
          }}
          title="Click to view Reopened issues"
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <RotateCcw size={16} style={{ color: data.reopened_over_24h > 0 ? "#a855f7" : "#94a3b8" }} />
            <div>
              <div style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--text-secondary, #475569)" }}>
                Reopened &gt; 24h
              </div>
              <div style={{ fontSize: "0.65rem", color: "var(--text-muted, #94a3b8)" }}>
                Unresolved regressions
              </div>
            </div>
          </div>
          <span
            style={{
              fontSize: "0.95rem",
              fontWeight: 800,
              color: data.reopened_over_24h > 0 ? "#a855f7" : "var(--text-muted, #94a3b8)",
            }}
          >
            {data.reopened_over_24h.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Action Footer */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          paddingTop: "0.6rem",
          borderTop: "1px solid var(--border-subtle, #e2e8f0)",
        }}
      >
        <span style={{ fontSize: "0.72rem", color: "var(--text-muted, #64748b)" }}>
          Sorts active issues chronologically by creation timestamp
        </span>

        <button
          onClick={() => navigate("/issues?sort_by=created_at&sort_desc=false")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.4rem",
            padding: "0.45rem 0.95rem",
            borderRadius: "6px",
            background: "var(--primary-color, #4f46e5)",
            color: "#ffffff",
            fontSize: "0.8rem",
            fontWeight: 600,
            border: "none",
            cursor: "pointer",
            transition: "opacity 0.15s",
          }}
        >
          View Aging Issues
          <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
};
