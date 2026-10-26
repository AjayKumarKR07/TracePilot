import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  Bell,
  Calendar,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  LogOut,
  Mail,
  MessageSquare,
  Paperclip,
  RefreshCw,
  RotateCcw,
  Save,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  User as UserIcon,
  UserCheck,
  XCircle,
} from 'lucide-react';
import { authApi } from '../api/auth';
import { getApiErrorMessage } from '../api/client';
import { notificationsApi } from '../api/notifications';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { PageHeader } from '../components/common/PageHeader';
import { useAuth } from '../hooks/useAuth';
import type { User as UserType, UserRole } from '../types/auth';
import { getRoleDescription, getRoleLabel } from '../types/auth';
import type { NotificationPreference, NotificationPreferenceUpdate } from '../types/notification';
import { formatDate } from '../utils/formatters';

export const ProfilePage: React.FC = () => {
  const { user, logout, refreshMe } = useAuth();
  const [profile, setProfile] = useState<UserType | null>(user);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Edit Profile Form State
  const [fullName, setFullName] = useState<string>(user?.full_name || '');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState<boolean>(false);
  const [profileSuccessMsg, setProfileSuccessMsg] = useState<string | null>(null);
  const [profileErrorMsg, setProfileErrorMsg] = useState<string | null>(null);

  // Change Password Form State
  const [currentPassword, setCurrentPassword] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showCurrentPass, setShowCurrentPass] = useState<boolean>(false);
  const [showNewPass, setShowNewPass] = useState<boolean>(false);
  const [showConfirmPass, setShowConfirmPass] = useState<boolean>(false);
  const [isChangingPass, setIsChangingPass] = useState<boolean>(false);
  const [passSuccessMsg, setPassSuccessMsg] = useState<string | null>(null);
  const [passErrorMsg, setPassErrorMsg] = useState<string | null>(null);

  // Notification Preferences State (All 7 supported preferences)
  const [notifPrefs, setNotifPrefs] = useState<NotificationPreference | null>(null);
  const [initialPrefs, setInitialPrefs] = useState<NotificationPreference | null>(null);
  const [isUpdatingPrefs, setIsUpdatingPrefs] = useState<boolean>(false);
  const [prefsSuccessMsg, setPrefsSuccessMsg] = useState<string | null>(null);
  const [prefsErrorMsg, setPrefsErrorMsg] = useState<string | null>(null);

  const fetchProfileData = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setError(null);

    try {
      const [profileData, prefsData] = await Promise.all([
        authApi.getMe(),
        notificationsApi.getPreferences().catch(() => null),
      ]);
      setProfile(profileData);
      setFullName(profileData.full_name);
      if (prefsData) {
        setNotifPrefs(prefsData);
        setInitialPrefs(prefsData);
      }
    } catch (err: unknown) {
      setError(getApiErrorMessage(err));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchProfileData(false);
  }, [fetchProfileData]);

  // Handle Edit Profile Save
  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSuccessMsg(null);
    setProfileErrorMsg(null);

    const trimmed = fullName.trim();
    if (!trimmed) {
      setProfileErrorMsg('Full name cannot be empty.');
      return;
    }

    setIsUpdatingProfile(true);
    try {
      const updatedUser = await authApi.updateProfile({ full_name: trimmed });
      setProfile(updatedUser);
      setFullName(updatedUser.full_name);
      await refreshMe();
      setProfileSuccessMsg('Profile updated successfully!');
      setTimeout(() => setProfileSuccessMsg(null), 4000);
    } catch (err: unknown) {
      setProfileErrorMsg(getApiErrorMessage(err));
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  // Handle Change Password Submit
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassSuccessMsg(null);
    setPassErrorMsg(null);

    if (!currentPassword) {
      setPassErrorMsg('Please enter your current password.');
      return;
    }
    if (newPassword.length < 8) {
      setPassErrorMsg('New password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPassErrorMsg('New passwords do not match.');
      return;
    }
    if (newPassword === currentPassword) {
      setPassErrorMsg('New password must be different from current password.');
      return;
    }

    setIsChangingPass(true);
    try {
      const res = await authApi.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
      setPassSuccessMsg(res.message || 'Password changed successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPassSuccessMsg(null), 5000);
    } catch (err: unknown) {
      setPassErrorMsg(getApiErrorMessage(err));
    } finally {
      setIsChangingPass(false);
    }
  };

  // Handle Notification Preferences Toggle
  const handleTogglePref = (key: keyof NotificationPreferenceUpdate) => {
    if (!notifPrefs) return;
    setNotifPrefs((prev) => (prev ? { ...prev, [key]: !prev[key] } : null));
  };

  // Check if any notification preference was changed
  const hasPrefChanges = useMemo(() => {
    if (!notifPrefs || !initialPrefs) return false;
    const keys: (keyof NotificationPreferenceUpdate)[] = [
      'email_enabled',
      'issue_assigned',
      'issue_status_changed',
      'issue_resolved',
      'issue_reopened',
      'issue_commented',
      'attachment_added',
    ];
    return keys.some((k) => notifPrefs[k] !== initialPrefs[k]);
  }, [notifPrefs, initialPrefs]);

  // Handle Notification Preferences Save
  const handleSavePrefs = async () => {
    if (!notifPrefs) return;
    setIsUpdatingPrefs(true);
    setPrefsSuccessMsg(null);
    setPrefsErrorMsg(null);

    try {
      const updated = await notificationsApi.updatePreferences({
        email_enabled: notifPrefs.email_enabled,
        issue_assigned: notifPrefs.issue_assigned,
        issue_status_changed: notifPrefs.issue_status_changed,
        issue_resolved: notifPrefs.issue_resolved,
        issue_reopened: notifPrefs.issue_reopened,
        issue_commented: notifPrefs.issue_commented,
        attachment_added: notifPrefs.attachment_added,
      });
      setNotifPrefs(updated);
      setInitialPrefs(updated);
      setPrefsSuccessMsg('Notification preferences updated successfully!');
      setTimeout(() => setPrefsSuccessMsg(null), 4000);
    } catch (err: unknown) {
      setPrefsErrorMsg(getApiErrorMessage(err));
    } finally {
      setIsUpdatingPrefs(false);
    }
  };

  // User Initials
  const userInitials = useMemo(() => {
    if (!profile?.full_name) return 'U';
    const parts = profile.full_name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }, [profile?.full_name]);

  // Role Badge Class Helper
  const getRoleBadgeClass = (role: UserRole) => {
    switch (role) {
      case 'ADMIN':
        return 'role-badge-admin';
      case 'DEVELOPER':
        return 'role-badge-developer';
      case 'USER':
      default:
        return 'role-badge-user';
    }
  };

  if (isLoading) {
    return <LoadingSpinner message="Loading user profile and security credentials..." />;
  }

  if (error || !profile) {
    return <ErrorMessage message={error || 'Failed to load profile.'} onRetry={() => fetchProfileData(false)} />;
  }

  const roleLabel = getRoleLabel(profile.role);
  const roleDesc = getRoleDescription(profile.role);
  const isNameChanged = fullName.trim() !== profile.full_name && fullName.trim().length > 0;

  // Password validation checklist
  const isPassLengthValid = newPassword.length >= 8;
  const isPassDifferent = newPassword.length > 0 && newPassword !== currentPassword;
  const isPassMatch = newPassword.length > 0 && newPassword === confirmPassword;
  const isPassFormSubmittable =
    currentPassword.length > 0 && isPassLengthValid && isPassDifferent && isPassMatch && !isChangingPass;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '1180px', margin: '0 auto' }}>
      {/* Page Header */}
      <PageHeader
        title="My Profile & Account Settings"
        subtitle="Manage your personal information, security credentials, and real-time defect notifications"
        breadcrumbs={[
          { label: 'Home', href: '/' },
          { label: 'My Profile' },
        ]}
        actions={
          <button
            onClick={() => fetchProfileData(true)}
            disabled={isRefreshing}
            className="btn btn-secondary btn-sm"
            title="Refresh Profile Data"
          >
            <RefreshCw size={14} className={isRefreshing ? 'spin' : ''} />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        }
      />

      {/* Top Identity & Role Privileges Section */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.5rem' }}>
        {/* User Information Card */}
        <div className="card">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <UserIcon size={18} color="var(--primary)" />
              <h3 className="card-title">User Information</h3>
            </div>
            <span className={`badge ${getRoleBadgeClass(profile.role)}`}>
              {profile.role}
            </span>
          </div>

          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Avatar & Header Meta */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.15rem' }}>
              <div
                style={{
                  width: '68px',
                  height: '68px',
                  borderRadius: '50%',
                  background:
                    profile.role === 'ADMIN'
                      ? 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)'
                      : profile.role === 'DEVELOPER'
                      ? 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)'
                      : 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.5rem',
                  fontWeight: '700',
                  color: '#ffffff',
                  boxShadow: 'var(--shadow-md)',
                  flexShrink: 0,
                  border: '2px solid rgba(255, 255, 255, 0.15)',
                }}
              >
                {userInitials}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <h2
                  style={{
                    fontSize: '1.2rem',
                    fontWeight: '700',
                    margin: 0,
                    color: 'var(--text-primary)',
                    letterSpacing: '-0.01em',
                  }}
                >
                  {profile.full_name}
                </h2>
                <span
                  style={{
                    fontSize: '0.85rem',
                    color: 'var(--text-secondary)',
                    marginTop: '0.2rem',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {profile.email}
                </span>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      fontSize: '0.725rem',
                      fontWeight: '600',
                      color: profile.is_active ? 'var(--success)' : 'var(--danger)',
                      backgroundColor: profile.is_active ? 'var(--success-subtle)' : 'var(--danger-subtle)',
                      padding: '0.15rem 0.5rem',
                      borderRadius: 'var(--radius-sm)',
                      border: `1px solid ${profile.is_active ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)'}`,
                    }}
                  >
                    <span
                      style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        backgroundColor: profile.is_active ? 'var(--success)' : 'var(--danger)',
                      }}
                    />
                    {profile.is_active ? 'Active Account' : 'Inactive Account'}
                  </span>

                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      fontSize: '0.725rem',
                      fontWeight: '600',
                      color: profile.is_email_verified ? 'var(--success)' : 'var(--warning)',
                      backgroundColor: profile.is_email_verified ? 'var(--success-subtle)' : 'var(--warning-subtle)',
                      padding: '0.15rem 0.5rem',
                      borderRadius: 'var(--radius-sm)',
                      border: `1px solid ${profile.is_email_verified ? 'rgba(16, 185, 129, 0.25)' : 'rgba(245, 158, 11, 0.25)'}`,
                    }}
                  >
                    {profile.is_email_verified ? <ShieldCheck size={12} /> : <ShieldAlert size={12} />}
                    {profile.is_email_verified ? 'Verified' : 'Unverified'}
                  </span>
                </div>
              </div>
            </div>

            {/* Profile Detail Rows */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
                paddingTop: '1rem',
                borderTop: '1px solid var(--border-subtle)',
                fontSize: '0.85rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <Mail size={15} color="var(--text-muted)" /> Primary Email
                </span>
                <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{profile.email}</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <ShieldCheck size={15} color="var(--text-muted)" /> Identity Security
                </span>
                <span style={{ color: 'var(--text-primary)', fontWeight: '500' }}>
                  OTP & Argon2id Encrypted
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <Calendar size={15} color="var(--text-muted)" /> Member Since
                </span>
                <span style={{ color: 'var(--text-primary)', fontSize: '0.825rem' }}>
                  {formatDate(profile.created_at)}
                </span>
              </div>
            </div>
          </div>

          <div className="card-footer">
            <button
              onClick={() => logout()}
              className="btn btn-outline-danger btn-sm"
              style={{ width: '100%', justifyContent: 'center' }}
            >
              <LogOut size={14} />
              <span>Sign Out from this Device</span>
            </button>
          </div>
        </div>

        {/* Role Privileges & Access Card */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div className="card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Shield size={18} color="var(--primary)" />
                <h3 className="card-title">Role Privileges & Access</h3>
              </div>
              <span className="badge" style={{ backgroundColor: 'var(--primary-subtle)', color: 'var(--primary)' }}>
                RBAC Level
              </span>
            </div>

            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div
                style={{
                  padding: '0.85rem 1rem',
                  backgroundColor: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: '700', color: 'var(--text-primary)', fontSize: '0.925rem' }}>
                    {roleLabel}
                  </span>
                  <span className={`badge ${getRoleBadgeClass(profile.role)}`}>
                    {profile.role}
                  </span>
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0.4rem 0 0 0', lineHeight: 1.5 }}>
                  {roleDesc}
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.775rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Authorized System Capabilities
                </span>

                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                  {profile.role === 'ADMIN' && (
                    <>
                      <li style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
                        <Check size={15} color="var(--success)" style={{ marginTop: '0.15rem', flexShrink: 0 }} />
                        <span>Full system administration, user accounts, and role assignment governance.</span>
                      </li>
                      <li style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
                        <Check size={15} color="var(--success)" style={{ marginTop: '0.15rem', flexShrink: 0 }} />
                        <span>Assign and reassign defects to developers and balance team workloads.</span>
                      </li>
                      <li style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
                        <Check size={15} color="var(--success)" style={{ marginTop: '0.15rem', flexShrink: 0 }} />
                        <span>Sprint management, approval workflows, and release milestone oversight.</span>
                      </li>
                      <li style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
                        <Check size={15} color="var(--success)" style={{ marginTop: '0.15rem', flexShrink: 0 }} />
                        <span>Comprehensive analytics dashboards, audit trail monitoring, and health metrics.</span>
                      </li>
                    </>
                  )}

                  {profile.role === 'DEVELOPER' && (
                    <>
                      <li style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
                        <Check size={15} color="var(--success)" style={{ marginTop: '0.15rem', flexShrink: 0 }} />
                        <span>Investigate and resolve defects assigned across active projects.</span>
                      </li>
                      <li style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
                        <Check size={15} color="var(--success)" style={{ marginTop: '0.15rem', flexShrink: 0 }} />
                        <span>Advance defect workflow (In Development, In Review, In Testing).</span>
                      </li>
                      <li style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
                        <Check size={15} color="var(--success)" style={{ marginTop: '0.15rem', flexShrink: 0 }} />
                        <span>Submit technical resolution notes and fix evidence for reporter verification.</span>
                      </li>
                      <li style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
                        <Check size={15} color="var(--success)" style={{ marginTop: '0.15rem', flexShrink: 0 }} />
                        <span>Collaborate on defect comment threads and attach diagnostic artifacts.</span>
                      </li>
                    </>
                  )}

                  {profile.role === 'USER' && (
                    <>
                      <li style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
                        <Check size={15} color="var(--success)" style={{ marginTop: '0.15rem', flexShrink: 0 }} />
                        <span>Report defects with reproduction steps, environment details, and logs.</span>
                      </li>
                      <li style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
                        <Check size={15} color="var(--success)" style={{ marginTop: '0.15rem', flexShrink: 0 }} />
                        <span>Track real-time defect investigation status from assigned developers.</span>
                      </li>
                      <li style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
                        <Check size={15} color="var(--success)" style={{ marginTop: '0.15rem', flexShrink: 0 }} />
                        <span>Review developer resolutions and 1-click confirm resolution as Closed.</span>
                      </li>
                      <li style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
                        <Check size={15} color="var(--success)" style={{ marginTop: '0.15rem', flexShrink: 0 }} />
                        <span>Reopen defects with detailed feedback if issues persist in production.</span>
                      </li>
                    </>
                  )}
                </ul>
              </div>
            </div>
          </div>

          <div className="card-footer" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Lock size={13} />
            <span>Role permissions are strictly enforced server-side via PostgreSQL RBAC.</span>
          </div>
        </div>
      </div>

      {/* Middle Edit Profile & Password Management Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.5rem' }}>
        {/* 1. Edit Profile Information */}
        <div className="card">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Sliders size={18} color="var(--primary)" />
              <h3 className="card-title">Edit Profile Information</h3>
            </div>
          </div>

          <form onSubmit={handleProfileSubmit}>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {profileSuccessMsg && (
                <div className="alert-box alert-success" role="alert">
                  <CheckCircle2 size={16} style={{ flexShrink: 0, marginTop: '0.1rem' }} />
                  <span>{profileSuccessMsg}</span>
                </div>
              )}

              {profileErrorMsg && (
                <div className="alert-box alert-danger" role="alert">
                  <XCircle size={16} style={{ flexShrink: 0, marginTop: '0.1rem' }} />
                  <span>{profileErrorMsg}</span>
                </div>
              )}

              <div className="form-group">
                <label className="form-label" htmlFor="profile-full-name">
                  Full Name <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <input
                  id="profile-full-name"
                  type="text"
                  required
                  className="form-input"
                  placeholder="e.g. Vinay Kumar"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
                <span className="form-help">Enter your display name as it should appear across TracePilot.</span>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="profile-email-readonly">
                  Email Address (Identity)
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="profile-email-readonly"
                    type="email"
                    disabled
                    className="form-input"
                    value={profile.email}
                    style={{
                      opacity: 0.7,
                      cursor: 'not-allowed',
                      backgroundColor: 'var(--bg-surface-elevated)',
                      paddingRight: '2.5rem',
                    }}
                  />
                  <Lock
                    size={15}
                    style={{
                      position: 'absolute',
                      right: '0.75rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--text-muted)',
                      pointerEvents: 'none',
                    }}
                  />
                </div>
                <span className="form-help">
                  Email is locked to account authentication and OTP verification.
                </span>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="profile-role-readonly">
                  Assigned System Role
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="profile-role-readonly"
                    type="text"
                    disabled
                    className="form-input"
                    value={roleLabel}
                    style={{
                      opacity: 0.7,
                      cursor: 'not-allowed',
                      backgroundColor: 'var(--bg-surface-elevated)',
                      paddingRight: '2.5rem',
                    }}
                  />
                  <Shield
                    size={15}
                    style={{
                      position: 'absolute',
                      right: '0.75rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--text-muted)',
                      pointerEvents: 'none',
                    }}
                  />
                </div>
                <span className="form-help">System role permissions can only be altered by an Administrator.</span>
              </div>
            </div>

            <div className="card-footer" style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="submit"
                disabled={isUpdatingProfile || !isNameChanged}
                className="btn btn-primary"
              >
                <Save size={15} />
                <span>{isUpdatingProfile ? 'Saving Changes...' : 'Save Profile'}</span>
              </button>
            </div>
          </form>
        </div>

        {/* 2. Change Password */}
        <div className="card">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <KeyRound size={18} color="var(--primary)" />
              <h3 className="card-title">Change Password</h3>
            </div>
          </div>

          <form onSubmit={handlePasswordSubmit}>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {passSuccessMsg && (
                <div className="alert-box alert-success" role="alert">
                  <CheckCircle2 size={16} style={{ flexShrink: 0, marginTop: '0.1rem' }} />
                  <span>{passSuccessMsg}</span>
                </div>
              )}

              {passErrorMsg && (
                <div className="alert-box alert-danger" role="alert">
                  <XCircle size={16} style={{ flexShrink: 0, marginTop: '0.1rem' }} />
                  <span>{passErrorMsg}</span>
                </div>
              )}

              <div className="form-group">
                <label className="form-label" htmlFor="current-pass">
                  Current Password <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="current-pass"
                    type={showCurrentPass ? 'text' : 'password'}
                    required
                    className="form-input"
                    placeholder="Enter your current password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    style={{ paddingRight: '2.5rem' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPass(!showCurrentPass)}
                    style={{
                      position: 'absolute',
                      right: '0.75rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                    }}
                    aria-label={showCurrentPass ? 'Hide password' : 'Show password'}
                  >
                    {showCurrentPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="new-pass">
                  New Password <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="new-pass"
                    type={showNewPass ? 'text' : 'password'}
                    required
                    minLength={8}
                    className="form-input"
                    placeholder="Minimum 8 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    style={{ paddingRight: '2.5rem' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPass(!showNewPass)}
                    style={{
                      position: 'absolute',
                      right: '0.75rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                    }}
                    aria-label={showNewPass ? 'Hide password' : 'Show password'}
                  >
                    {showNewPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="confirm-pass">
                  Confirm New Password <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="confirm-pass"
                    type={showConfirmPass ? 'text' : 'password'}
                    required
                    minLength={8}
                    className="form-input"
                    placeholder="Re-enter new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    style={{ paddingRight: '2.5rem' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPass(!showConfirmPass)}
                    style={{
                      position: 'absolute',
                      right: '0.75rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                    }}
                    aria-label={showConfirmPass ? 'Hide password' : 'Show password'}
                  >
                    {showConfirmPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Password Quality Requirements Checklist */}
              {newPassword.length > 0 && (
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '0.5rem',
                    padding: '0.5rem 0.75rem',
                    backgroundColor: 'var(--bg-surface-elevated)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.75rem',
                  }}
                >
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      color: isPassLengthValid ? 'var(--success)' : 'var(--text-muted)',
                      fontWeight: isPassLengthValid ? 600 : 400,
                    }}
                  >
                    {isPassLengthValid ? <Check size={13} /> : <AlertCircle size={13} />}
                    8+ characters
                  </span>

                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      color: isPassDifferent ? 'var(--success)' : 'var(--text-muted)',
                      fontWeight: isPassDifferent ? 600 : 400,
                    }}
                  >
                    {isPassDifferent ? <Check size={13} /> : <AlertCircle size={13} />}
                    Differs from current
                  </span>

                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      color: isPassMatch ? 'var(--success)' : 'var(--text-muted)',
                      fontWeight: isPassMatch ? 600 : 400,
                    }}
                  >
                    {isPassMatch ? <Check size={13} /> : <AlertCircle size={13} />}
                    Passwords match
                  </span>
                </div>
              )}
            </div>

            <div className="card-footer" style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="submit"
                disabled={!isPassFormSubmittable}
                className="btn btn-primary"
              >
                <Lock size={15} />
                <span>{isChangingPass ? 'Updating Password...' : 'Update Password'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Bottom Notification & Alert Preferences Section */}
      {notifPrefs && (
        <div className="card">
          <div className="card-header" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Bell size={18} color="var(--primary)" />
              <h3 className="card-title">Notification & Alert Preferences</h3>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              {hasPrefChanges && (
                <span
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--warning)',
                    backgroundColor: 'var(--warning-subtle)',
                    padding: '0.2rem 0.6rem',
                    borderRadius: 'var(--radius-sm)',
                    fontWeight: '600',
                  }}
                >
                  Unsaved changes
                </span>
              )}

              {prefsSuccessMsg && (
                <span style={{ fontSize: '0.8rem', color: 'var(--success)', fontWeight: '600' }}>
                  ✓ {prefsSuccessMsg}
                </span>
              )}
            </div>
          </div>

          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
              Customize your real-time notification alerts and email digests across all 7 supported defect tracking events.
            </p>

            {prefsErrorMsg && (
              <div className="alert-box alert-danger" role="alert">
                <XCircle size={16} style={{ flexShrink: 0, marginTop: '0.1rem' }} />
                <span>{prefsErrorMsg}</span>
              </div>
            )}

            {/* Responsive Grid with all 7 Preferences as Custom Toggle Switches */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                gap: '0.85rem',
              }}
            >
              {/* 1. Email Enabled */}
              <div
                className={`pref-card ${notifPrefs.email_enabled ? 'active' : ''}`}
                onClick={() => handleTogglePref('email_enabled')}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === ' ' || e.key === 'Enter') {
                    e.preventDefault();
                    handleTogglePref('email_enabled');
                  }
                }}
              >
                <div style={{ display: 'flex', gap: '0.75rem', minWidth: 0 }}>
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: notifPrefs.email_enabled ? 'var(--primary-subtle)' : 'var(--bg-surface)',
                      color: notifPrefs.email_enabled ? 'var(--primary)' : 'var(--text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Mail size={18} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                      Email Notifications
                    </span>
                    <span style={{ fontSize: '0.775rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                      Receive email digests and alerts for high-priority defect updates
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  role="switch"
                  aria-checked={notifPrefs.email_enabled}
                  aria-label="Toggle Email Notifications"
                  className={`toggle-switch ${notifPrefs.email_enabled ? 'active' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleTogglePref('email_enabled');
                  }}
                >
                  <span className="toggle-thumb" />
                </button>
              </div>

              {/* 2. Issue Assigned */}
              <div
                className={`pref-card ${notifPrefs.issue_assigned ? 'active' : ''}`}
                onClick={() => handleTogglePref('issue_assigned')}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === ' ' || e.key === 'Enter') {
                    e.preventDefault();
                    handleTogglePref('issue_assigned');
                  }
                }}
              >
                <div style={{ display: 'flex', gap: '0.75rem', minWidth: 0 }}>
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: notifPrefs.issue_assigned ? 'var(--primary-subtle)' : 'var(--bg-surface)',
                      color: notifPrefs.issue_assigned ? 'var(--primary)' : 'var(--text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <UserCheck size={18} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                      Issue Assigned
                    </span>
                    <span style={{ fontSize: '0.775rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                      Alert when a defect is assigned or reassigned to you
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  role="switch"
                  aria-checked={notifPrefs.issue_assigned}
                  aria-label="Toggle Issue Assigned Alerts"
                  className={`toggle-switch ${notifPrefs.issue_assigned ? 'active' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleTogglePref('issue_assigned');
                  }}
                >
                  <span className="toggle-thumb" />
                </button>
              </div>

              {/* 3. Status Transitions */}
              <div
                className={`pref-card ${notifPrefs.issue_status_changed ? 'active' : ''}`}
                onClick={() => handleTogglePref('issue_status_changed')}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === ' ' || e.key === 'Enter') {
                    e.preventDefault();
                    handleTogglePref('issue_status_changed');
                  }
                }}
              >
                <div style={{ display: 'flex', gap: '0.75rem', minWidth: 0 }}>
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: notifPrefs.issue_status_changed ? 'var(--primary-subtle)' : 'var(--bg-surface)',
                      color: notifPrefs.issue_status_changed ? 'var(--primary)' : 'var(--text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Activity size={18} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                      Status Transitions
                    </span>
                    <span style={{ fontSize: '0.775rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                      Alert when defect advances in investigation stages
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  role="switch"
                  aria-checked={notifPrefs.issue_status_changed}
                  aria-label="Toggle Status Transition Alerts"
                  className={`toggle-switch ${notifPrefs.issue_status_changed ? 'active' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleTogglePref('issue_status_changed');
                  }}
                >
                  <span className="toggle-thumb" />
                </button>
              </div>

              {/* 4. Issue Resolved */}
              <div
                className={`pref-card ${notifPrefs.issue_resolved ? 'active' : ''}`}
                onClick={() => handleTogglePref('issue_resolved')}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === ' ' || e.key === 'Enter') {
                    e.preventDefault();
                    handleTogglePref('issue_resolved');
                  }
                }}
              >
                <div style={{ display: 'flex', gap: '0.75rem', minWidth: 0 }}>
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: notifPrefs.issue_resolved ? 'var(--success-subtle)' : 'var(--bg-surface)',
                      color: notifPrefs.issue_resolved ? 'var(--success)' : 'var(--text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <CheckCircle2 size={18} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                      Issue Resolved
                    </span>
                    <span style={{ fontSize: '0.775rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                      Immediate alert when developer marks issue resolved for verification
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  role="switch"
                  aria-checked={notifPrefs.issue_resolved}
                  aria-label="Toggle Issue Resolved Alerts"
                  className={`toggle-switch ${notifPrefs.issue_resolved ? 'active' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleTogglePref('issue_resolved');
                  }}
                >
                  <span className="toggle-thumb" />
                </button>
              </div>

              {/* 5. Issue Reopened */}
              <div
                className={`pref-card ${notifPrefs.issue_reopened ? 'active' : ''}`}
                onClick={() => handleTogglePref('issue_reopened')}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === ' ' || e.key === 'Enter') {
                    e.preventDefault();
                    handleTogglePref('issue_reopened');
                  }
                }}
              >
                <div style={{ display: 'flex', gap: '0.75rem', minWidth: 0 }}>
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: notifPrefs.issue_reopened ? 'var(--danger-subtle)' : 'var(--bg-surface)',
                      color: notifPrefs.issue_reopened ? 'var(--danger)' : 'var(--text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <RotateCcw size={18} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                      Issue Reopened
                    </span>
                    <span style={{ fontSize: '0.775rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                      Alert when a resolved defect is reopened for further rework
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  role="switch"
                  aria-checked={notifPrefs.issue_reopened}
                  aria-label="Toggle Issue Reopened Alerts"
                  className={`toggle-switch ${notifPrefs.issue_reopened ? 'active' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleTogglePref('issue_reopened');
                  }}
                >
                  <span className="toggle-thumb" />
                </button>
              </div>

              {/* 6. Issue Commented */}
              <div
                className={`pref-card ${notifPrefs.issue_commented ? 'active' : ''}`}
                onClick={() => handleTogglePref('issue_commented')}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === ' ' || e.key === 'Enter') {
                    e.preventDefault();
                    handleTogglePref('issue_commented');
                  }
                }}
              >
                <div style={{ display: 'flex', gap: '0.75rem', minWidth: 0 }}>
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: notifPrefs.issue_commented ? 'var(--primary-subtle)' : 'var(--bg-surface)',
                      color: notifPrefs.issue_commented ? 'var(--primary)' : 'var(--text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <MessageSquare size={18} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                      Comments & Notes
                    </span>
                    <span style={{ fontSize: '0.775rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                      Alert when team members post notes, comments, or resolution logs
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  role="switch"
                  aria-checked={notifPrefs.issue_commented}
                  aria-label="Toggle Issue Comments Alerts"
                  className={`toggle-switch ${notifPrefs.issue_commented ? 'active' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleTogglePref('issue_commented');
                  }}
                >
                  <span className="toggle-thumb" />
                </button>
              </div>

              {/* 7. Attachment Added */}
              <div
                className={`pref-card ${notifPrefs.attachment_added ? 'active' : ''}`}
                onClick={() => handleTogglePref('attachment_added')}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === ' ' || e.key === 'Enter') {
                    e.preventDefault();
                    handleTogglePref('attachment_added');
                  }
                }}
              >
                <div style={{ display: 'flex', gap: '0.75rem', minWidth: 0 }}>
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: notifPrefs.attachment_added ? 'var(--primary-subtle)' : 'var(--bg-surface)',
                      color: notifPrefs.attachment_added ? 'var(--primary)' : 'var(--text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Paperclip size={18} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                      File Attachments
                    </span>
                    <span style={{ fontSize: '0.775rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                      Alert when screenshots, logs, or reproduction files are attached
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  role="switch"
                  aria-checked={notifPrefs.attachment_added}
                  aria-label="Toggle File Attachment Alerts"
                  className={`toggle-switch ${notifPrefs.attachment_added ? 'active' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleTogglePref('attachment_added');
                  }}
                >
                  <span className="toggle-thumb" />
                </button>
              </div>
            </div>
          </div>

          <div className="card-footer" style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.75rem' }}>
            <button
              onClick={handleSavePrefs}
              disabled={isUpdatingPrefs || !hasPrefChanges}
              className="btn btn-primary"
            >
              <Save size={15} />
              <span>{isUpdatingPrefs ? 'Saving Preferences...' : 'Save Notification Preferences'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfilePage;
