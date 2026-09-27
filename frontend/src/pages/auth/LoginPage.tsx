import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  Shield,
  ShieldCheck,
  TestTube2,
  User as UserIcon,
} from 'lucide-react';
import { getApiErrorMessage } from '../../api/client';
import { useAuth } from '../../hooks/useAuth';
import type { User, UserRole } from '../../types/auth';
import { storage } from '../../utils/storage';
import { TracePilotLogo } from '../../components/common/TracePilotLogo';


/**
 * Determines post-login redirect path based on user role.
 * ADMIN → /admin (their primary workspace)
 * TESTER / DEVELOPER → /dashboard
 * If the user had tried to access a specific page (from), honour it.
 */
function getRoleRedirect(role: UserRole, requestedFrom: string): string {
  if (requestedFrom && requestedFrom !== '/' && requestedFrom !== '/login' && requestedFrom !== '/register') {
    return requestedFrom;
  }
  if (role === 'ADMIN') return '/admin-dashboard';
  if (role === 'TESTER') return '/tester-dashboard';
  return '/dashboard';
}

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const rawFrom = (location.state as { from?: { pathname: string } })?.from?.pathname ?? '';
  const from = rawFrom !== '/' ? rawFrom : '';


  // Password login fields
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);


  // Shared state
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      // login() internally calls /auth/login and stores the user+token
      await login({ email: email.trim(), password });
      // Read the freshly stored user to determine role-based redirect
      const freshUser: User | null = storage.getUser<User>();
      const role: UserRole = freshUser?.role ?? 'TESTER';
      navigate(getRoleRedirect(role, from), { replace: true });
    } catch (err: unknown) {
      setError(getApiErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };


  return (
    <div className="auth-page-wrapper">
      <div className="auth-card" style={{ maxWidth: '440px' }}>
        {/* Header */}
        <div className="auth-header">
          <div className="brand-logo auth-logo-center">
            <TracePilotLogo size={28} />
          </div>
          <h1 className="auth-title">TracePilot</h1>
          <p className="auth-subtitle">
            Software Issue Tracking & Resolution Platform
          </p>
        </div>

        {/* Available Workspaces Info */}
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '10px',
          padding: '1rem',
          marginBottom: '1.5rem',
          fontSize: '0.8rem',
        }}>
          <p style={{ fontWeight: '600', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
            Available Workspaces
          </p>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '0.8rem', fontSize: '0.75rem' }}>
            Different users receive different workspaces after authentication. Your role is determined automatically.
          </p>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <li style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
              <UserIcon size={14} style={{ color: '#6366f1', flexShrink: 0, marginTop: '0.15rem' }} />
              <div>
                <strong style={{ color: 'var(--text-primary)' }}>USER</strong>
                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.75rem' }}>Report and track software issues.</p>
              </div>
            </li>
            <li style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
              <TestTube2 size={14} style={{ color: '#22c55e', flexShrink: 0, marginTop: '0.15rem' }} />
              <div>
                <strong style={{ color: 'var(--text-primary)' }}>TESTER</strong>
                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.75rem' }}>Investigate, test, and resolve assigned issues.</p>
              </div>
            </li>
            <li style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
              <ShieldCheck size={14} style={{ color: '#f97316', flexShrink: 0, marginTop: '0.15rem' }} />
              <div>
                <strong style={{ color: 'var(--text-primary)' }}>ADMIN</strong>
                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.75rem' }}>Manage users, projects, issues, workflows, and system activity.</p>
              </div>
            </li>
          </ul>
        </div>

        {/* Auth Tabs Toggle */}
        <div
          style={{
            display: 'flex',
            background: 'var(--bg-surface)',
            borderRadius: '10px',
            padding: '4px',
            marginBottom: '1.5rem',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <button
            type="button"
            style={{
              flex: 1,
              padding: '0.5rem 0.75rem',
              borderRadius: '7px',
              border: 'none',
              cursor: 'default',
              fontWeight: '600',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem',
              background: 'var(--primary)',
              color: '#fff',
            }}
          >
            <Lock size={14} />
            Login
          </button>
          <button
            type="button"
            onClick={() => navigate('/register')}
            style={{
              flex: 1,
              padding: '0.5rem 0.75rem',
              borderRadius: '7px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem',
              transition: 'all 0.2s',
              background: 'transparent',
              color: 'var(--text-secondary)',
            }}
          >
            Create Account
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="alert-box alert-danger">
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {/* ── PASSWORD LOGIN FORM ── */}
        <form onSubmit={handlePasswordLogin}>
          <div className="form-group">
            <label className="form-label" htmlFor="login-email">
              Email Address
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="login-email"
                type="email"
                required
                className="form-input"
                style={{ paddingLeft: '2.5rem' }}
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isSubmitting}
                autoComplete="email"
                autoFocus
              />
              <Mail
                size={16}
                style={{
                  position: 'absolute',
                  left: '0.85rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                  pointerEvents: 'none',
                }}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="login-password">
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  className="form-input"
                  style={{ paddingLeft: '2.5rem', paddingRight: '2.5rem' }}
                  placeholder="Your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isSubmitting}
                  autoComplete="current-password"
                />
                <KeyRound
                  size={16}
                  style={{
                    position: 'absolute',
                    left: '0.85rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-muted)',
                    pointerEvents: 'none',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  style={{
                    position: 'absolute',
                    right: '0.85rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-muted)',
                    padding: 0,
                    display: 'flex',
                  }}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !email.trim() || !password}
              className="btn btn-primary"
              style={{ width: '100%', marginTop: '0.5rem', padding: '0.75rem' }}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="spin" />
                  Signing in...
                </>
              ) : (
                <>
                  Sign In
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>


        {/* Footer links */}
        <div
          style={{
            marginTop: '1.5rem',
            paddingTop: '1.25rem',
            borderTop: '1px solid var(--border-subtle)',
            textAlign: 'center',
            fontSize: '0.875rem',
            color: 'var(--text-secondary)',
          }}
        >
          Don't have an account?{' '}
          <Link to="/register" style={{ fontWeight: '600', color: 'var(--primary)' }}>
            Create Account
          </Link>
        </div>

        <div
          style={{
            marginTop: '0.75rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.4rem',
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
          }}
        >
          <Shield size={12} />
          <span>Secure authentication · TracePilot</span>
        </div>
      </div>
    </div>
  );
};
