/**
 * AdminRealtimeActivity — Real-Time Admin Activity Center component.
 *
 * PURPOSE:
 * Displays a live, compact operational activity timeline combining:
 * 1. Persisted recent audit logs from GET /activity
 * 2. Incoming real-time WebSocket notifications dispatched via 'app:realtime_notification'
 *
 * WEBSOCKET ARCHITECTURE:
 * Reuses the existing single application WebSocket connection from NotificationContext.
 * Zero duplicate WebSocket connections are created.
 * Connection status (Live / Reconnecting / Offline) is derived directly from wsStatus.
 *
 * DATA RULES:
 * - 100% real PostgreSQL audit trail and WebSocket events.
 * - Deduplication prevents identical events from rendering twice.
 * - RBAC: Admin only.
 * - Role terminology: ADMIN, DEVELOPER, USER.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCheck,
  CheckCircle2,
  Clock,
  ExternalLink,
  Layers,
  RefreshCw,
  RotateCcw,
  Send,
  UserCheck,
  Wrench,
  Zap,
} from "lucide-react";

import { auditApi } from "../../api/audit";
import { useNotifications } from "../../hooks/useNotifications";
import type { AuditLogItem } from "../../types/audit";
import { formatRelativeTime, formatDate } from "../../utils/formatters";

type ActivityCategory = "all" | "issues" | "sprints" | "assignments" | "resolutions";

interface ActivityEntry {
  key: string;
  id: number | string;
  auditId?: number;
  notificationId?: number;
  action: string;
  entityType?: string;
  entityId?: number | null;
  entityKey?: string | null;
  actorName?: string | null;
  actorRole?: string | null;
  description: string;
  timestamp: string;
  isLive?: boolean;
}

interface ActionDisplayConfig {
  label: string;
  category: "issues" | "sprints" | "assignments" | "resolutions" | "other";
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  badgeBg: string;
  badgeColor: string;
}

function getActionConfig(action: string): ActionDisplayConfig {
  switch (action) {
    case "ISSUE_CREATED":
    case "ISSUE_REPORTED":
      return {
        label: "Issue reported",
        category: "issues",
        icon: AlertCircle,
        iconBg: "rgba(239,68,68,0.12)",
        iconColor: "#ef4444",
        badgeBg: "rgba(239,68,68,0.08)",
        badgeColor: "#dc2626",
      };
    case "ISSUE_ASSIGNED":
      return {
        label: "Issue assigned",
        category: "assignments",
        icon: UserCheck,
        iconBg: "rgba(99,102,241,0.12)",
        iconColor: "#6366f1",
        badgeBg: "rgba(99,102,241,0.08)",
        badgeColor: "#4f46e5",
      };
    case "ISSUE_REOPENED":
      return {
        label: "Issue reopened",
        category: "issues",
        icon: RotateCcw,
        iconBg: "rgba(168,85,247,0.12)",
        iconColor: "#a855f7",
        badgeBg: "rgba(168,85,247,0.08)",
        badgeColor: "#9333ea",
      };
    case "ISSUE_STATUS_CHANGED":
      return {
        label: "Issue status changed",
        category: "issues",
        icon: Wrench,
        iconBg: "rgba(59,130,246,0.12)",
        iconColor: "#3b82f6",
        badgeBg: "rgba(59,130,246,0.08)",
        badgeColor: "#2563eb",
      };
    case "ISSUE_RESOLVED":
      return {
        label: "Issue resolved",
        category: "resolutions",
        icon: CheckCircle2,
        iconBg: "rgba(16,185,129,0.12)",
        iconColor: "#10b981",
        badgeBg: "rgba(16,185,129,0.08)",
        badgeColor: "#059669",
      };
    case "ISSUE_UPDATED":
      return {
        label: "Issue updated",
        category: "issues",
        icon: Activity,
        iconBg: "rgba(14,165,233,0.12)",
        iconColor: "#0ea5e9",
        badgeBg: "rgba(14,165,233,0.08)",
        badgeColor: "#0284c7",
      };
    case "SPRINT_SUBMITTED_FOR_APPROVAL":
      return {
        label: "Sprint submitted",
        category: "sprints",
        icon: Send,
        iconBg: "rgba(20,184,166,0.12)",
        iconColor: "#14b8a6",
        badgeBg: "rgba(20,184,166,0.08)",
        badgeColor: "#0d9488",
      };
    case "SPRINT_APPROVED":
      return {
        label: "Sprint approved",
        category: "sprints",
        icon: CheckCheck,
        iconBg: "rgba(34,197,94,0.12)",
        iconColor: "#22c55e",
        badgeBg: "rgba(34,197,94,0.08)",
        badgeColor: "#16a34a",
      };
    case "SPRINT_CHANGES_REQUESTED":
      return {
        label: "Sprint sent for rework",
        category: "sprints",
        icon: AlertTriangle,
        iconBg: "rgba(249,115,22,0.12)",
        iconColor: "#f97316",
        badgeBg: "rgba(249,115,22,0.08)",
        badgeColor: "#ea580c",
      };
    case "SPRINT_CREATED":
    case "SPRINT_STARTED":
    case "SPRINT_COMPLETED":
    case "SPRINT_ENDED":
    case "SPRINT_OVERDUE":
      return {
        label: action.replace("SPRINT_", "Sprint ").toLowerCase(),
        category: "sprints",
        icon: Layers,
        iconBg: "rgba(139,92,246,0.12)",
        iconColor: "#8b5cf6",
        badgeBg: "rgba(139,92,246,0.08)",
        badgeColor: "#7c3aed",
      };
    case "SPRINT_TESTER_ASSIGNED":
      return {
        label: "Sprint assigned",
        category: "assignments",
        icon: UserCheck,
        iconBg: "rgba(99,102,241,0.12)",
        iconColor: "#6366f1",
        badgeBg: "rgba(99,102,241,0.08)",
        badgeColor: "#4f46e5",
      };
    default:
      return {
        label: action.replace(/_/g, " ").toLowerCase(),
        category: "other",
        icon: Activity,
        iconBg: "rgba(100,116,139,0.12)",
        iconColor: "#64748b",
        badgeBg: "rgba(100,116,139,0.08)",
        badgeColor: "#475569",
      };
  }
}

interface AdminRealtimeActivityProps {
  maxItems?: number;
  refreshTrigger?: number;
}

export const AdminRealtimeActivity: React.FC<AdminRealtimeActivityProps> = ({
  maxItems = 15,
  refreshTrigger,
}) => {
  const navigate = useNavigate();
  const { wsStatus } = useNotifications();

  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<ActivityCategory>("all");
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

  // Map AuditLogItem to unified ActivityEntry
  const mapAuditToEntry = useCallback((log: AuditLogItem): ActivityEntry => {
    return {
      key: `audit-${log.id}`,
      id: log.id,
      auditId: log.id,
      action: log.action,
      entityType: log.entity_type,
      entityId: log.entity_id,
      entityKey: log.entity_key,
      actorName: log.actor?.full_name || null,
      actorRole: log.actor?.role || null,
      description: log.description,
      timestamp: log.created_at,
      isLive: false,
    };
  }, []);

  // Fetch persisted audit logs
  const fetchActivity = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);
    setError(null);

    try {
      const res = await auditApi.list({ page_size: maxItems });
      if (!isMounted.current) return;

      const persistedEntries = (res.items || []).map(mapAuditToEntry);

      setEntries((prev) => {
        // Merge persisted audit items with any existing live WS items that might not have appeared in audit yet
        const existingKeys = new Set(persistedEntries.map((e) => e.key));
        const merged: ActivityEntry[] = [...persistedEntries];

        for (const old of prev) {
          // If it was a live event not yet identified by an audit ID
          if (old.isLive && !old.auditId) {
            // Check if this live event was already captured by one of the persisted audit entries
            const alreadyMatched = persistedEntries.some(
              (p) =>
                p.entityType === old.entityType &&
                p.entityId === old.entityId &&
                p.action === old.action &&
                Math.abs(new Date(p.timestamp).getTime() - new Date(old.timestamp).getTime()) < 15000
            );
            if (!alreadyMatched && !existingKeys.has(old.key)) {
              merged.push(old);
              existingKeys.add(old.key);
            }
          }
        }

        // Sort descending by timestamp
        merged.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        return merged.slice(0, maxItems * 2);
      });
    } catch (err: unknown) {
      if (!isMounted.current) return;
      const msg =
        err &&
        typeof err === "object" &&
        "response" in err &&
        (err as { response?: { data?: { detail?: string } } }).response?.data?.detail;
      setError(msg || "Failed to load recent activity feed.");
    } finally {
      if (isMounted.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [maxItems, mapAuditToEntry]);

  // Initial load
  useEffect(() => {
    fetchActivity();
  }, [fetchActivity]);

  // Parent trigger update
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (refreshTrigger !== undefined) {
      fetchActivity(true);
    }
  }, [refreshTrigger, fetchActivity]);

  // Handle incoming WebSocket notification event without full page reload
  useEffect(() => {
    const handleRealtime = (e: Event) => {
      const customEvent = e as CustomEvent;
      const d = customEvent.detail;
      if (!d) return;

      const liveEntry: ActivityEntry = {
        key: `ws-${d.id || Math.random().toString(36).substring(2, 9)}`,
        id: d.id || Date.now(),
        notificationId: d.id,
        action: d.notification_type || "SYSTEM_EVENT",
        entityType: d.entity_type,
        entityId: d.entity_id,
        entityKey: d.entity_key,
        actorName: null, // Full actor populated upon audit sync
        actorRole: null,
        description: d.message || d.title || "Real-time activity update",
        timestamp: d.created_at || new Date().toISOString(),
        isLive: true,
      };

      setEntries((prev) => {
        // Prevent duplicate live items
        const duplicate = prev.some(
          (p) =>
            (p.notificationId && p.notificationId === liveEntry.notificationId) ||
            (p.entityType === liveEntry.entityType &&
              p.entityId === liveEntry.entityId &&
              p.action === liveEntry.action &&
              Math.abs(new Date(p.timestamp).getTime() - new Date(liveEntry.timestamp).getTime()) < 10000)
        );
        if (duplicate) return prev;
        return [liveEntry, ...prev].slice(0, maxItems * 2);
      });

      // Synchronize with audit API with debounce to ingest full actor metadata
      if (debounceTimer.current) {
        window.clearTimeout(debounceTimer.current);
      }
      debounceTimer.current = window.setTimeout(() => {
        fetchActivity(true);
      }, 500);
    };

    const handleReconnected = () => {
      fetchActivity(true);
    };

    window.addEventListener("app:realtime_notification", handleRealtime);
    window.addEventListener("app:ws_reconnected", handleReconnected);

    return () => {
      window.removeEventListener("app:realtime_notification", handleRealtime);
      window.removeEventListener("app:ws_reconnected", handleReconnected);
    };
  }, [fetchActivity, maxItems]);

  // Filter entries
  const filteredEntries = useMemo(() => {
    if (selectedFilter === "all") return entries.slice(0, maxItems);

    return entries
      .filter((e) => {
        const cfg = getActionConfig(e.action);
        return cfg.category === selectedFilter;
      })
      .slice(0, maxItems);
  }, [entries, selectedFilter, maxItems]);

  // Handle entity click navigation
  const handleEntityClick = (entry: ActivityEntry) => {
    if (entry.entityType === "ISSUE" && entry.entityId) {
      navigate(`/issues/${entry.entityId}`);
    } else if (entry.entityType === "SPRINT") {
      navigate("/admin/sprints");
    } else if (entry.entityType === "PROJECT" && entry.entityId) {
      navigate(`/projects/${entry.entityId}`);
    } else {
      navigate("/admin");
    }
  };

  // ---------------------------------------------------------------------------
  // Connection Indicator
  // ---------------------------------------------------------------------------
  const renderConnectionBadge = () => {
    if (wsStatus === "connected") {
      return (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.35rem",
            fontSize: "0.72rem",
            fontWeight: 600,
            padding: "0.15rem 0.55rem",
            borderRadius: "9999px",
            background: "rgba(16,185,129,0.1)",
            color: "#059669",
            border: "1px solid rgba(16,185,129,0.25)",
          }}
          title="Connected to real-time event pipeline"
        >
          <span
            style={{
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              backgroundColor: "#10b981",
              boxShadow: "0 0 6px rgba(16,185,129,0.6)",
            }}
          />
          Live
        </span>
      );
    }
    if (wsStatus === "connecting") {
      return (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.35rem",
            fontSize: "0.72rem",
            fontWeight: 600,
            padding: "0.15rem 0.55rem",
            borderRadius: "9999px",
            background: "rgba(245,158,11,0.1)",
            color: "#d97706",
            border: "1px solid rgba(245,158,11,0.25)",
          }}
          title="Reconnecting to real-time event pipeline"
        >
          <span
            style={{
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              backgroundColor: "#f59e0b",
            }}
          />
          Reconnecting...
        </span>
      );
    }
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.35rem",
          fontSize: "0.72rem",
          fontWeight: 600,
          padding: "0.15rem 0.55rem",
          borderRadius: "9999px",
          background: "rgba(239,68,68,0.1)",
          color: "#dc2626",
          border: "1px solid rgba(239,68,68,0.25)",
        }}
        title="WebSocket offline; auto-reconnects in background"
      >
        <span
          style={{
            width: "6px",
            height: "6px",
            borderRadius: "50%",
            backgroundColor: "#ef4444",
          }}
        />
        Offline
      </span>
    );
  };

  // ---------------------------------------------------------------------------
  // Loading State
  // ---------------------------------------------------------------------------
  if (loading && entries.length === 0) {
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
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              style={{
                height: "56px",
                background: "rgba(148,163,184,0.08)",
                borderRadius: "8px",
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Error State
  // ---------------------------------------------------------------------------
  if (error && entries.length === 0) {
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
          Error Loading Live Activity
        </div>
        <div style={{ fontSize: "0.85rem", color: "#b91c1c", marginBottom: "1rem" }}>{error}</div>
        <button
          onClick={() => fetchActivity()}
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
        gap: "1rem",
      }}
    >
      {/* Header with Title and Connection Indicator */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Activity size={18} style={{ color: "var(--primary-color, #6366f1)" }} />
          <h3
            style={{
              margin: 0,
              fontSize: "1rem",
              fontWeight: 700,
              color: "var(--text-primary, #0f172a)",
              letterSpacing: "-0.01em",
            }}
          >
            Live Admin Activity
          </h3>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          {renderConnectionBadge()}
          <button
            onClick={() => fetchActivity(true)}
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
            title="Refresh activity feed"
            aria-label="Refresh activity feed"
          >
            <RefreshCw size={14} className={refreshing ? "spin" : ""} />
          </button>
        </div>
      </div>

      {/* Category Filter Pills */}
      <div
        style={{
          display: "flex",
          gap: "0.35rem",
          overflowX: "auto",
          paddingBottom: "0.2rem",
          scrollbarWidth: "none",
        }}
      >
        {(["all", "issues", "sprints", "assignments", "resolutions"] as ActivityCategory[]).map((cat) => {
          const isActive = selectedFilter === cat;
          return (
            <button
              key={cat}
              onClick={() => setSelectedFilter(cat)}
              style={{
                padding: "0.3rem 0.75rem",
                borderRadius: "9999px",
                fontSize: "0.74rem",
                fontWeight: isActive ? 700 : 500,
                border: "1px solid",
                borderColor: isActive ? "var(--primary-color, #6366f1)" : "var(--border-subtle, #e2e8f0)",
                background: isActive ? "var(--primary-color, #6366f1)" : "transparent",
                color: isActive ? "#ffffff" : "var(--text-secondary, #64748b)",
                cursor: "pointer",
                textTransform: "capitalize",
                transition: "all 0.15s ease",
                whiteSpace: "nowrap",
              }}
            >
              {cat === "all" ? "All Activity" : cat}
            </button>
          );
        })}
      </div>

      {/* Vertical Timeline Activity Feed */}
      {filteredEntries.length === 0 ? (
        <div
          style={{
            padding: "2rem 1rem",
            textAlign: "center",
            color: "var(--text-muted, #94a3b8)",
            fontSize: "0.85rem",
          }}
        >
          <Clock size={24} style={{ margin: "0 auto 0.5rem", opacity: 0.5 }} />
          No recent activity found.
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.6rem",
            maxHeight: "460px",
            overflowY: "auto",
            paddingRight: "0.2rem",
          }}
        >
          {filteredEntries.map((item) => {
            const config = getActionConfig(item.action);
            const Icon = config.icon;

            return (
              <div
                key={item.key}
                onClick={() => handleEntityClick(item)}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "0.75rem",
                  padding: "0.65rem 0.8rem",
                  borderRadius: "8px",
                  background: item.isLive ? "rgba(99,102,241,0.04)" : "rgba(248,250,252,0.6)",
                  border: "1px solid",
                  borderColor: item.isLive ? "rgba(99,102,241,0.25)" : "var(--border-subtle, #e2e8f0)",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  position: "relative",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "rgba(241,245,249,0.9)";
                  e.currentTarget.style.borderColor = "var(--primary-color, #6366f1)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = item.isLive ? "rgba(99,102,241,0.04)" : "rgba(248,250,252,0.6)";
                  e.currentTarget.style.borderColor = item.isLive ? "rgba(99,102,241,0.25)" : "var(--border-subtle, #e2e8f0)";
                }}
                title={`Click to inspect details: ${item.description}`}
              >
                {/* Event Icon */}
                <div
                  style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "8px",
                    backgroundColor: config.iconBg,
                    color: config.iconColor,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    marginTop: "0.1rem",
                  }}
                >
                  <Icon size={16} />
                </div>

                {/* Event Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
                      <span
                        style={{
                          fontSize: "0.76rem",
                          fontWeight: 700,
                          color: config.badgeColor,
                        }}
                      >
                        {config.label}
                      </span>

                      {item.entityKey && (
                        <span
                          style={{
                            fontSize: "0.72rem",
                            fontWeight: 700,
                            padding: "0.1rem 0.35rem",
                            borderRadius: "4px",
                            background: "rgba(99,102,241,0.08)",
                            color: "var(--primary-color, #4f46e5)",
                            fontFamily: "monospace",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.2rem",
                          }}
                        >
                          {item.entityKey}
                          <ExternalLink size={10} />
                        </span>
                      )}

                      {item.isLive && (
                        <span
                          style={{
                            fontSize: "0.65rem",
                            fontWeight: 700,
                            padding: "0.08rem 0.35rem",
                            borderRadius: "4px",
                            background: "#10b981",
                            color: "#ffffff",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.2rem",
                          }}
                        >
                          <Zap size={9} /> Just Now
                        </span>
                      )}
                    </div>

                    <span
                      style={{
                        fontSize: "0.7rem",
                        color: "var(--text-muted, #94a3b8)",
                        whiteSpace: "nowrap",
                        flexShrink: 0,
                      }}
                      title={formatDate(item.timestamp)}
                    >
                      {formatRelativeTime(item.timestamp)}
                    </span>
                  </div>

                  {/* Description / Summary */}
                  <div
                    style={{
                      fontSize: "0.76rem",
                      color: "var(--text-secondary, #475569)",
                      marginTop: "0.2rem",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {item.description}
                  </div>

                  {/* Actor tag */}
                  {item.actorName && (
                    <div
                      style={{
                        fontSize: "0.68rem",
                        color: "var(--text-muted, #64748b)",
                        marginTop: "0.2rem",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.3rem",
                      }}
                    >
                      <span>By</span>
                      <strong style={{ color: "var(--text-primary, #1e293b)" }}>{item.actorName}</strong>
                      {item.actorRole && (
                        <span style={{ fontSize: "0.65rem", opacity: 0.8 }}>({item.actorRole})</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer Navigation */}
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
          Showing latest {filteredEntries.length} operational events
        </span>

        <button
          onClick={() => navigate("/admin")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.4rem",
            padding: "0.4rem 0.85rem",
            borderRadius: "6px",
            background: "transparent",
            color: "var(--primary-color, #4f46e5)",
            fontSize: "0.8rem",
            fontWeight: 600,
            border: "1px solid var(--border-subtle, #e2e8f0)",
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "rgba(99,102,241,0.06)";
            e.currentTarget.style.borderColor = "var(--primary-color, #4f46e5)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
            e.currentTarget.style.borderColor = "var(--border-subtle, #e2e8f0)";
          }}
        >
          View All Activity
          <ArrowRight size={13} />
        </button>
      </div>
    </div>
  );
};
