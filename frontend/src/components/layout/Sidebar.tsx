import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  ArrowLeftRight,
  BarChart3,
  Bug,
  ClipboardCheck,
  FolderGit2,
  LayoutDashboard,
  LogOut,
  Bell,
  ShieldCheck,
  Timer,
  User,
} from 'lucide-react';


import { useAuth } from '../../hooks/useAuth';
import { useNotifications } from '../../hooks/useNotifications';
import { getRoleLabel, getRoleDescription } from '../../types/auth';
import { SwitchRoleModal } from './SwitchRoleModal';
import { TracePilotLogo } from '../common/TracePilotLogo';

interface SidebarProps {
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ mobileOpen, onCloseMobile }) => {
  const { user, logout } = useAuth();
  const { unreadCount } = useNotifications();
  const [switchRoleOpen, setSwitchRoleOpen] = useState(false);

  const getInitials = (name?: string) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getRoleBadgeClass = (role?: string) => {
    switch (role) {
      case 'ADMIN':
        return 'role-badge-admin';
      case 'TESTER':
        return 'role-badge-tester';
      case 'USER':
        return 'role-badge-user';
      default:
        return 'role-badge-tester';
    }
  };

  return (
    <>
      {mobileOpen && (
        <div
          className="sidebar-backdrop"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}
      <aside className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
        {/* Brand Header */}
        <div className="sidebar-header">
          <div className="brand-logo">
            <TracePilotLogo size={22} />
          </div>
          <span className="brand-title">TracePilot</span>
        </div>

        {/* User Card */}
        {user && (
          <div className="sidebar-user-card">
            <div className="user-avatar-circle">{getInitials(user.full_name)}</div>
            <div className="user-info-text">
              <div className="user-display-name" title={user.full_name}>
                {user.full_name}
              </div>
              <span className={`user-role-badge ${getRoleBadgeClass(user.role)}`}>
                {getRoleLabel(user.role)}
              </span>
              <div
                style={{
                  fontSize: '0.68rem',
                  color: 'var(--text-muted)',
                  marginTop: '0.1rem',
                  lineHeight: 1.3,
                }}
              >
                {getRoleDescription(user.role)}
              </div>
            </div>
          </div>
        )}

        {/* Navigation Items */}
        <nav className="sidebar-nav">
          {/* USER: User Dashboard & Issues */}
          {user?.role === 'USER' && (
            <>
              <NavLink
                to="/dashboard"
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                onClick={onCloseMobile}
              >
                <LayoutDashboard size={18} />
                <span>Dashboard</span>
              </NavLink>
              <NavLink
                to="/issues"
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                onClick={onCloseMobile}
              >
                <Bug size={18} />
                <span>My Issues</span>
              </NavLink>
            </>
          )}

          {/* ADMIN: Full Management Navigation */}
          {user?.role === 'ADMIN' && (
            <>
              <NavLink
                to="/admin-dashboard"
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                onClick={onCloseMobile}
              >
                <LayoutDashboard size={18} />
                <span>Admin Dashboard</span>
              </NavLink>

              <NavLink
                to="/issues"
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                onClick={onCloseMobile}
              >
                <Bug size={18} />
                <span>Issues &amp; Defects</span>
              </NavLink>

              <NavLink
                to="/projects"
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                onClick={onCloseMobile}
              >
                <FolderGit2 size={18} />
                <span>Projects</span>
              </NavLink>

              <NavLink
                to="/admin/sprints"
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                onClick={onCloseMobile}
              >
                <Timer size={18} />
                <span>Sprints &amp; Planning</span>
              </NavLink>

              <NavLink
                to="/admin/sprint-approvals"
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                onClick={onCloseMobile}
              >
                <ClipboardCheck size={18} />
                <span>Sprint Approvals</span>
              </NavLink>

              <NavLink
                to="/analytics"
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                onClick={onCloseMobile}
              >
                <BarChart3 size={18} />
                <span>Analytics</span>
              </NavLink>

              <NavLink
                to="/admin-management"
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                onClick={onCloseMobile}
              >
                <ShieldCheck size={18} />
                <span>Admin Management</span>
              </NavLink>
            </>
          )}


          {/* TESTER: Tester-specific Navigation */}
          {user?.role === 'TESTER' && (
            <>
              <NavLink
                to="/tester-dashboard"
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                onClick={onCloseMobile}
              >
                <LayoutDashboard size={18} />
                <span>Tester Dashboard</span>
              </NavLink>

              <NavLink
                to="/tester-sprints"
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                onClick={onCloseMobile}
              >
                <Timer size={18} />
                <span>My Sprints</span>
              </NavLink>

              <NavLink
                to="/tester-issues"
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                onClick={onCloseMobile}
              >
                <Bug size={18} />
                <span>My Assigned Issues</span>
              </NavLink>
            </>
          )}


          <NavLink
            to="/notifications"
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            onClick={onCloseMobile}
          >
            <Bell size={18} />
            <span>Notifications</span>
            {unreadCount > 0 && <span className="nav-badge">{unreadCount}</span>}
          </NavLink>

          <NavLink
            to="/profile"
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            onClick={onCloseMobile}
          >
            <User size={18} />
            <span>My Profile</span>
          </NavLink>
        </nav>

        {/* Footer: Switch Role + Sign Out */}
        <div className="sidebar-footer">
          <button
            onClick={() => setSwitchRoleOpen(true)}
            className="btn btn-secondary"
            style={{ width: '100%', justifyContent: 'flex-start', marginBottom: '0.45rem' }}
          >
            <ArrowLeftRight size={16} />
            <span>Switch Role</span>
          </button>
          <button
            onClick={() => logout()}
            className="btn btn-secondary"
            style={{ width: '100%', justifyContent: 'flex-start' }}
          >
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Switch Role Modal — rendered outside aside so z-index stacking works */}
      <SwitchRoleModal
        isOpen={switchRoleOpen}
        onClose={() => setSwitchRoleOpen(false)}
      />
    </>
  );
};
