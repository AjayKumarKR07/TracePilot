import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Bot,
  CheckCircle2,
  Clock,
  Cpu,
  Database,
  Globe,
  Lock,
  RefreshCw,
  Server,
  ShieldCheck,
  Wifi,
  XCircle,
} from 'lucide-react';
import { adminApi } from '../api/admin';
import { getApiErrorMessage } from '../api/client';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import type { SystemHealthResponse } from '../types/admin';
import { formatDate } from '../utils/formatters';

export const AdminSystemHealthPage: React.FC = () => {
  const [healthData, setHealthData] = useState<SystemHealthResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);

  const fetchHealth = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const data = await adminApi.getSystemHealth();
      setHealthData(data);
      setLastRefreshedAt(new Date());
    } catch (err) {
      setError(getApiErrorMessage(err) || 'Failed to fetch live system health metrics.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth(false);
  }, [fetchHealth]);

  // Helper for status badge rendering
  const renderStatusBadge = (status?: string) => {
    const s = (status || '').toLowerCase();
    if (s === 'healthy' || s === 'available') {
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            padding: '0.2rem 0.65rem',
            borderRadius: '9999px',
            fontSize: '0.75rem',
            fontWeight: 600,
            background: 'rgba(16, 185, 129, 0.1)',
            color: '#059669',
            border: '1px solid rgba(16, 185, 129, 0.25)',
          }}
        >
          <span
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: '#10b981',
            }}
          />
          Healthy
        </span>
      );
    }
    if (s === 'degraded' || s === 'misconfigured') {
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            padding: '0.2rem 0.65rem',
            borderRadius: '9999px',
            fontSize: '0.75rem',
            fontWeight: 600,
            background: 'rgba(245, 158, 11, 0.1)',
            color: '#d97706',
            border: '1px solid rgba(245, 158, 11, 0.25)',
          }}
        >
          <span
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: '#f59e0b',
            }}
          />
          Degraded
        </span>
      );
    }
    if (s === 'down') {
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            padding: '0.2rem 0.65rem',
            borderRadius: '9999px',
            fontSize: '0.75rem',
            fontWeight: 600,
            background: 'rgba(239, 68, 68, 0.1)',
            color: '#dc2626',
            border: '1px solid rgba(239, 68, 68, 0.25)',
          }}
        >
          <span
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: '#ef4448',
            }}
          />
          Down
        </span>
      );
    }
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.35rem',
          padding: '0.2rem 0.65rem',
          borderRadius: '9999px',
          fontSize: '0.75rem',
          fontWeight: 600,
          background: 'rgba(100, 116, 139, 0.1)',
          color: '#64748b',
          border: '1px solid rgba(100, 116, 139, 0.25)',
        }}
      >
        Unavailable
      </span>
    );
  };

  const getOverallConfig = (status?: string) => {
    const s = (status || '').toLowerCase();
    if (s === 'healthy') {
      return {
        icon: <CheckCircle2 size={24} color="#10b981" />,
        title: 'All Systems Operational',
        desc: 'Core services, database engine, real-time messaging, and application runtime are operating normally.',
        bg: 'rgba(16, 185, 129, 0.05)',
        border: 'rgba(16, 185, 129, 0.25)',
        pillColor: '#059669',
      };
    }
    if (s === 'degraded') {
      return {
        icon: <AlertTriangle size={24} color="#f59e0b" />,
        title: 'System Operating with Warnings',
        desc: 'One or more secondary components or configurations require administrative review.',
        bg: 'rgba(245, 158, 11, 0.05)',
        border: 'rgba(245, 158, 11, 0.25)',
        pillColor: '#d97706',
      };
    }
    return {
      icon: <XCircle size={24} color="#ef4444" />,
      title: 'System Degradation or Outage Detected',
      desc: 'Critical infrastructure components or backend services are currently unreachable.',
      bg: 'rgba(239, 68, 68, 0.05)',
      border: 'rgba(239, 68, 68, 0.25)',
      pillColor: '#dc2626',
    };
  };

  return (
    <div className="page-container" style={{ maxWidth: '1280px', margin: '0 auto', paddingBottom: '3rem' }}>
      {/* ── HEADER ── */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          marginBottom: '1.5rem',
          paddingBottom: '1.25rem',
          borderBottom: '1px solid var(--border-color, #e2e8f0)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '38px',
                height: '38px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
                color: '#fff',
              }}
            >
              <Activity size={20} />
            </div>
            <h1
              style={{
                fontSize: '1.65rem',
                fontWeight: 700,
                color: 'var(--text-color, #0f172a)',
                margin: 0,
                letterSpacing: '-0.02em',
              }}
            >
              System Health
            </h1>
          </div>
          <p
            style={{
              fontSize: '0.88rem',
              color: 'var(--text-muted, #64748b)',
              margin: '0.35rem 0 0 0',
              lineHeight: 1.5,
            }}
          >
            Monitor TracePilot infrastructure, services, database, AI, real-time connectivity and application health.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          {lastRefreshedAt && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                fontSize: '0.78rem',
                color: 'var(--text-muted, #64748b)',
              }}
            >
              <Clock size={14} />
              <span>Last checked: {lastRefreshedAt.toLocaleTimeString()}</span>
            </div>
          )}

          <button
            onClick={() => fetchHealth(true)}
            disabled={loading || refreshing}
            className="btn btn-secondary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.45rem 0.95rem',
              fontSize: '0.82rem',
              fontWeight: 500,
              cursor: loading || refreshing ? 'not-allowed' : 'pointer',
            }}
          >
            <RefreshCw size={14} className={refreshing ? 'spin-animation' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {error && <ErrorMessage message={error} onRetry={() => fetchHealth(false)} />}

      {loading && !healthData ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem 0' }}>
          <LoadingSpinner message="Querying live system operational signals..." />
        </div>
      ) : healthData ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* ── OVERALL STATUS BANNER ── */}
          {(() => {
            const config = getOverallConfig(healthData.overall_status);
            return (
              <div
                style={{
                  background: config.bg,
                  border: `1px solid ${config.border}`,
                  borderRadius: '12px',
                  padding: '1.25rem 1.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '1rem',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ flexShrink: 0 }}>{config.icon}</div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      <span
                        style={{
                          fontSize: '1.1rem',
                          fontWeight: 700,
                          color: 'var(--text-color, #0f172a)',
                        }}
                      >
                        {config.title}
                      </span>
                      {renderStatusBadge(healthData.overall_status)}
                    </div>
                    <p
                      style={{
                        margin: '0.2rem 0 0 0',
                        fontSize: '0.85rem',
                        color: 'var(--text-muted, #64748b)',
                      }}
                    >
                      {config.desc}
                    </p>
                  </div>
                </div>

                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted, #64748b)', textAlign: 'right' }}>
                  <div>Reported at {formatDate(healthData.timestamp)}</div>
                  <div style={{ fontWeight: 500, color: 'var(--text-color, #0f172a)', marginTop: '0.15rem' }}>
                    Environment: {healthData.application.environment}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ── 6 COMPACT OVERVIEW CARDS ── */}
          <div>
            <h2
              style={{
                fontSize: '1rem',
                fontWeight: 600,
                color: 'var(--text-color, #0f172a)',
                margin: '0 0 0.85rem 0',
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
              }}
            >
              <Server size={18} color="#4f46e5" />
              <span>Core Service Status</span>
            </h2>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                gap: '1rem',
              }}
            >
              {/* 1. APPLICATION CARD */}
              <div
                className="card"
                style={{
                  padding: '1.15rem',
                  borderRadius: '10px',
                  background: '#ffffff',
                  border: '1px solid var(--border-color, #e2e8f0)',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Globe size={18} color="#4f46e5" />
                    <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#1e293b' }}>Application API</span>
                  </div>
                  {renderStatusBadge(healthData.application.status)}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#64748b', lineHeight: 1.6 }}>
                  <div>Service: <strong style={{ color: '#0f172a' }}>{healthData.application.service}</strong></div>
                  <div>Version: <strong style={{ color: '#0f172a' }}>{healthData.application.version}</strong></div>
                  <div>Prefix: <code style={{ fontSize: '0.75rem', background: '#f1f5f9', padding: '0.1rem 0.35rem', borderRadius: '4px' }}>{healthData.application.api_prefix}</code></div>
                </div>
              </div>

              {/* 2. DATABASE CARD */}
              <div
                className="card"
                style={{
                  padding: '1.15rem',
                  borderRadius: '10px',
                  background: '#ffffff',
                  border: '1px solid var(--border-color, #e2e8f0)',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Database size={18} color="#059669" />
                    <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#1e293b' }}>PostgreSQL</span>
                  </div>
                  {renderStatusBadge(healthData.database.status)}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#64748b', lineHeight: 1.6 }}>
                  <div>Connection: <strong style={{ color: healthData.database.connected ? '#059669' : '#dc2626' }}>{healthData.database.connected ? 'Connected' : 'Disconnected'}</strong></div>
                  <div>Ping Latency: <strong style={{ color: '#0f172a' }}>{healthData.database.latency_ms !== null ? `${healthData.database.latency_ms} ms` : 'Unavailable'}</strong></div>
                  <div>Catalog: <strong style={{ color: '#0f172a' }}>{healthData.database.database_name}</strong></div>
                </div>
              </div>

              {/* 3. WEBSOCKET CARD */}
              <div
                className="card"
                style={{
                  padding: '1.15rem',
                  borderRadius: '10px',
                  background: '#ffffff',
                  border: '1px solid var(--border-color, #e2e8f0)',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Wifi size={18} color="#2563eb" />
                    <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#1e293b' }}>WebSocket</span>
                  </div>
                  {renderStatusBadge(healthData.websocket.status)}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#64748b', lineHeight: 1.6 }}>
                  <div>Active Users: <strong style={{ color: '#0f172a' }}>{healthData.websocket.active_users}</strong></div>
                  <div>Open Sockets: <strong style={{ color: '#0f172a' }}>{healthData.websocket.total_connections}</strong></div>
                  <div>Service: <strong style={{ color: '#0f172a' }}>Live Manager</strong></div>
                </div>
              </div>

              {/* 4. AI SERVICE CARD */}
              <div
                className="card"
                style={{
                  padding: '1.15rem',
                  borderRadius: '10px',
                  background: '#ffffff',
                  border: '1px solid var(--border-color, #e2e8f0)',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Bot size={18} color="#7c3aed" />
                    <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#1e293b' }}>AI Service</span>
                  </div>
                  {renderStatusBadge(healthData.ai.status)}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#64748b', lineHeight: 1.6 }}>
                  <div>Provider: <strong style={{ color: '#0f172a', textTransform: 'capitalize' }}>{healthData.ai.provider}</strong></div>
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={healthData.ai.primary_model}>
                    Model: <strong style={{ color: '#0f172a' }}>{healthData.ai.primary_model}</strong>
                  </div>
                  <div>Verified: <strong style={{ color: healthData.ai.model_verified ? '#059669' : '#64748b' }}>{healthData.ai.model_verified === true ? 'Verified' : healthData.ai.model_verified === false ? 'Failed' : 'Unavailable'}</strong></div>
                </div>
              </div>

              {/* 5. AUTHENTICATION CARD */}
              <div
                className="card"
                style={{
                  padding: '1.15rem',
                  borderRadius: '10px',
                  background: '#ffffff',
                  border: '1px solid var(--border-color, #e2e8f0)',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <ShieldCheck size={18} color="#d97706" />
                    <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#1e293b' }}>Authentication</span>
                  </div>
                  {renderStatusBadge(healthData.auth.status)}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#64748b', lineHeight: 1.6 }}>
                  <div>JWT Algorithm: <strong style={{ color: '#0f172a' }}>{healthData.auth.jwt_algorithm}</strong></div>
                  <div>Token TTL: <strong style={{ color: '#0f172a' }}>{healthData.auth.token_expire_minutes} minutes</strong></div>
                  <div>Secret: <strong style={{ color: healthData.auth.secret_configured ? '#059669' : '#d97706' }}>{healthData.auth.secret_configured ? 'Configured' : 'Default'}</strong></div>
                </div>
              </div>

              {/* 6. BACKGROUND SERVICES CARD */}
              <div
                className="card"
                style={{
                  padding: '1.15rem',
                  borderRadius: '10px',
                  background: '#ffffff',
                  border: '1px solid var(--border-color, #e2e8f0)',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Cpu size={18} color="#0891b2" />
                    <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#1e293b' }}>Background Tasks</span>
                  </div>
                  {renderStatusBadge(
                    healthData.background_services.some((s) => s.status === 'down')
                      ? 'down'
                      : healthData.background_services.some((s) => s.status === 'degraded')
                      ? 'degraded'
                      : 'healthy'
                  )}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#64748b', lineHeight: 1.6 }}>
                  <div>Active Workers: <strong style={{ color: '#0f172a' }}>{healthData.background_services.length}</strong></div>
                  <div>WS Dispatcher: <strong style={{ color: '#059669' }}>Healthy</strong></div>
                  <div>SMTP Worker: <strong style={{ color: healthData.background_services.find((s) => s.name.includes('SMTP'))?.status === 'healthy' ? '#059669' : '#d97706' }}>{healthData.background_services.find((s) => s.name.includes('SMTP'))?.status === 'healthy' ? 'Healthy' : 'Unavailable'}</strong></div>
                </div>
              </div>
            </div>
          </div>

          {/* ── DETAILED HEALTH INFORMATION SECTIONS ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))', gap: '1.25rem' }}>
            {/* 1. API & APPLICATION DETAILS */}
            <div
              className="card"
              style={{
                padding: '1.35rem',
                borderRadius: '10px',
                background: '#ffffff',
                border: '1px solid var(--border-color, #e2e8f0)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '1rem',
                  paddingBottom: '0.75rem',
                  borderBottom: '1px solid #f1f5f9',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Globe size={18} color="#4f46e5" />
                  <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 600, color: '#0f172a' }}>
                    API &amp; Application Health
                  </h3>
                </div>
                {renderStatusBadge(healthData.application.status)}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', fontSize: '0.84rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Service Name:</span>
                  <span style={{ fontWeight: 600, color: '#0f172a' }}>{healthData.application.service}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Application Version:</span>
                  <span style={{ fontWeight: 600, color: '#0f172a' }}>{healthData.application.version}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Active Environment:</span>
                  <span style={{ fontWeight: 600, color: '#0f172a', textTransform: 'capitalize' }}>
                    {healthData.application.environment}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>API Prefix:</span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#0f172a' }}>
                    {healthData.application.api_prefix}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Debug Mode:</span>
                  <span style={{ fontWeight: 600, color: healthData.application.debug ? '#d97706' : '#059669' }}>
                    {healthData.application.debug ? 'Enabled (Development)' : 'Disabled'}
                  </span>
                </div>
              </div>
            </div>

            {/* 2. POSTGRESQL DATABASE DETAILS */}
            <div
              className="card"
              style={{
                padding: '1.35rem',
                borderRadius: '10px',
                background: '#ffffff',
                border: '1px solid var(--border-color, #e2e8f0)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '1rem',
                  paddingBottom: '0.75rem',
                  borderBottom: '1px solid #f1f5f9',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Database size={18} color="#059669" />
                  <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 600, color: '#0f172a' }}>
                    PostgreSQL Database
                  </h3>
                </div>
                {renderStatusBadge(healthData.database.status)}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', fontSize: '0.84rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Connection Status:</span>
                  <span style={{ fontWeight: 600, color: healthData.database.connected ? '#059669' : '#dc2626' }}>
                    {healthData.database.connected ? 'Connected (Live Ping Verified)' : 'Disconnected'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Driver &amp; Dialect:</span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#0f172a' }}>
                    {healthData.database.driver}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Database Catalog:</span>
                  <span style={{ fontWeight: 600, color: '#0f172a' }}>{healthData.database.database_name}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Database Host &amp; Port:</span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#0f172a' }}>
                    {healthData.database.host}:{healthData.database.port}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Measured Query Latency:</span>
                  <span style={{ fontWeight: 600, color: '#0f172a' }}>
                    {healthData.database.latency_ms !== null ? `${healthData.database.latency_ms} ms (SELECT 1)` : 'Unavailable'}
                  </span>
                </div>
                {healthData.database.pool_size !== null && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Engine Connection Pool:</span>
                    <span style={{ fontWeight: 600, color: '#0f172a' }}>{healthData.database.pool_size} slots</span>
                  </div>
                )}
                <div
                  style={{
                    marginTop: '0.25rem',
                    padding: '0.45rem 0.65rem',
                    background: '#f8fafc',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    color: '#64748b',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                  }}
                >
                  <Lock size={12} color="#64748b" />
                  <span>Security: Database credentials and raw URLs are sanitized and withheld.</span>
                </div>
              </div>
            </div>

            {/* 3. WEBSOCKET HEALTH DETAILS */}
            <div
              className="card"
              style={{
                padding: '1.35rem',
                borderRadius: '10px',
                background: '#ffffff',
                border: '1px solid var(--border-color, #e2e8f0)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '1rem',
                  paddingBottom: '0.75rem',
                  borderBottom: '1px solid #f1f5f9',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Wifi size={18} color="#2563eb" />
                  <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 600, color: '#0f172a' }}>
                    WebSocket &amp; Real-Time Connectivity
                  </h3>
                </div>
                {renderStatusBadge(healthData.websocket.status)}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', fontSize: '0.84rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Connection State:</span>
                  <span style={{ fontWeight: 600, color: '#059669' }}>Connected</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Active Authenticated Users:</span>
                  <span style={{ fontWeight: 600, color: '#0f172a' }}>{healthData.websocket.active_users}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Total Open Connections:</span>
                  <span style={{ fontWeight: 600, color: '#0f172a' }}>{healthData.websocket.total_connections}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Connection Infrastructure:</span>
                  <span style={{ fontWeight: 600, color: '#0f172a' }}>{healthData.websocket.service}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Channel Multiplexing:</span>
                  <span style={{ fontWeight: 600, color: '#0f172a' }}>Direct Per-User Dispatch</span>
                </div>
              </div>
            </div>

            {/* 4. AI SERVICE DETAILS */}
            <div
              className="card"
              style={{
                padding: '1.35rem',
                borderRadius: '10px',
                background: '#ffffff',
                border: '1px solid var(--border-color, #e2e8f0)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '1rem',
                  paddingBottom: '0.75rem',
                  borderBottom: '1px solid #f1f5f9',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Bot size={18} color="#7c3aed" />
                  <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 600, color: '#0f172a' }}>
                    AI Service &amp; Model Health
                  </h3>
                </div>
                {renderStatusBadge(healthData.ai.status)}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', fontSize: '0.84rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Provider:</span>
                  <span style={{ fontWeight: 600, color: '#0f172a', textTransform: 'capitalize' }}>
                    {healthData.ai.provider}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Primary Model:</span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#0f172a' }}>
                    {healthData.ai.primary_model}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Fallback Model:</span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#0f172a' }}>
                    {healthData.ai.fallback_model || 'Unavailable'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Model Verification:</span>
                  <span
                    style={{
                      fontWeight: 600,
                      color: healthData.ai.model_verified ? '#059669' : '#64748b',
                    }}
                  >
                    {healthData.ai.model_verified === true
                      ? 'Verified & Online'
                      : healthData.ai.model_verified === false
                      ? 'Verification Failed'
                      : 'Unavailable'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>API Key Configuration:</span>
                  <span
                    style={{
                      fontWeight: 600,
                      color: healthData.ai.api_key_configured ? '#059669' : '#d97706',
                    }}
                  >
                    {healthData.ai.api_key_configured ? 'Configured & Active' : 'Not Configured'}
                  </span>
                </div>
                <div
                  style={{
                    marginTop: '0.25rem',
                    padding: '0.45rem 0.65rem',
                    background: '#f8fafc',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    color: '#64748b',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                  }}
                >
                  <Lock size={12} color="#64748b" />
                  <span>Security: Groq credentials and API tokens are never exposed.</span>
                </div>
              </div>
            </div>
          </div>

          {/* ── BACKGROUND SERVICES LIST ── */}
          <div
            className="card"
            style={{
              padding: '1.35rem',
              borderRadius: '10px',
              background: '#ffffff',
              border: '1px solid var(--border-color, #e2e8f0)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1rem',
                paddingBottom: '0.75rem',
                borderBottom: '1px solid #f1f5f9',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Cpu size={18} color="#0891b2" />
                <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 600, color: '#0f172a' }}>
                  TracePilot Background Workers &amp; Daemons
                </h3>
              </div>
              <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                {healthData.background_services.length} Registered Workers
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {healthData.background_services.map((service, index) => (
                <div
                  key={index}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '1rem',
                    padding: '0.75rem 1rem',
                    background: '#f8fafc',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem', color: '#0f172a' }}>
                      {service.name}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.15rem' }}>
                      {service.description}
                    </div>
                  </div>
                  <div>{renderStatusBadge(service.status)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
