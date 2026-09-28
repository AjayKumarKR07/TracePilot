import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { CheckCircle, Mail, ShieldCheck, ArrowRight, RotateCw, ArrowLeft } from 'lucide-react';
import { getApiErrorMessage } from '../../api/client';
import { useAuth } from '../../hooks/useAuth';
import type { User, UserRole } from '../../types/auth';
import { storage } from '../../utils/storage';

function getRoleRedirect(role: UserRole, requestedFrom: string): string {
  if (requestedFrom && requestedFrom !== '/' && requestedFrom !== '/login' && requestedFrom !== '/register') {
    return requestedFrom;
  }
  if (role === 'ADMIN') return '/admin';
  return '/dashboard';
}

export const VerifyOtpPage: React.FC = () => {
  const { verifyOtp, resendOtp } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const stateData = location.state as { email?: string; from?: string } | undefined;
  const stateEmail = stateData?.email || '';
  const from = stateData?.from && stateData.from !== '/' ? stateData.from : '/dashboard';

  const [email, setEmail] = useState<string>(stateEmail);
  const [otp, setOtp] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isResending, setIsResending] = useState<boolean>(false);
  const [cooldown, setCooldown] = useState<number>(60);

  useEffect(() => {
    let timer: number;
    if (cooldown > 0) {
      timer = window.setInterval(() => {
        setCooldown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !otp.trim()) {
      setError('Please provide both your email and 6-digit verification code.');
      return;
    }
    if (!/^\d{6}$/.test(otp.trim())) {
      setError('Verification code must be exactly 6 digits.');
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      await verifyOtp({ email: email.trim(), otp: otp.trim() });
      setSuccessMsg('Verification successful! Entering workspace...');
      // Determine redirect based on the authenticated role
      const freshUser: User | null = storage.getUser<User>();
      const role: UserRole = freshUser?.role ?? 'DEVELOPER';
      const redirect = getRoleRedirect(role, from);
      setTimeout(() => {
        navigate(redirect, { replace: true });
      }, 400);
    } catch (err: unknown) {
      const errMsg = getApiErrorMessage(err);
      setError(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (!email.trim()) {
      setError('Please enter your email to receive a new code.');
      return;
    }
    if (cooldown > 0) return;

    setError(null);
    setIsResending(true);
    try {
      const msg = await resendOtp(email.trim());
      setSuccessMsg(msg || 'A new 6-digit verification code has been sent to your email.');
      setCooldown(60);
    } catch (err: unknown) {
      const errMsg = getApiErrorMessage(err);
      setError(errMsg);
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="auth-page-wrapper">
      <div className="auth-card">
        <div className="auth-header">
          <div className="brand-logo auth-logo-center">
            <ShieldCheck size={24} />
          </div>
          <h1 className="auth-title">Enter Verification Code</h1>
          <p className="auth-subtitle">
            {email ? (
              <>
                We sent a 6-digit code to <strong>{email}</strong>
              </>
            ) : (
              'Enter the 6-digit code sent to your email address'
            )}
          </p>
        </div>

        {error && (
          <div className="alert-box alert-danger">
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="alert-box alert-success">
            <CheckCircle size={18} />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleVerify}>
          {!stateEmail && (
            <div className="form-group">
              <label className="form-label" htmlFor="verify-email">
                Email Address
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="verify-email"
                  type="email"
                  required
                  className="form-input"
                  style={{ paddingLeft: '2.5rem' }}
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isSubmitting}
                  autoComplete="email"
                />
                <Mail
                  size={16}
                  style={{
                    position: 'absolute',
                    left: '0.85rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-muted)',
                  }}
                />
              </div>
            </div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="verify-otp">
              6-Digit OTP Code
            </label>
            <input
              id="verify-otp"
              type="text"
              required
              maxLength={6}
              className="form-input"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '1.5rem',
                letterSpacing: '0.4em',
                textAlign: 'center',
                fontWeight: '700',
              }}
              placeholder="000000"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
              disabled={isSubmitting}
              autoComplete="one-time-code"
              autoFocus
            />
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '1.25rem',
            }}
          >
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Didn't receive code?
            </span>
            <button
              type="button"
              onClick={handleResend}
              disabled={isResending || cooldown > 0}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.75rem' }}
            >
              <RotateCw size={12} className={isResending ? 'spin' : ''} />
              {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend Code'}
            </button>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || otp.length !== 6}
            className="btn btn-primary"
            style={{ width: '100%', padding: '0.75rem' }}
          >
            {isSubmitting ? 'Verifying...' : 'Verify & Enter Workspace'}
            {!isSubmitting && <ArrowRight size={16} />}
          </button>
        </form>

        <div
          style={{
            marginTop: '1.75rem',
            paddingTop: '1.25rem',
            borderTop: '1px solid var(--border-subtle)',
            textAlign: 'center',
            fontSize: '0.875rem',
            color: 'var(--text-secondary)',
          }}
        >
          <Link
            to="/login"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              fontWeight: '500',
              color: 'var(--primary)',
            }}
          >
            <ArrowLeft size={14} />
            <span>Use a different email address</span>
          </Link>
        </div>
      </div>
    </div>
  );
};

