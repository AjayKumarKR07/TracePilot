import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeftRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Lock,
  Search,
  ShieldCheck,
  TestTube2,
  User,
  X,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { usersApi } from '../../api/users';
import type { UserDetail } from '../../types/user';

interface SwitchRoleModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/** The strictly allowed 3 roles for Switch Role feature. */
export type SwitchableRole = 'ADMIN' | 'DEVELOPER' | 'USER';

export interface SwitchRoleOption {
  role: SwitchableRole;
  name: string;
  badge: string;
  dashboardName: string;
  dashboardPath: string;
  description: string;
  color: string;
}

/** Strictly the 3 supported roles in TracePilot Switch Role. */
export const SWITCH_ROLES: SwitchRoleOption[] = [
  {
    role: 'ADMIN',
    name: 'Administrator',
    badge: 'ADMIN',
    dashboardName: 'Administrator Dashboard',
    dashboardPath: '/admin-dashboard',
    description: 'System administration, user and project management, and sprint approvals.',
    color: 'var(--danger)',
  },
  {
    role: 'DEVELOPER',
    name: 'DEVELOPER',
    badge: 'DEVELOPER',
    dashboardName: 'Developer Dashboard',
    dashboardPath: '/developer-dashboard',
    description: 'QA defect verification, issue lifecycle progression, and sprint execution.',
    color: 'var(--primary)',
  },
  {
    role: 'USER',
    name: 'User',
    badge: 'USER',
    dashboardName: 'User Dashboard',
    dashboardPath: '/dashboard',
    description: 'Defect reporting, tracking reported tickets, and project collaboration.',
    color: 'var(--success)',
  },
];

/** Map a SwitchableRole to its destination dashboard. */
export function getDashboardPath(role: SwitchableRole): string {
  switch (role) {
    case 'ADMIN':
      return '/admin-dashboard';
    case 'DEVELOPER':
      return '/developer-dashboard';
    case 'USER':
    default:
      return '/dashboard';
  }
}

export const ROLE_COLOR_MAP: Record<SwitchableRole, string> = {
  ADMIN: 'var(--danger)',
  DEVELOPER: 'var(--primary)',
  USER: 'var(--success)',
};

const ROLE_ICON: React.FC<{ role: SwitchableRole; size?: number }> = ({ role, size = 15 }) => {
  if (role === 'ADMIN') return <ShieldCheck size={size} />;
  if (role === 'DEVELOPER') return <TestTube2 size={size} />;
  return <User size={size} />;
};

export const SwitchRoleModal: React.FC<SwitchRoleModalProps> = ({ isOpen, onClose }) => {
  const { user, switchRole } = useAuth();
  const navigate = useNavigate();

  // Step state machine:
  // Step 1: selectedRole === null && pendingUser === null (Role selection)
  // Step 2: selectedRole !== null && pendingUser === null (User selection within role)
  // Step 3: pendingUser !== null (Confirmation prompt)
  const [selectedRole, setSelectedRole] = useState<SwitchableRole | null>(null);
  const [pendingUser, setPendingUser] = useState<UserDetail | null>(null);

  const [users, setUsers] = useState<UserDetail[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [switching, setSwitching] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const searchRef = useRef<HTMLInputElement>(null);
  const isAdmin = user?.role === 'ADMIN';

  // Fetch all active users when opened as ADMIN
  const fetchUsers = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    setError(null);
    try {
      const resp = await usersApi.list({ page_size: 100, is_active: true });
      // Exclude DEVELOPER completely from Switch Role user lists
      const validUsers = resp.items.filter(
        (u) =>
          u.is_active &&
          (u.role === 'ADMIN' || u.role === 'DEVELOPER' || u.role === 'USER')
      );
      setUsers(validUsers);
    } catch {
      setError('Could not load users. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  // Reset modal state on open
  useEffect(() => {
    if (isOpen) {
      setSelectedRole(null);
      setPendingUser(null);
      setSearch('');
      setError(null);
      setSwitching(null);
      if (isAdmin) fetchUsers();
    }
  }, [isOpen, isAdmin, fetchUsers]);

  // Focus search input when navigating to user selection step
  useEffect(() => {
    if (selectedRole && !pendingUser) {
      setSearch('');
      setTimeout(() => searchRef.current?.focus(), 80);
    }
  }, [selectedRole, pendingUser]);

  // Close or go back on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (pendingUser) {
          setPendingUser(null);
        } else if (selectedRole) {
          setSelectedRole(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose, selectedRole, pendingUser]);

  // Confirm and execute role switch
  const handleConfirmSwitch = async (targetUser: UserDetail) => {
    if (switching !== null || targetUser.id === user?.id) return;
    setSwitching(targetUser.id);
    setError(null);
    try {
      const resp = await switchRole(targetUser.id);
      setSelectedRole(null);
      setPendingUser(null);
      onClose();
      // Route exclusively using the target role
      const targetRole = resp.user.role as SwitchableRole;
      navigate(getDashboardPath(targetRole), { replace: true });
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail ?? 'Failed to switch into target account. Please try again.');
      setSwitching(null);
    }
  };

  // Filter users by the selected role and search query
  const filteredUsers = useMemo(() => {
    if (!selectedRole) return [];
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (u.role !== selectedRole) return false;
      if (!q) return true;
      return (
        u.full_name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q)
      );
    });
  }, [users, selectedRole, search]);

  const activeRoleOption = SWITCH_ROLES.find((r) => r.role === selectedRole);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        aria-hidden="true"
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.65)',
          backdropFilter: 'blur(4px)',
          zIndex: 200,
          animation: 'swrFadeIn 0.15s ease',
        }}
      />

      {/* Modal Container */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Switch Role"
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 201,
          width: 'min(540px, calc(100vw - 2rem))',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-muted)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-lg), 0 0 0 1px rgba(99,102,241,0.1)',
          animation: 'swrSlideUp 0.18s ease',
          overflow: 'hidden',
        }}
      >
        {/* â”€â”€ Top Header Bar â”€â”€ */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '1rem 1.25rem',
            borderBottom: '1px solid var(--border-subtle)',
            flexShrink: 0,
          }}
        >
          {pendingUser ? (
            <button
              onClick={() => {
                setPendingUser(null);
                setError(null);
              }}
              style={{
                width: 32,
                height: 32,
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)',
                background: 'transparent',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s',
              }}
              title="Back to user selection"
            >
              <ChevronLeft size={18} />
            </button>
          ) : selectedRole ? (
            <button
              onClick={() => {
                setSelectedRole(null);
                setError(null);
              }}
              style={{
                width: 32,
                height: 32,
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)',
                background: 'transparent',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s',
              }}
              title="Back to role selection"
            >
              <ChevronLeft size={18} />
            </button>
          ) : (
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 'var(--radius-md)',
                background: 'var(--primary-subtle)',
                border: '1px solid rgba(99,102,241,0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--primary)',
                flexShrink: 0,
              }}
            >
              <ArrowLeftRight size={18} />
            </div>
          )}

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: '0.96rem', color: 'var(--text-primary)' }}>
              {pendingUser
                ? 'Confirm Role Switch'
                : selectedRole
                ? `Select Authorized ${activeRoleOption?.name}`
                : 'Switch Role'}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.05rem' }}>
              {pendingUser
                ? 'Review user details and destination dashboard before proceeding'
                : selectedRole
                ? `Choose an active ${activeRoleOption?.name} account to switch session`
                : 'Select a target role to view authorized user accounts'}
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              width: 30,
              height: 30,
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-subtle)',
              background: 'transparent',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s',
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-surface-hover)';
              (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
              (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)';
            }}
          >
            <X size={15} />
          </button>
        </div>

        {/* â”€â”€ Active Session Pill (Visible in Step 1) â”€â”€ */}
        {!selectedRole && !pendingUser && user && (
          <div
            style={{
              padding: '0.65rem 1.25rem',
              background: 'var(--bg-surface-elevated)',
              borderBottom: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem',
              flexShrink: 0,
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: 'var(--primary)',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.68rem',
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {user.full_name
                .split(' ')
                .map((p) => p[0])
                .join('')
                .toUpperCase()
                .slice(0, 2)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {user.full_name}
              </div>
              <div style={{ fontSize: '0.71rem', color: 'var(--text-muted)' }}>{user.email}</div>
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
                fontSize: '0.7rem',
                fontWeight: 600,
                color: ROLE_COLOR_MAP[user.role as SwitchableRole] ?? 'var(--primary)',
                background: `${ROLE_COLOR_MAP[user.role as SwitchableRole] ?? 'var(--primary)'}18`,
                border: `1px solid ${ROLE_COLOR_MAP[user.role as SwitchableRole] ?? 'var(--primary)'}30`,
                borderRadius: 'var(--radius-full)',
                padding: '0.2rem 0.55rem',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              <Check size={12} />
              Current Session: {user.role}
            </div>
          </div>
        )}

        {/* â”€â”€ Error Banner â”€â”€ */}
        {error && (
          <div
            style={{
              margin: '0.75rem 1.25rem 0',
              padding: '0.6rem 0.85rem',
              background: 'var(--danger-subtle)',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.8rem',
              color: 'var(--danger)',
              flexShrink: 0,
            }}
          >
            {error}
          </div>
        )}

        {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
        {/* STEP 1: ROLE SELECTION (ONLY ADMIN, DEVELOPER, USER)                  */}
        {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
        {!selectedRole && !pendingUser && (
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
            }}
          >
            <div style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Available Roles ({SWITCH_ROLES.length})
            </div>

            {/* Render exactly the 3 roles */}
            {SWITCH_ROLES.map((r) => {
              const isCurrentRole = user?.role === r.role;
              // Non-admins cannot switch to other accounts (RBAC)
              const isDisabled = !isAdmin && !isCurrentRole;

              return (
                <button
                  key={r.role}
                  type="button"
                  onClick={() => {
                    if (isAdmin) {
                      setSelectedRole(r.role);
                      setError(null);
                    }
                  }}
                  disabled={!isAdmin}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    padding: '0.9rem 1rem',
                    borderRadius: 'var(--radius-md)',
                    background: isCurrentRole
                      ? 'rgba(99,102,241,0.08)'
                      : 'var(--bg-surface-elevated)',
                    border: isCurrentRole
                      ? '1px solid rgba(99,102,241,0.35)'
                      : '1px solid var(--border-subtle)',
                    cursor: isAdmin ? 'pointer' : 'default',
                    textAlign: 'left',
                    transition: 'all 0.15s ease',
                    opacity: isDisabled ? 0.45 : 1,
                  }}
                  onMouseEnter={(e) => {
                    if (isAdmin) {
                      (e.currentTarget as HTMLButtonElement).style.background =
                        'var(--bg-surface-hover)';
                      (e.currentTarget as HTMLButtonElement).style.borderColor =
                        'var(--border-muted)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (isAdmin) {
                      (e.currentTarget as HTMLButtonElement).style.background = isCurrentRole
                        ? 'rgba(99,102,241,0.08)'
                        : 'var(--bg-surface-elevated)';
                      (e.currentTarget as HTMLButtonElement).style.borderColor = isCurrentRole
                        ? 'rgba(99,102,241,0.35)'
                        : 'var(--border-subtle)';
                    }
                  }}
                >
                  {/* Role Icon Circle */}
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 'var(--radius-md)',
                      background: `${r.color}18`,
                      border: `1px solid ${r.color}35`,
                      color: r.color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <ROLE_ICON role={r.role} size={20} />
                  </div>

                  {/* Role Details */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.2rem' }}>
                      <span style={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {r.name}
                      </span>
                      <span
                        style={{
                          fontSize: '0.66rem',
                          fontWeight: 700,
                          color: r.color,
                          background: `${r.color}18`,
                          border: `1px solid ${r.color}30`,
                          borderRadius: 'var(--radius-full)',
                          padding: '0.12rem 0.45rem',
                        }}
                      >
                        {r.badge}
                      </span>

                      {/* Current Role Badge */}
                      {isCurrentRole && (
                        <span
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            fontSize: '0.67rem',
                            fontWeight: 600,
                            color: 'var(--primary)',
                            background: 'rgba(99,102,241,0.15)',
                            border: '1px solid rgba(99,102,241,0.35)',
                            borderRadius: 'var(--radius-full)',
                            padding: '0.12rem 0.45rem',
                            marginLeft: 'auto',
                          }}
                        >
                          <Check size={11} />
                          Current Role
                        </span>
                      )}

                      {/* Unauthorized Lock Badge */}
                      {isDisabled && (
                        <span
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            fontSize: '0.67rem',
                            fontWeight: 600,
                            color: 'var(--text-muted)',
                            background: 'rgba(255,255,255,0.04)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: 'var(--radius-full)',
                            padding: '0.12rem 0.45rem',
                            marginLeft: 'auto',
                          }}
                        >
                          <Lock size={10} />
                          Admin Only
                        </span>
                      )}
                    </div>

                    {/* Dashboard Destination */}
                    <div style={{ fontSize: '0.74rem', color: 'var(--primary)', fontWeight: 500, marginBottom: '0.15rem' }}>
                      {r.dashboardName} <span style={{ opacity: 0.65, fontSize: '0.7rem' }}>({r.dashboardPath})</span>
                    </div>

                    {/* Role Description */}
                    <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                      {r.description}
                    </div>
                  </div>

                  {/* Forward Arrow if Admin */}
                  {isAdmin && (
                    <div style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
                      <ChevronRight size={18} />
                    </div>
                  )}
                </button>
              );
            })}

            {/* Non-Admin Security Notice */}
            {!isAdmin && (
              <div
                style={{
                  marginTop: '0.5rem',
                  padding: '0.75rem 1rem',
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.6rem',
                }}
              >
                <Lock size={16} style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: '0.1rem' }} />
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  Role switching requires administrator privileges. Non-admin users cannot switch into another user's account or elevate their role according to RBAC enforcement.
                </div>
              </div>
            )}
          </div>
        )}

        {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
        {/* STEP 2: AUTHORIZED USER SELECTION WITHIN CHOSEN ROLE                  */}
        {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
        {selectedRole && !pendingUser && activeRoleOption && (
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Target Role Banner */}
            <div
              style={{
                padding: '0.75rem 1.25rem',
                background: 'var(--bg-surface-elevated)',
                borderBottom: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexShrink: 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    color: activeRoleOption.color,
                    background: `${activeRoleOption.color}18`,
                    border: `1px solid ${activeRoleOption.color}30`,
                    borderRadius: 'var(--radius-full)',
                    padding: '0.15rem 0.5rem',
                  }}
                >
                  {activeRoleOption.badge}
                </span>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {activeRoleOption.dashboardName}
                </span>
              </div>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                {activeRoleOption.dashboardPath}
              </span>
            </div>

            {/* Search Bar */}
            <div
              style={{
                padding: '0.65rem 1.25rem',
                borderBottom: '1px solid var(--border-subtle)',
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '0.45rem 0.75rem',
                }}
              >
                <Search size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                <input
                  ref={searchRef}
                  type="text"
                  placeholder={`Search ${activeRoleOption.name}s by name or emailâ€¦`}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    color: 'var(--text-primary)',
                    fontSize: '0.83rem',
                    fontFamily: 'var(--font-sans)',
                  }}
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      padding: 0,
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>

            {/* User List */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem 0.75rem' }}>
              {loading ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    padding: '2.5rem',
                    color: 'var(--text-muted)',
                    fontSize: '0.84rem',
                  }}
                >
                  <Loader2
                    size={18}
                    style={{ animation: 'swrSpin 1s linear infinite', color: 'var(--primary)' }}
                  />
                  Loading active {activeRoleOption.name} accountsâ€¦
                </div>
              ) : filteredUsers.length === 0 ? (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '2.5rem',
                    color: 'var(--text-muted)',
                    fontSize: '0.84rem',
                  }}
                >
                  {search
                    ? `No ${activeRoleOption.name} matches "${search}"`
                    : `No active ${activeRoleOption.name} accounts found.`}
                </div>
              ) : (
                filteredUsers.map((u) => {
                  const isCurrent = u.id === user?.id;
                  const roleColor = ROLE_COLOR_MAP[u.role as SwitchableRole] ?? 'var(--primary)';

                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => {
                        if (!isCurrent) {
                          setPendingUser(u);
                          setError(null);
                        }
                      }}
                      disabled={isCurrent}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        padding: '0.6rem 0.8rem',
                        borderRadius: 'var(--radius-md)',
                        background: isCurrent ? 'var(--primary-subtle)' : 'transparent',
                        border: isCurrent
                          ? '1px solid rgba(99,102,241,0.3)'
                          : '1px solid transparent',
                        cursor: isCurrent ? 'default' : 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.14s ease',
                        marginBottom: '0.2rem',
                        opacity: isCurrent ? 0.75 : 1,
                      }}
                      onMouseEnter={(e) => {
                        if (!isCurrent) {
                          (e.currentTarget as HTMLButtonElement).style.background =
                            'var(--bg-surface-hover)';
                          (e.currentTarget as HTMLButtonElement).style.borderColor =
                            'var(--border-muted)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isCurrent) {
                          (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                          (e.currentTarget as HTMLButtonElement).style.borderColor = 'transparent';
                        }
                      }}
                    >
                      {/* Avatar */}
                      <div
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: '50%',
                          background: isCurrent ? 'var(--primary)' : 'var(--bg-surface-elevated)',
                          border: `2px solid ${isCurrent ? 'var(--primary)' : 'var(--border-subtle)'}`,
                          color: isCurrent ? 'white' : 'var(--text-secondary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          flexShrink: 0,
                        }}
                      >
                        {u.full_name
                          .split(' ')
                          .map((p) => p[0])
                          .join('')
                          .toUpperCase()
                          .slice(0, 2)}
                      </div>

                      {/* Name + email */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: '0.84rem',
                            fontWeight: 600,
                            color: 'var(--text-primary)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                          }}
                        >
                          <span
                            style={{
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              maxWidth: 180,
                            }}
                          >
                            {u.full_name}
                          </span>
                          {isCurrent && (
                            <span
                              style={{
                                fontSize: '0.67rem',
                                color: 'var(--primary)',
                                fontWeight: 500,
                              }}
                            >
                              (current session)
                            </span>
                          )}
                        </div>
                        <div
                          style={{
                            fontSize: '0.72rem',
                            color: 'var(--text-muted)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {u.email}
                        </div>
                      </div>

                      {/* Role badge */}
                      <div
                        style={{
                          fontSize: '0.67rem',
                          fontWeight: 600,
                          color: roleColor,
                          background: `${roleColor}18`,
                          border: `1px solid ${roleColor}28`,
                          borderRadius: 'var(--radius-full)',
                          padding: '0.15rem 0.5rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          whiteSpace: 'nowrap',
                          flexShrink: 0,
                        }}
                      >
                        <ROLE_ICON role={u.role as SwitchableRole} size={13} />
                        {u.role}
                      </div>

                      {/* Action indicator */}
                      <div style={{ flexShrink: 0, display: 'flex', color: 'var(--text-muted)' }}>
                        {isCurrent ? (
                          <Check size={15} style={{ color: 'var(--primary)' }} />
                        ) : (
                          <ChevronRight size={15} />
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div
              style={{
                padding: '0.75rem 1.25rem',
                borderTop: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexShrink: 0,
              }}
            >
              <button
                type="button"
                onClick={() => setSelectedRole(null)}
                className="btn btn-secondary"
                style={{ padding: '0.42rem 0.85rem', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
              >
                <ChevronLeft size={15} />
                Back to Roles
              </button>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                {filteredUsers.length} active {activeRoleOption.name}(s) available
              </div>
            </div>
          </div>
        )}

        {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
        {/* STEP 3: CONFIRMATION PROMPT                                           */}
        {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
        {pendingUser && (
          <div
            style={{
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              overflowY: 'auto',
            }}
          >
            {/* Confirmation Banner with exact required phrasing */}
            <div
              style={{
                padding: '0.9rem 1rem',
                background: 'rgba(99,102,241,0.08)',
                border: '1px solid rgba(99,102,241,0.25)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem',
              }}
            >
              <AlertTriangle
                size={20}
                style={{ color: 'var(--primary)', flexShrink: 0, marginTop: '0.1rem' }}
              />
              <div>
                <div
                  style={{
                    fontSize: '0.88rem',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    lineHeight: 1.4,
                  }}
                >
                  You are about to switch into {pendingUser.full_name} ({pendingUser.role}). Continue?
                </div>
                <div
                  style={{
                    fontSize: '0.74rem',
                    color: 'var(--text-muted)',
                    marginTop: '0.25rem',
                    lineHeight: 1.45,
                  }}
                >
                  Your current admin session will be replaced by an authenticated session for this target user.
                </div>
              </div>
            </div>

            {/* Target User Details Card */}
            <div
              style={{
                background: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
              }}
            >
              <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Target User Information
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    background: ROLE_COLOR_MAP[pendingUser.role as SwitchableRole] ?? 'var(--primary)',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {pendingUser.full_name
                    .split(' ')
                    .map((p) => p[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2)}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {pendingUser.full_name}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    {pendingUser.email}
                  </div>
                </div>

                <div
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    color: ROLE_COLOR_MAP[pendingUser.role as SwitchableRole] ?? 'var(--primary)',
                    background: `${ROLE_COLOR_MAP[pendingUser.role as SwitchableRole] ?? 'var(--primary)'}18`,
                    border: `1px solid ${ROLE_COLOR_MAP[pendingUser.role as SwitchableRole] ?? 'var(--primary)'}30`,
                    borderRadius: 'var(--radius-full)',
                    padding: '0.25rem 0.65rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                  }}
                >
                  <ROLE_ICON role={pendingUser.role as SwitchableRole} />
                  {pendingUser.role}
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '0.5rem',
                  paddingTop: '0.5rem',
                  borderTop: '1px solid var(--border-subtle)',
                  fontSize: '0.76rem',
                }}
              >
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Landing Dashboard: </span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                    {getDashboardPath(pendingUser.role as SwitchableRole)}
                  </span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Account Status: </span>
                  <span style={{ color: 'var(--success)', fontWeight: 500 }}>
                    Active
                  </span>
                </div>
              </div>
            </div>

            {/* Audit Security Notice */}
            <div
              style={{
                fontSize: '0.73rem',
                color: 'var(--text-muted)',
                lineHeight: 1.5,
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                padding: '0.6rem 0.8rem',
              }}
            >
              <strong>Security Notice:</strong> TracePilot will record an immutable audit entry (<code style={{ color: 'var(--primary)' }}>ADMIN_SWITCH_ROLE</code>) documenting your admin ID ({user?.id}), target user ID ({pendingUser.id}), and role ({pendingUser.role}).
            </div>

            {/* Action Buttons */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: '0.65rem',
                marginTop: '0.5rem',
              }}
            >
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setPendingUser(null);
                  setError(null);
                }}
                disabled={switching !== null}
                style={{ padding: '0.45rem 1rem', fontSize: '0.84rem' }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => handleConfirmSwitch(pendingUser)}
                disabled={switching !== null}
                style={{
                  padding: '0.45rem 1.25rem',
                  fontSize: '0.84rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                }}
              >
                {switching !== null ? (
                  <>
                    <Loader2 size={14} style={{ animation: 'swrSpin 1s linear infinite' }} />
                    <span>Switchingâ€¦</span>
                  </>
                ) : (
                  <>
                    <ArrowLeftRight size={14} />
                    <span>Confirm & Switch</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* â”€â”€ Bottom Close Footer (Step 1 only) â”€â”€ */}
        {!selectedRole && !pendingUser && (
          <div
            style={{
              padding: '0.75rem 1.25rem',
              borderTop: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexShrink: 0,
            }}
          >
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              {isAdmin
                ? `${users.length} authorized user accounts active`
                : 'Role switching restricted to administrators'}
            </div>
            <button
              onClick={onClose}
              className="btn btn-secondary"
              style={{ padding: '0.42rem 1rem', fontSize: '0.84rem' }}
            >
              Close
            </button>
          </div>
        )}
      </div>

      {/* Scoped Keyframes */}
      <style>{`
        @keyframes swrFadeIn {
          from { opacity: 0 }
          to   { opacity: 1 }
        }
        @keyframes swrSlideUp {
          from { opacity: 0; transform: translate(-50%, calc(-50% + 14px)) }
          to   { opacity: 1; transform: translate(-50%, -50%) }
        }
        @keyframes swrSpin {
          from { transform: rotate(0deg) }
          to   { transform: rotate(360deg) }
        }
      `}</style>
    </>
  );
};

