import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, Moon, Radio, Sun } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useNotifications } from '../../hooks/useNotifications';
import { useTheme } from '../../context/ThemeContext';
import { NotificationDropdown } from './NotificationDropdown';
import { getRoleLabel } from '../../types/auth';
import { TracePilotLogo } from '../common/TracePilotLogo';

interface HeaderProps {
  onToggleMobile: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onToggleMobile }) => {
  const { user } = useAuth();
  const { wsStatus } = useNotifications();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();

  const getPageTitle = (pathname: string) => {
    if (pathname.startsWith('/dashboard')) return 'Dashboard';
    if (pathname.startsWith('/projects')) return 'Projects';
    if (pathname.startsWith('/issues/')) return 'Issue Details';
    if (pathname.startsWith('/issues')) return 'Issues & Defects';
    if (pathname.startsWith('/notifications')) return 'Notifications';
    if (pathname.startsWith('/analytics')) return 'Analytics & Reporting';
    if (pathname.startsWith('/admin')) return 'Admin Center';
    if (pathname.startsWith('/profile')) return 'My Profile';
    return 'TracePilot';
  };

  const getWsStatusText = () => {
    switch (wsStatus) {
      case 'connected':
        return 'Live';
      case 'connecting':
        return 'Connecting...';
      case 'disconnected':
        return 'Disconnected';
      case 'error':
        return 'Connection Error';
    }
  };

  const getWsIconColor = () => {
    switch (wsStatus) {
      case 'connected':
        return '#10b981';
      case 'connecting':
        return '#f59e0b';
      case 'error':
        return '#ef4444';
      default:
        return 'var(--text-muted)';
    }
  };

  /** Avatar circle color keyed by role */
  const getRoleColor = (role?: string) => {
    switch (role) {
      case 'ADMIN':      return '#f97316';  // orange
      case 'DEVELOPER':  return '#22c55e';  // green
      case 'USER':       return '#6366f1';  // indigo
      default:           return '#6366f1';
    }
  };

  return (
    <header className="header">
      <div className="header-left">
        <button
          onClick={onToggleMobile}
          className="mobile-menu-btn"
          aria-label="Toggle menu"
        >
          <Menu size={22} />
        </button>
        <Link to="/dashboard" className="header-mobile-brand" aria-label="TracePilot Dashboard">
          <div className="brand-logo header-brand-logo">
            <TracePilotLogo size={18} />
          </div>
        </Link>
        <span className="header-title-breadcrumb">
          {getPageTitle(location.pathname)}
        </span>
      </div>

      <div className="header-right">
        {/* WebSocket Connection Status Pill */}
        <div className={`ws-status-pill ${wsStatus}`} title={`Real-time WebSocket Status: ${wsStatus}`}>
          <span className={`status-dot ${wsStatus}`} />
          <Radio size={12} style={{ color: getWsIconColor() }} />
          <span>{getWsStatusText()}</span>
        </div>

        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          className="header-icon-btn theme-toggle-btn"
          title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        {/* Notifications Dropdown */}
        <NotificationDropdown />

        {/* User Pill — clearly indicates active account and active role */}
        {user && (
          <Link
            to="/profile"
            title={`Active Account: ${user.full_name} (${getRoleLabel(user.role)})`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              padding: '0.3rem 0.75rem',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'var(--bg-surface-elevated)',
              border: `1px solid ${getRoleColor(user.role)}40`,
              color: 'var(--text-primary)',
              textDecoration: 'none',
              transition: 'all 0.15s ease',
            }}
          >
            {/* Role-coloured avatar */}
            <span
              style={{
                width: '26px',
                height: '26px',
                borderRadius: '50%',
                backgroundColor: getRoleColor(user.role),
                color: '#fff',
                fontSize: '0.75rem',
                fontWeight: '700',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {user.full_name[0]?.toUpperCase() || 'U'}
            </span>

            {/* Name + Active Role label badge */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: '600', lineHeight: 1.2 }}>
                {user.full_name}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <span
                  style={{
                    fontSize: '0.65rem',
                    color: getRoleColor(user.role),
                    fontWeight: '700',
                    lineHeight: 1,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    backgroundColor: `${getRoleColor(user.role)}18`,
                    padding: '0.1rem 0.35rem',
                    borderRadius: '4px',
                    display: 'inline-block',
                  }}
                >
                  {getRoleLabel(user.role)}
                </span>
              </div>
            </div>
          </Link>
        )}
      </div>
    </header>
  );
};
