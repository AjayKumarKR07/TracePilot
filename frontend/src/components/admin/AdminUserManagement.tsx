import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Edit2,
  PowerOff,
  RefreshCw,
  Search,
  Shield,
  ShieldCheck,
  UserCheck,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import { usersApi } from '../../api/users';
import { getApiErrorMessage } from '../../api/client';
import { Modal } from '../common/Modal';
import { useAuth } from '../../hooks/useAuth';
import type { UserRole } from '../../types/auth';
import type { UserDetail, UserSortField } from '../../types/user';
import { formatDate, formatRelativeTime } from '../../utils/formatters';

interface AdminUserManagementProps {
  onActionSuccess?: (msg: string) => void;
  onActionError?: (msg: string) => void;
  refreshTrigger?: number;
}

export const AdminUserManagement: React.FC<AdminUserManagementProps> = ({
  onActionSuccess,
  onActionError,
  refreshTrigger,
}) => {
  const { user: currentUser } = useAuth();

  // ── User list state ──
  const [users, setUsers] = useState<UserDetail[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | ''>('');
  const [activeFilter, setActiveFilter] = useState<boolean | ''>('');
  const [sortBy, setSortBy] = useState<UserSortField>('created_at');
  const [sortDesc, setSortDesc] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Role change modal state ──
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [selectedUserForRole, setSelectedUserForRole] = useState<UserDetail | null>(null);
  const [targetRole, setTargetRole] = useState<UserRole>('DEVELOPER');
  const [isSubmittingRole, setIsSubmittingRole] = useState(false);
  const [roleModalError, setRoleModalError] = useState<string | null>(null);

  // ── Safe Confirmation dialog state for activate/deactivate ──
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [confirmTargetUser, setConfirmTargetUser] = useState<UserDetail | null>(null);
  const [confirmActionType, setConfirmActionType] = useState<'activate' | 'deactivate'>('deactivate');
  const [isSubmittingConfirm, setIsSubmittingConfirm] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  // Fetch users
  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await usersApi.list({
        page,
        page_size: pageSize,
        search: search.trim() || undefined,
        role: roleFilter || undefined,
        is_active: activeFilter !== '' ? activeFilter : undefined,
        sort_by: sortBy,
        sort_desc: sortDesc,
      });
      setUsers(res.items);
      setTotalUsers(res.total);
      setTotalPages(res.total_pages);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, search, roleFilter, activeFilter, sortBy, sortDesc]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers, refreshTrigger]);

  // ── Role Change Handlers ──
  const openRoleModal = (u: UserDetail) => {
    setSelectedUserForRole(u);
    setTargetRole(u.role);
    setRoleModalError(null);
    setIsRoleModalOpen(true);
  };

  const handleRoleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserForRole) return;
    setIsSubmittingRole(true);
    setRoleModalError(null);
    try {
      await usersApi.changeRole(selectedUserForRole.id, { role: targetRole });
      setIsRoleModalOpen(false);
      onActionSuccess?.(`Role for "${selectedUserForRole.full_name}" successfully updated to ${targetRole}.`);
      fetchUsers();
    } catch (err: unknown) {
      const msg = getApiErrorMessage(err);
      setRoleModalError(msg);
      onActionError?.(msg);
    } finally {
      setIsSubmittingRole(false);
    }
  };

  // ── Confirmation Modal Handlers ──
  const openConfirmModal = (u: UserDetail, action: 'activate' | 'deactivate') => {
    setConfirmTargetUser(u);
    setConfirmActionType(action);
    setConfirmError(null);
    setIsConfirmModalOpen(true);
  };

  const handleConfirmSubmit = async () => {
    if (!confirmTargetUser) return;
    setIsSubmittingConfirm(true);
    setConfirmError(null);
    try {
      if (confirmActionType === 'activate') {
        await usersApi.activate(confirmTargetUser.id);
        onActionSuccess?.(`User account "${confirmTargetUser.full_name}" (${confirmTargetUser.email}) activated successfully.`);
      } else {
        await usersApi.deactivate(confirmTargetUser.id);
        onActionSuccess?.(`User account "${confirmTargetUser.full_name}" (${confirmTargetUser.email}) deactivated.`);
      }
      setIsConfirmModalOpen(false);
      fetchUsers();
    } catch (err: unknown) {
      const msg = getApiErrorMessage(err);
      setConfirmError(msg);
      onActionError?.(msg);
    } finally {
      setIsSubmittingConfirm(false);
    }
  };

  // Avatar helper
  const getInitials = (name?: string) => {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  };

  const getRoleBadgeStyle = (role: UserRole) => {
    switch (role) {
      case 'ADMIN':
        return {
          bg: 'rgba(239, 68, 68, 0.15)',
          color: '#f87171',
          border: '1px solid rgba(239, 68, 68, 0.35)',
        };
      case 'DEVELOPER':
        return {
          bg: 'rgba(168, 85, 247, 0.15)',
          color: '#c084fc',
          border: '1px solid rgba(168, 85, 247, 0.35)',
        };
      case 'USER':
      default:
        return {
          bg: 'rgba(59, 130, 246, 0.15)',
          color: '#60a5fa',
          border: '1px solid rgba(59, 130, 246, 0.35)',
        };
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* ── Search & Filter Controls Card ── */}
      <div
        className="card"
        style={{
          padding: '1.25rem 1.5rem',
          borderRadius: 'var(--radius-lg, 12px)',
          background: 'var(--card-bg, #ffffff)',
          border: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.85rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'rgba(99, 102, 241, 0.12)',
                color: '#6366f1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Users size={18} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                User Management
              </h2>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                {totalUsers} registered account{totalUsers !== 1 ? 's' : ''} in the system
              </span>
            </div>
          </div>

          <button
            onClick={() => fetchUsers()}
            disabled={isLoading}
            className="btn btn-secondary btn-sm"
            style={{ fontSize: '0.82rem', padding: '0.45rem 0.85rem' }}
            title="Reload user list"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            <span>{isLoading ? 'Updating…' : 'Refresh'}</span>
          </button>
        </div>

        {/* Filters row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            flexWrap: 'wrap',
          }}
        >
          {/* Search Input */}
          <div style={{ position: 'relative', flex: '1 1 240px', minWidth: '220px' }}>
            <Search
              size={15}
              style={{
                position: 'absolute',
                left: '0.75rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
              }}
            />
            <input
              type="text"
              placeholder="Search by name or email…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              style={{
                width: '100%',
                padding: '0.5rem 0.85rem 0.5rem 2.2rem',
                fontSize: '0.84rem',
                borderRadius: '8px',
                border: '1px solid var(--border-subtle)',
                background: 'var(--bg-input, #0f172a)',
                color: 'var(--text-primary)',
              }}
            />
            {search && (
              <button
                onClick={() => {
                  setSearch('');
                  setPage(1);
                }}
                style={{
                  position: 'absolute',
                  right: '0.65rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Role Filter Pills */}
          <div
            style={{
              display: 'flex',
              gap: '0.3rem',
              background: 'var(--bg-surface-elevated)',
              padding: '0.25rem',
              borderRadius: '8px',
              border: '1px solid var(--border-subtle)',
              flexWrap: 'wrap',
            }}
          >
            {(
              [
                { id: '', label: 'All Roles' },
                { id: 'ADMIN', label: 'Admins' },
                { id: 'DEVELOPER', label: 'Developers' },
                { id: 'USER', label: 'Users' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setRoleFilter(tab.id as UserRole | '');
                  setPage(1);
                }}
                style={{
                  padding: '0.35rem 0.65rem',
                  fontSize: '0.76rem',
                  fontWeight: roleFilter === tab.id ? 700 : 500,
                  borderRadius: '6px',
                  border: 'none',
                  background: roleFilter === tab.id ? 'var(--primary, #6366f1)' : 'transparent',
                  color: roleFilter === tab.id ? '#ffffff' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Active Status Pills */}
          <div
            style={{
              display: 'flex',
              gap: '0.3rem',
              background: 'var(--bg-surface-elevated)',
              padding: '0.25rem',
              borderRadius: '8px',
              border: '1px solid var(--border-subtle)',
            }}
          >
            {[
              { id: '', label: 'All Status' },
              { id: 'true', label: 'Active', value: true },
              { id: 'false', label: 'Inactive', value: false },
            ].map((tab) => {
              const isSelected =
                tab.id === '' ? activeFilter === '' : activeFilter === tab.value;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveFilter(tab.id === '' ? '' : (tab.value as boolean));
                    setPage(1);
                  }}
                  style={{
                    padding: '0.35rem 0.65rem',
                    fontSize: '0.76rem',
                    fontWeight: isSelected ? 700 : 500,
                    borderRadius: '6px',
                    border: 'none',
                    background: isSelected
                      ? tab.id === 'false'
                        ? '#ef4444'
                        : '#10b981'
                      : 'transparent',
                    color: isSelected ? '#ffffff' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Sort By Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value as UserSortField);
                setPage(1);
              }}
              style={{
                padding: '0.4rem 0.65rem',
                fontSize: '0.78rem',
                borderRadius: '6px',
                border: '1px solid var(--border-subtle)',
                background: 'var(--bg-input, #0f172a)',
                color: 'var(--text-primary)',
              }}
            >
              <option value="created_at">Joined Date</option>
              <option value="full_name">Full Name</option>
              <option value="email">Email</option>
              <option value="role">Role</option>
            </select>
            <button
              onClick={() => setSortDesc((p) => !p)}
              className="btn btn-secondary btn-sm"
              title={sortDesc ? 'Descending order' : 'Ascending order'}
              style={{ padding: '0.4rem 0.6rem', fontSize: '0.78rem' }}
            >
              {sortDesc ? '↓ Desc' : '↑ Asc'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Error Banner ── */}
      {error && (
        <div
          style={{
            padding: '0.85rem 1.25rem',
            borderRadius: '8px',
            backgroundColor: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            color: '#f87171',
            fontSize: '0.86rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
          }}
        >
          <AlertTriangle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* ── User Table Card ── */}
      <div
        className="card"
        style={{
          borderRadius: 'var(--radius-lg, 12px)',
          background: 'var(--card-bg, #ffffff)',
          border: '1px solid var(--border-subtle)',
          overflow: 'hidden',
        }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr
                style={{
                  borderBottom: '1px solid var(--border-subtle)',
                  background: 'var(--bg-surface-elevated)',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  color: 'var(--text-muted)',
                }}
              >
                <th style={{ padding: '0.85rem 1.25rem' }}>User</th>
                <th style={{ padding: '0.85rem 1.25rem' }}>Role</th>
                <th style={{ padding: '0.85rem 1.25rem' }}>Status</th>
                <th style={{ padding: '0.85rem 1.25rem' }}>Verified</th>
                <th style={{ padding: '0.85rem 1.25rem' }}>Joined</th>
                <th style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && users.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '3rem 1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 0.5rem auto' }} />
                    <p style={{ margin: 0, fontSize: '0.88rem' }}>Loading user accounts…</p>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '3rem 1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <Users size={32} style={{ margin: '0 auto 0.75rem auto', opacity: 0.5 }} />
                    <p style={{ margin: 0, fontSize: '0.92rem', fontWeight: 600 }}>No users found matching your filters</p>
                    <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.8rem' }}>
                      Try adjusting your search query, role filter, or status toggles.
                    </p>
                  </td>
                </tr>
              ) : (
                users.map((u) => {
                  const roleStyle = getRoleBadgeStyle(u.role);
                  const isCurrent = u.id === currentUser?.id;

                  return (
                    <tr
                      key={u.id}
                      style={{
                        borderBottom: '1px solid var(--border-subtle)',
                        transition: 'background-color 0.15s ease',
                      }}
                    >
                      {/* User Info */}
                      <td style={{ padding: '0.85rem 1.25rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div
                            style={{
                              width: '36px',
                              height: '36px',
                              borderRadius: '50%',
                              background:
                                u.role === 'ADMIN'
                                  ? 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)'
                                  : u.role === 'DEVELOPER'
                                  ? 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)'
                                  : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                              color: '#ffffff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              fontSize: '0.82rem',
                              flexShrink: 0,
                            }}
                          >
                            {getInitials(u.full_name)}
                          </div>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                              <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                {u.full_name}
                              </span>
                              {isCurrent && (
                                <span
                                  style={{
                                    fontSize: '0.62rem',
                                    fontWeight: 700,
                                    padding: '0.1rem 0.4rem',
                                    borderRadius: '999px',
                                    background: 'rgba(99, 102, 241, 0.15)',
                                    color: '#818cf8',
                                    border: '1px solid rgba(99, 102, 241, 0.3)',
                                  }}
                                >
                                  YOU
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                              {u.email}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Role */}
                      <td style={{ padding: '0.85rem 1.25rem' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            padding: '0.2rem 0.55rem',
                            borderRadius: '6px',
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            letterSpacing: '0.03em',
                            background: roleStyle.bg,
                            color: roleStyle.color,
                            border: roleStyle.border,
                          }}
                        >
                          {u.role === 'ADMIN' ? (
                            <ShieldCheck size={12} />
                          ) : u.role === 'DEVELOPER' ? (
                            <Shield size={12} />
                          ) : (
                            <UserCheck size={12} />
                          )}
                          {u.role}
                        </span>
                      </td>

                      {/* Status */}
                      <td style={{ padding: '0.85rem 1.25rem' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            padding: '0.2rem 0.55rem',
                            borderRadius: '999px',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            background: u.is_active ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                            color: u.is_active ? '#34d399' : '#f87171',
                            border: `1px solid ${u.is_active ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                          }}
                        >
                          <span
                            style={{
                              width: '6px',
                              height: '6px',
                              borderRadius: '50%',
                              backgroundColor: u.is_active ? '#10b981' : '#ef4444',
                            }}
                          />
                          {u.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>

                      {/* Email verified */}
                      <td style={{ padding: '0.85rem 1.25rem' }}>
                        {u.is_email_verified ? (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                              fontSize: '0.74rem',
                              color: '#34d399',
                              fontWeight: 600,
                            }}
                          >
                            <CheckCircle2 size={13} /> Verified
                          </span>
                        ) : (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                              fontSize: '0.74rem',
                              color: 'var(--text-muted)',
                            }}
                          >
                            <XCircle size={13} /> Unverified
                          </span>
                        )}
                      </td>

                      {/* Joined Date */}
                      <td style={{ padding: '0.85rem 1.25rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                        <div title={formatDate(u.created_at)}>{formatRelativeTime(u.created_at)}</div>
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
                          <button
                            onClick={() => openRoleModal(u)}
                            className="btn btn-secondary btn-sm"
                            style={{
                              fontSize: '0.75rem',
                              padding: '0.3rem 0.65rem',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                            }}
                            title="Change User Role"
                          >
                            <Edit2 size={12} />
                            <span>Change Role</span>
                          </button>

                          {u.is_active ? (
                            <button
                              onClick={() => openConfirmModal(u, 'deactivate')}
                              className="btn btn-sm"
                              style={{
                                fontSize: '0.75rem',
                                padding: '0.3rem 0.65rem',
                                backgroundColor: 'rgba(239, 68, 68, 0.12)',
                                color: '#f87171',
                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.35rem',
                                cursor: 'pointer',
                              }}
                              title={isCurrent ? 'Deactivate your own account' : 'Deactivate user'}
                            >
                              <PowerOff size={12} />
                              <span>Deactivate</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => openConfirmModal(u, 'activate')}
                              className="btn btn-sm"
                              style={{
                                fontSize: '0.75rem',
                                padding: '0.3rem 0.65rem',
                                backgroundColor: 'rgba(16, 185, 129, 0.12)',
                                color: '#34d399',
                                border: '1px solid rgba(16, 185, 129, 0.3)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.35rem',
                                cursor: 'pointer',
                              }}
                              title="Activate user account"
                            >
                              <CheckCircle2 size={12} />
                              <span>Activate</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div
            style={{
              padding: '0.85rem 1.25rem',
              borderTop: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.82rem',
              color: 'var(--text-secondary)',
              flexWrap: 'wrap',
              gap: '0.5rem',
            }}
          >
            <span>
              Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, totalUsers)} of {totalUsers} users
            </span>
            <div style={{ display: 'flex', gap: '0.35rem' }}>
              <button
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                disabled={page <= 1}
                className="btn btn-secondary btn-sm"
                style={{ fontSize: '0.78rem', padding: '0.3rem 0.65rem' }}
              >
                Previous
              </button>
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0 0.5rem',
                  fontWeight: 600,
                  fontSize: '0.8rem',
                }}
              >
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                disabled={page >= totalPages}
                className="btn btn-secondary btn-sm"
                style={{ fontSize: '0.78rem', padding: '0.3rem 0.65rem' }}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* Role Change Modal                                                  */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <Modal
        isOpen={isRoleModalOpen}
        onClose={() => setIsRoleModalOpen(false)}
        title="Change User Role"
        maxWidth="460px"
      >
        {selectedUserForRole && (
          <form onSubmit={handleRoleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <p style={{ margin: '0 0 0.85rem 0', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                Update role assignment for <strong>{selectedUserForRole.full_name}</strong> (
                {selectedUserForRole.email}).
              </p>

              {roleModalError && (
                <div
                  style={{
                    padding: '0.75rem',
                    borderRadius: '6px',
                    backgroundColor: 'rgba(239, 68, 68, 0.12)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: '#f87171',
                    fontSize: '0.82rem',
                    marginBottom: '1rem',
                  }}
                >
                  {roleModalError}
                </div>
              )}

              <label
                style={{
                  display: 'block',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  marginBottom: '0.4rem',
                }}
              >
                Select New Role:
              </label>
              <select
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value as UserRole)}
                style={{
                  width: '100%',
                  padding: '0.55rem 0.85rem',
                  fontSize: '0.86rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border-subtle)',
                  background: 'var(--bg-input, #0f172a)',
                  color: 'var(--text-primary)',
                }}
              >
                <option value="USER">USER (Reporter — Report & Track Defects)</option>
                <option value="DEVELOPER">DEVELOPER (Investigate & Resolve Defects)</option>
                <option value="ADMIN">ADMIN (Full Governance & System Management)</option>
              </select>

              <div
                style={{
                  marginTop: '0.85rem',
                  padding: '0.65rem 0.85rem',
                  background: 'rgba(99, 102, 241, 0.08)',
                  borderRadius: '6px',
                  border: '1px solid rgba(99, 102, 241, 0.2)',
                  fontSize: '0.78rem',
                  color: 'var(--text-secondary)',
                  lineHeight: 1.4,
                }}
              >
                <strong>Security note:</strong> Role changes take effect immediately on next API request.
                Last-admin protection prevents removing the final administrator in the system.
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem' }}>
              <button
                type="button"
                onClick={() => setIsRoleModalOpen(false)}
                className="btn btn-secondary"
                disabled={isSubmittingRole}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isSubmittingRole || targetRole === selectedUserForRole.role}
              >
                {isSubmittingRole ? 'Updating…' : 'Save Role'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* Safe Confirmation Dialog (Activate / Deactivate)                    */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <Modal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        title={confirmActionType === 'activate' ? 'Activate User Account' : 'Deactivate User Account'}
        maxWidth="480px"
      >
        {confirmTargetUser && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.85rem' }}>
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '10px',
                  background:
                    confirmActionType === 'deactivate'
                      ? 'rgba(239, 68, 68, 0.15)'
                      : 'rgba(16, 185, 129, 0.15)',
                  color: confirmActionType === 'deactivate' ? '#f87171' : '#34d399',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {confirmActionType === 'deactivate' ? <PowerOff size={22} /> : <CheckCircle2 size={22} />}
              </div>

              <div>
                <h3
                  style={{
                    fontSize: '1rem',
                    fontWeight: 800,
                    margin: '0 0 0.35rem 0',
                    color: 'var(--text-primary)',
                  }}
                >
                  {confirmActionType === 'deactivate'
                    ? `Deactivate ${confirmTargetUser.full_name}?`
                    : `Activate ${confirmTargetUser.full_name}?`}
                </h3>
                <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                  {confirmActionType === 'deactivate'
                    ? `Are you sure you want to deactivate the account for ${confirmTargetUser.email}? They will no longer be able to log in or perform actions until reactivated.`
                    : `Are you sure you want to activate the account for ${confirmTargetUser.email}? They will regain full access according to their ${confirmTargetUser.role} role.`}
                </p>
              </div>
            </div>

            {/* Self-deactivation warning */}
            {confirmActionType === 'deactivate' && confirmTargetUser.id === currentUser?.id && (
              <div
                style={{
                  padding: '0.75rem 0.95rem',
                  borderRadius: '8px',
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  color: '#f87171',
                  fontSize: '0.82rem',
                  lineHeight: 1.4,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <AlertTriangle size={16} style={{ flexShrink: 0 }} />
                <span>
                  <strong>CRITICAL WARNING:</strong> You are deactivating your own account! You will lose access immediately upon confirming.
                </span>
              </div>
            )}

            {/* Last admin warning */}
            {confirmActionType === 'deactivate' && confirmTargetUser.role === 'ADMIN' && (
              <div
                style={{
                  padding: '0.65rem 0.85rem',
                  borderRadius: '6px',
                  background: 'rgba(245, 158, 11, 0.12)',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  color: '#fbbf24',
                  fontSize: '0.8rem',
                }}
              >
                <strong>Admin governance:</strong> TracePilot backend enforces last-admin protection. If this is the only active administrator, the deactivation will be rejected.
              </div>
            )}

            {confirmError && (
              <div
                style={{
                  padding: '0.65rem 0.85rem',
                  borderRadius: '6px',
                  background: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#f87171',
                  fontSize: '0.82rem',
                }}
              >
                {confirmError}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem', marginTop: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setIsConfirmModalOpen(false)}
                className="btn btn-secondary"
                disabled={isSubmittingConfirm}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSubmit}
                disabled={isSubmittingConfirm}
                style={{
                  padding: '0.5rem 1.15rem',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  borderRadius: '8px',
                  border: 'none',
                  cursor: isSubmittingConfirm ? 'not-allowed' : 'pointer',
                  backgroundColor: confirmActionType === 'deactivate' ? '#ef4444' : '#10b981',
                  color: '#ffffff',
                }}
              >
                {isSubmittingConfirm
                  ? 'Processing…'
                  : confirmActionType === 'deactivate'
                  ? 'Yes, Deactivate Account'
                  : 'Yes, Activate Account'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
