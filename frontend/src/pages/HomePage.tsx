import React, { useState, useEffect, useRef } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  Bug,
  CheckCircle2,
  ChevronDown,
  FolderOpen,
  LayoutDashboard,
  LogIn,
  Menu,
  Bell,
  Shield,
  ShieldCheck,
  TrendingUp,
  X,
  Zap,
  Activity,
  GitBranch,
  Target,
  FileText,
  Clock,
  CheckSquare,
  Layers,
  Crown,
  TestTube,
  Wifi,
  BookOpen,
  Users,
  Sun,
  Moon,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../context/ThemeContext';
import {
  LineChart,
  Line,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { TracePilotLogo } from '../components/common/TracePilotLogo';
import './HomePage.css';

/* â”€â”€â”€ Intersection Observer Hook â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function useInView(threshold = 0.15) {
  const ref = useRef<HTMLElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setInView(true); observer.disconnect(); } },
      { threshold }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, inView };
}

/* â”€â”€â”€ Animated Counter â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function AnimatedCounter({ target, suffix = '', duration = 2000 }: { target: number; suffix?: string; duration?: number }) {
  const [count, setCount] = useState(0);
  const { ref, inView } = useInView(0.3);

  useEffect(() => {
    if (!inView) return;
    let start = 0;
    const step = target / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= target) { setCount(target); clearInterval(timer); }
      else setCount(Math.floor(start));
    }, 16);
    return () => clearInterval(timer);
  }, [inView, target, duration]);

  return <span ref={ref as React.Ref<HTMLSpanElement>}>{count}{suffix}</span>;
}

/* â”€â”€â”€ Mini resolution chart data â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
const resolutionData = [
  { d: 'W1', v: 62 }, { d: 'W2', v: 71 }, { d: 'W3', v: 68 },
  { d: 'W4', v: 79 }, { d: 'W5', v: 85 }, { d: 'W6', v: 91 },
  { d: 'W7', v: 88 }, { d: 'W8', v: 95 }, { d: 'W9', v: 98 },
];

/* â”€â”€â”€ Burndown mini chart â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
const burndownData = [
  { d: 'D1', ideal: 38, actual: 38 }, { d: 'D2', ideal: 32, actual: 34 },
  { d: 'D3', ideal: 26, actual: 29 }, { d: 'D4', ideal: 20, actual: 22 },
  { d: 'D5', ideal: 14, actual: 18 }, { d: 'D6', ideal: 8, actual: 12 },
  { d: 'D7', ideal: 2, actual: 7 },
];

/* â”€â”€â”€ Orbit items â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
const orbitItems = [
  { icon: 'ðŸž', label: 'Issues', angle: 0 },
  { icon: 'ðŸƒ', label: 'Sprints', angle: 51.4 },
  { icon: 'ðŸ“Š', label: 'Analytics', angle: 102.8 },
  { icon: 'ðŸ””', label: 'Alerts', angle: 154.2 },
  { icon: 'ðŸ“', label: 'Projects', angle: 205.6 },
  { icon: 'ðŸ‘¥', label: 'Teams', angle: 257.1 },
  { icon: 'ðŸ“„', label: 'Reports', angle: 308.5 },
];

/* â”€â”€â”€ Demo data â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
const demoIssues = [
  { key: 'BUG-1024', title: 'Login authentication failure', severity: 'CRITICAL', status: 'IN PROGRESS', assignee: 'AK', severityColor: '#ef4444', statusColor: '#f59e0b' },
  { key: 'BUG-1025', title: 'Dashboard chart not loading', severity: 'HIGH', status: 'OPEN', assignee: 'SR', severityColor: '#f97316', statusColor: '#6366f1' },
  { key: 'BUG-1026', title: 'File upload timeout error', severity: 'MEDIUM', status: 'RESOLVED', assignee: 'JD', severityColor: '#f59e0b', statusColor: '#22c55e' },
  { key: 'BUG-1027', title: 'User profile page 404', severity: 'LOW', status: 'OPEN', assignee: 'PL', severityColor: '#0ea5e9', statusColor: '#6366f1' },
];

const demoTeamWorkload = [
  { name: 'Alex K.', initials: 'AK', issues: 5, accent: '#6366f1' },
  { name: 'Sarah R.', initials: 'SR', issues: 4, accent: '#22c55e' },
  { name: 'John D.', initials: 'JD', issues: 6, accent: '#a855f7' },
];

const demoNotifications = [
  { icon: 'ðŸƒ', title: 'Sprint Started', body: 'Sprint Alpha is now ACTIVE.', time: 'Just now', accent: '#6366f1', unread: true },
  { icon: 'âœ…', title: 'Issue Resolved', body: 'BUG-1024 was resolved successfully.', time: '2 minutes ago', accent: '#22c55e', unread: true },
  { icon: 'ðŸ“Š', title: 'Sprint Health Updated', body: 'Sprint Alpha is ON TRACK.', time: '5 minutes ago', accent: '#0ea5e9', unread: false },
  { icon: 'ðŸ””', title: 'New Issue Assigned', body: 'BUG-1028 assigned to you.', time: '12 minutes ago', accent: '#f59e0b', unread: false },
];

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   HOMEPAGE COMPONENT
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
export const HomePage: React.FC = () => {
  const { isAuthenticated, user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState('home');
  const [scrollProgress, setScrollProgress] = useState(0);

  /* Navbar scroll effect + progress bar */
  useEffect(() => {
    const handler = () => {
      setScrolled(window.scrollY > 20);
      const el = document.documentElement;
      const progress = (el.scrollTop / (el.scrollHeight - el.clientHeight)) * 100;
      setScrollProgress(Math.min(100, Math.max(0, progress)));
    };
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  /* Active section highlight */
  useEffect(() => {
    const sectionIds = ['features', 'demo', 'workflow', 'sprints', 'analytics', 'roles', 'realtime', 'why'];
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => { if (e.isIntersecting) setActiveSection(e.target.id); });
      },
      { rootMargin: '-40% 0px -50% 0px' }
    );
    sectionIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  const scrollToSection = (id: string) => {
    setMobileMenuOpen(false);
    if (id === 'home') { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleProtectedNavigation = (path: string) => {
    if (!user || !isAuthenticated) { navigate('/login'); return; }
    navigate(path);
  };

  const handleLogin = () => { setMobileMenuOpen(false); navigate('/login'); };
  const handleRegister = () => { setMobileMenuOpen(false); navigate('/register'); };

  const getDashboardPath = () => {
    if (!user) return '/login';
    if (user.role === 'ADMIN') return '/admin-dashboard';
    if (user.role === 'DEVELOPER') return '/developer-dashboard';
    return '/dashboard';
  };

  if (isAuthenticated && user) {
    return <Navigate to={getDashboardPath()} replace />;
  }

  const navLinks = [
    { id: 'home', label: 'Home' },
    { id: 'features', label: 'Features' },
    { id: 'workflow', label: 'Workflow' },
    { id: 'analytics', label: 'Analytics' },
    { id: 'sprints', label: 'Sprints' },
  ];

  return (
    <div className="lp-root">
      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
          SCROLL PROGRESS BAR
      â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      <div
        className="lp-scroll-progress"
        style={{ width: `${scrollProgress}%` }}
        role="progressbar"
        aria-valuenow={Math.round(scrollProgress)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Page scroll progress"
      />

      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
          ANIMATED BACKGROUND
      â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      <div className="lp-bg" aria-hidden="true">
        <div className="lp-bg-grid" />
        <div className="lp-blob lp-blob-1" />
        <div className="lp-blob lp-blob-2" />
        <div className="lp-blob lp-blob-3" />
        <div className="lp-particles">
          {Array.from({ length: 20 }).map((_, i) => (
            <div key={i} className="lp-particle" style={{
              left: `${(i * 17 + 7) % 100}%`,
              top: `${(i * 23 + 11) % 100}%`,
              animationDelay: `${(i * 0.4) % 6}s`,
              animationDuration: `${4 + (i % 4)}s`,
            }} />
          ))}
        </div>
      </div>

      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
          NAVBAR
      â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      <header className={`lp-nav${scrolled ? ' lp-nav--scrolled' : ''}`} role="banner">
        <div className="lp-nav-inner">
          {/* Brand */}
          <button
            type="button"
            className="lp-brand"
            onClick={() => scrollToSection('home')}
            aria-label="TracePilot home"
          >
            <div className="lp-brand-logo" aria-hidden="true">
              <TracePilotLogo size={22} />
            </div>
            <span className="lp-brand-name">TracePilot</span>
          </button>

          {/* Desktop nav */}
          <nav className="lp-nav-links" aria-label="Main navigation">
            {navLinks.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                className={`lp-nav-link${activeSection === id ? ' lp-nav-link--active' : ''}`}
                onClick={() => scrollToSection(id)}
              >
                {label}
              </button>
            ))}
          </nav>

          {/* Desktop actions */}
          <div className="lp-nav-actions">
            {/* Theme Toggle Button */}
            <button
              type="button"
              className="lp-btn lp-btn--ghost lp-theme-btn"
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              style={{ padding: '0.45rem', minWidth: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>

            {isAuthenticated && user ? (
              <button type="button" className="lp-btn lp-btn--primary" onClick={() => navigate(getDashboardPath())}>
                <LayoutDashboard size={15} />
                Dashboard
              </button>
            ) : (
              <>
                <button type="button" className="lp-btn lp-btn--ghost" onClick={handleLogin}>
                  <LogIn size={15} />
                  Sign In
                </button>
                <button type="button" className="lp-btn lp-btn--primary" onClick={handleRegister}>
                  Get Started
                  <ArrowRight size={15} />
                </button>
              </>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            type="button"
            className="lp-hamburger"
            onClick={() => setMobileMenuOpen((o) => !o)}
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="lp-mobile-menu" role="navigation" aria-label="Mobile navigation">
            {navLinks.map(({ id, label }) => (
              <button key={id} type="button" className="lp-mobile-link" onClick={() => scrollToSection(id)}>
                {label}
              </button>
            ))}
            <div className="lp-mobile-divider" />
            <button type="button" className="lp-mobile-link" onClick={toggleTheme}>
              {theme === 'dark' ? 'â˜€ï¸ Switch to Light Theme' : 'ðŸŒ™ Switch to Dark Theme'}
            </button>
            <button type="button" className="lp-mobile-link" onClick={handleLogin}>Sign In</button>
            <button type="button" className="lp-mobile-link lp-mobile-link--primary" onClick={handleRegister}>
              Get Started
            </button>
          </div>
        )}
      </header>

      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
          HERO
      â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      <section className="lp-hero" aria-label="Hero">
        {/* Left */}
        <div className="lp-hero-left">
          <div className="lp-hero-badge">
            <Zap size={12} aria-hidden="true" />
            <span>INTELLIGENT SOFTWARE MANAGEMENT</span>
          </div>

          <h1 className="lp-hero-title">
            Track Bugs.<br />
            <span className="lp-gradient-text">Ship Better</span><br />
            Software.
          </h1>

          <p className="lp-hero-subtitle">
            TracePilot brings issues, projects, Agile sprints, analytics, and
            real-time collaboration into one powerful workspace.
          </p>

          {/* ENHANCEMENT 5: Updated CTA hierarchy */}
          <div className="lp-hero-cta">
            <button type="button" className="lp-btn lp-btn--primary lp-btn--lg" onClick={handleRegister}>
              Get Started Free
              <ArrowRight size={18} />
            </button>
            <button
              type="button"
              className="lp-btn lp-btn--outline lp-btn--lg"
              onClick={() => scrollToSection('demo')}
            >
              Explore Product
              <ChevronDown size={18} />
            </button>
          </div>

          <div className="lp-hero-trust">
            <div className="lp-trust-item"><CheckCircle2 size={14} aria-hidden="true" /><span>Agile Sprint Planning</span></div>
            <div className="lp-trust-item"><CheckCircle2 size={14} aria-hidden="true" /><span>Real-Time Analytics</span></div>
            <div className="lp-trust-item"><CheckCircle2 size={14} aria-hidden="true" /><span>Role-Based Workflows</span></div>
          </div>
        </div>

        {/* Right â€” 3D floating dashboard cards */}
        <div className="lp-hero-visual" aria-hidden="true">
          <div className="lp-3d-scene">
            {/* Sprint card */}
            <div className="lp-float-card lp-float-card--sprint">
              <div className="lp-fc-header">
                <Activity size={13} />
                <span>Sprint Alpha</span>
                <span className="lp-fc-tag lp-fc-tag--green">ON TRACK</span>
              </div>
              <div className="lp-fc-label">Sprint Progress</div>
              <div className="lp-fc-progress-wrap">
                <div className="lp-fc-progress-bar">
                  <div className="lp-fc-progress-fill" style={{ width: '72%' }} />
                </div>
                <span className="lp-fc-prog-val">72%</span>
              </div>
              <div className="lp-fc-row">
                <span className="lp-fc-sub">17 / 24 issues done</span>
              </div>
            </div>

            {/* Issue card */}
            <div className="lp-float-card lp-float-card--issue">
              <div className="lp-fc-header">
                <Bug size={13} />
                <span className="lp-fc-mono">BUG-1024</span>
                <span className="lp-fc-tag lp-fc-tag--red">CRITICAL</span>
              </div>
              <div className="lp-fc-issue-title">Auth token refresh loop</div>
              <div className="lp-fc-row">
                <div className="lp-fc-avatar">AK</div>
                <span className="lp-fc-sub">Assigned to Ajay K.</span>
              </div>
            </div>

            {/* Analytics card */}
            <div className="lp-float-card lp-float-card--analytics">
              <div className="lp-fc-header">
                <TrendingUp size={13} />
                <span>Resolution Rate</span>
              </div>
              <div className="lp-fc-big-num">+24%</div>
              <div className="lp-fc-sparkline">
                <ResponsiveContainer width="100%" height={36}>
                  <LineChart data={resolutionData}>
                    <Line type="monotone" dataKey="v" stroke="#6366f1" strokeWidth={2} dot={false} />
                    <Tooltip contentStyle={{ display: 'none' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Notification card */}
            <div className="lp-float-card lp-float-card--notify">
              <div className="lp-fc-header">
                <Bell size={13} />
                <span>Notification</span>
              </div>
              <div className="lp-fc-notify-msg">
                <CheckCircle2 size={14} className="lp-fc-notify-icon" />
                Sprint completed successfully!
              </div>
            </div>

            {/* Glow orb */}
            <div className="lp-scene-glow" />
          </div>
        </div>
      </section>

      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
          FEATURES
      â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      <section id="features" className="lp-section" aria-labelledby="features-title">
        <div className="lp-section-inner">
          <div className="lp-section-head">
            <div className="lp-section-badge"><Layers size={12} aria-hidden="true" />Features</div>
            <h2 id="features-title" className="lp-section-title">
              Everything Your Engineering<br />Team Needs
            </h2>
            <p className="lp-section-sub">
              From bug reporting to sprint delivery, manage the complete software
              development lifecycle.
            </p>
          </div>

          <div className="lp-features-grid">
            {[
              {
                emoji: 'ðŸž', icon: <Bug size={20} />, accent: '#6366f1',
                title: 'Intelligent Issue Tracking',
                desc: 'Track bugs, tasks, and feature requests with powerful filtering, priority management, and severity classification.',
                action: () => handleProtectedNavigation('/issues'),
              },
              {
                emoji: 'ðŸƒ', icon: <GitBranch size={20} />, accent: '#22c55e',
                title: 'Agile Sprint Management',
                desc: 'Plan sprints, assign backlog issues, track progress, manage capacity, and safely roll over unfinished work.',
                action: () => handleProtectedNavigation('/projects'),
              },
              {
                emoji: 'ðŸ“Š', icon: <BarChart3 size={20} />, accent: '#a855f7',
                title: 'Real-Time Analytics',
                desc: 'Monitor issue trends, resolution performance, tester workload, sprint health, and project progress.',
                action: () => handleProtectedNavigation('/analytics'),
              },
              {
                emoji: 'ðŸ“‰', icon: <Activity size={20} />, accent: '#0ea5e9',
                title: 'Burndown Tracking',
                desc: 'Visualize sprint progress with ideal versus actual burndown data to keep delivery on schedule.',
                action: () => scrollToSection('sprints'),
              },
              {
                emoji: 'ðŸ””', icon: <Bell size={20} />, accent: '#f59e0b',
                title: 'Real-Time Notifications',
                desc: 'Stay informed about important issue and sprint activities through live notifications.',
                action: () => handleProtectedNavigation('/notifications'),
              },
              {
                emoji: 'ðŸ”', icon: <ShieldCheck size={20} />, accent: '#ef4444',
                title: 'Role-Based Access',
                desc: 'Secure workflows with dedicated permissions for Admins, Testers, and Users.',
                action: () => scrollToSection('roles'),
              },
            ].map(({ emoji, icon, accent, title, desc, action }) => (
              <FeatureCard key={title} emoji={emoji} icon={icon} accent={accent} title={title} desc={desc} onClick={action} />
            ))}
          </div>
        </div>
      </section>

      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
          INTERACTIVE PRODUCT DEMO  [ENHANCEMENT 1]
      â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      <section id="demo" className="lp-section lp-section--alt" aria-labelledby="demo-title">
        <div className="lp-section-inner">
          <div className="lp-section-head">
            <div className="lp-section-badge"><Zap size={12} aria-hidden="true" />Product Demo</div>
            <h2 id="demo-title" className="lp-section-title">Experience TracePilot in Action</h2>
            <p className="lp-section-sub">
              Explore how teams track issues, plan sprints, and monitor project performance
              from one intelligent workspace.
            </p>
          </div>
          <ProductDemo />
        </div>
      </section>

      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
          WORKFLOW
      â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      <section id="workflow" className="lp-section" aria-labelledby="workflow-title">
        <div className="lp-section-inner">
          <div className="lp-section-head">
            <div className="lp-section-badge"><GitBranch size={12} aria-hidden="true" />Workflow</div>
            <h2 id="workflow-title" className="lp-section-title">From Backlog to Release</h2>
            <p className="lp-section-sub">A structured path from planning to deployment, every sprint.</p>
          </div>

          <WorkflowTimeline />
        </div>
      </section>

      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
          SPRINT SHOWCASE
      â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      <section id="sprints" className="lp-section lp-section--alt" aria-labelledby="sprints-title">
        <div className="lp-section-inner">
          <SprintShowcase onNavigate={() => handleProtectedNavigation('/projects')} />
        </div>
      </section>

      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
          ANALYTICS SHOWCASE
      â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      <section id="analytics" className="lp-section" aria-labelledby="analytics-title">
        <div className="lp-section-inner">
          <div className="lp-section-head">
            <div className="lp-section-badge"><BarChart3 size={12} aria-hidden="true" />Analytics</div>
            <h2 id="analytics-title" className="lp-section-title">See Everything, Fix Faster</h2>
            <p className="lp-section-sub">
              Sample data shown for demonstration. Your real metrics will appear after sign-in.
            </p>
          </div>

          <div className="lp-analytics-grid">
            {/* Counter stats */}
            <div className="lp-analytics-stats">
              {[
                { target: 98, suffix: '%', label: 'Resolution Rate', accent: '#6366f1', icon: <TrendingUp size={18} /> },
                { target: 24, suffix: '', label: 'Active Issues', accent: '#22c55e', icon: <Bug size={18} /> },
                { target: 12, suffix: '', label: 'Projects', accent: '#a855f7', icon: <FolderOpen size={18} /> },
                { target: 86, suffix: '%', label: 'Sprint Completion', accent: '#0ea5e9', icon: <Target size={18} /> },
              ].map(({ target, suffix, label, accent, icon }) => (
                <div key={label} className="lp-stat-card" style={{ '--accent': accent } as React.CSSProperties}>
                  <div className="lp-stat-icon" style={{ color: accent }}>{icon}</div>
                  <div className="lp-stat-num" style={{ color: accent }}>
                    <AnimatedCounter target={target} suffix={suffix} />
                  </div>
                  <div className="lp-stat-label">{label}</div>
                </div>
              ))}
            </div>

            {/* Chart */}
            <div className="lp-analytics-chart-card">
              <div className="lp-chart-header">
                <span className="lp-chart-title">Resolution Rate Trend</span>
                <span className="lp-chart-demo-tag">DEMO DATA</span>
              </div>
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={resolutionData}>
                  <Line type="monotone" dataKey="v" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 3, fill: '#6366f1' }} />
                  <Tooltip
                    contentStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', fontSize: 12, color: 'var(--text-primary)' }}
                    labelStyle={{ color: 'var(--text-secondary)' }}
                    formatter={(v: number) => [`${v}%`, 'Rate']}
                  />
                </LineChart>
              </ResponsiveContainer>
              <div className="lp-chart-footer">Weekly resolution rate across all projects (sample data)</div>
            </div>
          </div>
        </div>
      </section>

      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
          ROLE-BASED WORKFLOW  [ENHANCEMENT 2]
      â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      <section id="roles" className="lp-section lp-section--alt" aria-labelledby="roles-title">
        <div className="lp-section-inner">
          <div className="lp-section-head">
            <div className="lp-section-badge"><Shield size={12} aria-hidden="true" />Roles</div>
            <h2 id="roles-title" className="lp-section-title">
              Built for Every Role in Your<br />Software Team
            </h2>
            <p className="lp-section-sub">
              TracePilot provides focused workflows and permissions for every member of the development lifecycle.
            </p>
          </div>
          <div className="lp-roles-grid">
            <RoleCard
              icon={<Crown size={26} />}
              accent="#f59e0b"
              role="Administrator"
              subtitle="Full system control"
              badge="Control Center"
              capabilities={[
                'Manage users and permissions',
                'Create and manage projects',
                'Plan and oversee all sprints',
                'Monitor system analytics',
                'Review complete audit logs',
                'Manage team workflows',
              ]}
            />
            <RoleCard
              icon={<TestTube size={26} />}
              accent="#6366f1"
              role="Tester"
              subtitle="Quality Assurance & Verification"
              capabilities={[
                'Investigate and verify reported defects',
                'Update issue progress and test transitions',
                'Execute assigned sprint testing work',
                'Validate fixes against quality benchmarks',
                'Track personal workload and velocity',
                'Collaborate via issue comments and attachments',
              ]}
            />
            <RoleCard
              icon={<Users size={26} />}
              accent="#22c55e"
              role="User"
              subtitle="Issue Reporter & Collaborator"
              capabilities={[
                'Submit detailed defect and bug reports',
                'Track real-time resolution progress',
                'Add comments and upload screenshots',
                'Receive live system notifications',
                'Verify fixes on reported issues',
                'Collaborate across open projects',
              ]}
            />
          </div>
        </div>
      </section>

      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
          REAL-TIME NOTIFICATIONS  [ENHANCEMENT 3]
      â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      <section id="realtime" className="lp-section" aria-labelledby="realtime-title">
        <div className="lp-section-inner">
          <div className="lp-realtime-layout">
            {/* Left: copy */}
            <div className="lp-realtime-copy">
              <div className="lp-section-badge" style={{ marginBottom: '1.25rem' }}>
                <Wifi size={12} aria-hidden="true" />Real-Time
              </div>
              <h2 id="realtime-title" className="lp-section-title" style={{ textAlign: 'left' }}>
                Stay Updated<br />
                <span className="lp-gradient-text">in Real Time</span>
              </h2>
              <p className="lp-realtime-body">
                Important project events are delivered instantly so your team always knows what changed.
                TracePilot's notification infrastructure keeps everyone in sync.
              </p>
              <ul className="lp-realtime-list">
                {[
                  'Sprint start and completion events',
                  'Issue assignment and resolution alerts',
                  'Sprint health status updates',
                  'New issue and comment notifications',
                ].map((item) => (
                  <li key={item}><CheckCircle2 size={15} aria-hidden="true" /><span>{item}</span></li>
                ))}
              </ul>
              <div className="lp-live-badge" aria-label="Live capability preview">
                <span className="lp-live-dot" aria-hidden="true" />
                <span>LIVE â€” Capability Preview</span>
              </div>
            </div>

            {/* Right: notification panel */}
            <NotificationPanel />
          </div>
        </div>
      </section>

      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
          ORBIT SECTION
      â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      <section className="lp-section lp-section--alt lp-orbit-section" aria-label="TracePilot capabilities orbit">
        <div className="lp-section-inner lp-orbit-inner">
          <div className="lp-section-head">
            <div className="lp-section-badge"><Zap size={12} aria-hidden="true" />Platform</div>
            <h2 className="lp-section-title">One Platform, Every Capability</h2>
          </div>
          <div className="lp-orbit-wrapper" aria-hidden="true">
            {/* Center */}
            <div className="lp-orbit-center">
              <div className="lp-orbit-logo">
                <TracePilotLogo size={42} />
              </div>
              <span className="lp-orbit-center-label">TracePilot</span>
            </div>

            {/* Orbit ring */}
            <div className="lp-orbit-ring lp-orbit-ring-1">
              {orbitItems.map(({ icon, label, angle }) => (
                <div
                  key={label}
                  className="lp-orbit-item"
                  style={{ '--angle': `${angle}deg` } as React.CSSProperties}
                >
                  <div className="lp-orbit-item-inner">
                    <span className="lp-orbit-item-emoji">{icon}</span>
                    <span className="lp-orbit-item-label">{label}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
          WHY TRACEPILOT
      â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      <section id="why" className="lp-section" aria-labelledby="why-title">
        <div className="lp-section-inner">
          <div className="lp-section-head">
            <div className="lp-section-badge"><Shield size={12} aria-hidden="true" />Why TracePilot</div>
            <h2 id="why-title" className="lp-section-title">Built for Modern Software Teams</h2>
          </div>
          <div className="lp-why-grid">
            {[
              {
                icon: <Layers size={28} />, accent: '#6366f1',
                heading: 'One Platform',
                body: 'Manage projects, issues, sprints, analytics, and collaboration in one unified workspace. No context switching.',
              },
              {
                icon: <Activity size={28} />, accent: '#22c55e',
                heading: 'Real-Time Visibility',
                body: 'Understand exactly what your team is building and where work is getting blocked with live dashboards.',
              },
              {
                icon: <Target size={28} />, accent: '#a855f7',
                heading: 'Smarter Delivery',
                body: 'Use sprint health, workload analysis, and analytics to continuously improve team delivery performance.',
              },
            ].map(({ icon, accent, heading, body }) => (
              <div key={heading} className="lp-why-card" style={{ '--accent': accent } as React.CSSProperties}>
                <div className="lp-why-icon" style={{ color: accent, background: `${accent}18` }}>{icon}</div>
                <h3 className="lp-why-heading">{heading}</h3>
                <p className="lp-why-body">{body}</p>
              </div>
            ))}
          </div>

          {/* ENHANCEMENT 6: Capability Highlights */}
          <div className="lp-capabilities">
            {[
              { emoji: 'ðŸž', title: 'Intelligent Issue Tracking', desc: 'Track defects with severity, priority, assignments, comments, and attachments.' },
              { emoji: 'ðŸƒ', title: 'Advanced Sprint Management', desc: 'Plan sprints, track capacity, monitor health, manage rollovers, and generate sprint reports.' },
              { emoji: 'ðŸ“Š', title: 'Actionable Analytics', desc: 'Monitor resolution trends, team workload, project metrics, and sprint performance.' },
              { emoji: 'ðŸ”', title: 'Role-Based Security', desc: 'Controlled workflows for administrators, testers, and reporters.' },
              { emoji: 'ðŸ””', title: 'Real-Time Updates', desc: 'Important system and sprint events delivered through real-time notification infrastructure.' },
              { emoji: 'ðŸ“', title: 'Complete Audit Trail', desc: 'Traceable activity records maintained for all important system operations.' },
            ].map(({ emoji, title, desc }) => (
              <div key={title} className="lp-capability-item">
                <span className="lp-capability-emoji" aria-hidden="true">{emoji}</span>
                <div>
                  <div className="lp-capability-title">{title}</div>
                  <div className="lp-capability-desc">{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
          FINAL CTA
      â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      <section className="lp-cta-section" aria-labelledby="cta-title">
        <div className="lp-cta-bg-glow" aria-hidden="true" />
        <div className="lp-cta-inner">
          <div className="lp-cta-badge"><Zap size={12} aria-hidden="true" />Ready when you are</div>
          <h2 id="cta-title" className="lp-cta-title">
            Ready to Build Better<br />
            <span className="lp-gradient-text">Software?</span>
          </h2>
          <p className="lp-cta-body">
            Bring your team, projects, issues, and sprints together in one intelligent workspace.
          </p>
          <div className="lp-cta-actions">
            <button type="button" className="lp-btn lp-btn--primary lp-btn--lg" onClick={handleRegister}>
              Get Started Free
              <ArrowRight size={18} />
            </button>
            <button type="button" className="lp-btn lp-btn--outline lp-btn--lg" onClick={() => handleProtectedNavigation('/dashboard')}>
              <LayoutDashboard size={18} />
              View Dashboard
            </button>
          </div>
        </div>
      </section>

      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
          FOOTER
      â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      <footer className="lp-footer" role="contentinfo">
        <div className="lp-footer-inner">
          <div className="lp-footer-brand-col">
            <div className="lp-brand lp-footer-brand">
              <div className="lp-brand-logo" aria-hidden="true"><TracePilotLogo size={20} /></div>
              <span className="lp-brand-name">TracePilot</span>
            </div>
            <p className="lp-footer-tagline">
              Intelligent bug tracking and agile sprint management for modern engineering teams.
            </p>
          </div>

          <div className="lp-footer-links-col">
            <div className="lp-footer-group">
              <div className="lp-footer-group-title">Product</div>
              <button type="button" className="lp-footer-link" onClick={() => scrollToSection('features')}>Features</button>
              <button type="button" className="lp-footer-link" onClick={() => handleProtectedNavigation('/issues')}>Issues</button>
              <button type="button" className="lp-footer-link" onClick={() => scrollToSection('sprints')}>Sprints</button>
              <button type="button" className="lp-footer-link" onClick={() => scrollToSection('analytics')}>Analytics</button>
            </div>

            <div className="lp-footer-group">
              <div className="lp-footer-group-title">Platform</div>
              <button type="button" className="lp-footer-link" onClick={() => handleProtectedNavigation('/projects')}>Projects</button>
              <button type="button" className="lp-footer-link" onClick={() => handleProtectedNavigation('/notifications')}>Notifications</button>
              <button type="button" className="lp-footer-link" onClick={() => handleProtectedNavigation('/analytics')}>Reports</button>
              <button type="button" className="lp-footer-link" onClick={() => scrollToSection('why')}>Security</button>
            </div>

            <div className="lp-footer-group">
              <div className="lp-footer-group-title">Resources</div>
              <button type="button" className="lp-footer-link" onClick={handleLogin}>Documentation</button>
              <button type="button" className="lp-footer-link" onClick={handleLogin}>API Docs</button>
              <button type="button" className="lp-footer-link" onClick={handleLogin}>GitHub</button>
            </div>
          </div>
        </div>

        <div className="lp-footer-bottom">
          <span>Â© {new Date().getFullYear()} TracePilot. All rights reserved.</span>
          <div className="lp-footer-bottom-links">
            <button type="button" className="lp-footer-link" onClick={handleLogin}>Privacy</button>
            <button type="button" className="lp-footer-link" onClick={handleLogin}>Terms</button>
          </div>
        </div>
      </footer>
    </div>
  );
};

/* â”€â”€â”€ Feature Card Sub-component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
interface FeatureCardProps {
  emoji: string;
  icon: React.ReactNode;
  accent: string;
  title: string;
  desc: string;
  onClick: () => void;
}
const FeatureCard: React.FC<FeatureCardProps> = ({ icon, accent, title, desc, onClick }) => {
  const { ref, inView } = useInView(0.1);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientY - rect.top) / rect.height - 0.5) * 10;
    const y = -((e.clientX - rect.left) / rect.width - 0.5) * 10;
    setTilt({ x, y });
  };
  const handleMouseLeave = () => setTilt({ x: 0, y: 0 });

  return (
    <button
      ref={ref as React.Ref<HTMLButtonElement>}
      type="button"
      className={`lp-feature-card${inView ? ' lp-feature-card--visible' : ''}`}
      onClick={onClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        '--accent': accent,
        transform: `perspective(600px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
      } as React.CSSProperties}
    >
      <div className="lp-feature-icon-wrap" style={{ color: accent, background: `${accent}18` }}>
        {icon}
      </div>
      <h3 className="lp-feature-title">{title}</h3>
      <p className="lp-feature-desc">{desc}</p>
      <div className="lp-feature-arrow" style={{ color: accent }}>
        <ArrowRight size={15} aria-hidden="true" />
      </div>
    </button>
  );
};

/* â”€â”€â”€ Workflow Timeline Sub-component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
const workflowSteps = [
  { icon: <CheckSquare size={18} />, label: 'BACKLOG', desc: 'All issues and feature requests collected and prioritized', accent: '#6366f1' },
  { icon: <Layers size={18} />, label: 'SPRINT PLANNING', desc: 'Team selects backlog items, estimates effort, assigns capacity', accent: '#8b5cf6' },
  { icon: <Activity size={18} />, label: 'ACTIVE SPRINT', desc: 'Testers and team leads work through sprint issues in real-time', accent: '#a855f7' },
  { icon: <Bug size={18} />, label: 'ISSUE RESOLUTION', desc: 'Bugs investigated, fixed, reviewed, and marked resolved', accent: '#22c55e' },
  { icon: <BarChart3 size={18} />, label: 'ANALYTICS', desc: 'Sprint velocity, burndown, and resolution metrics reviewed', accent: '#0ea5e9' },
  { icon: <FileText size={18} />, label: 'RELEASE', desc: 'Sprint closed, report generated, next sprint begins', accent: '#f59e0b' },
];

const WorkflowTimeline: React.FC = () => {
  const { ref, inView } = useInView(0.1);
  return (
    <div ref={ref as React.Ref<HTMLDivElement>} className="lp-workflow">
      {workflowSteps.map(({ icon, label, desc, accent }, i) => (
        <div
          key={label}
          className={`lp-wf-item${inView ? ' lp-wf-item--visible' : ''}`}
          style={{ transitionDelay: inView ? `${i * 0.1}s` : '0s' }}
        >
          <div className="lp-wf-icon" style={{ color: accent, background: `${accent}18`, border: `1.5px solid ${accent}40` }}>
            {icon}
          </div>
          {i < workflowSteps.length - 1 && (
            <div className={`lp-wf-connector${inView ? ' lp-wf-connector--animated' : ''}`}
              style={{ '--delay': `${i * 0.12 + 0.3}s` } as React.CSSProperties} aria-hidden="true" />
          )}
          <div className="lp-wf-content">
            <div className="lp-wf-label" style={{ color: accent }}>{label}</div>
            <p className="lp-wf-desc">{desc}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

/* â”€â”€â”€ Sprint Showcase Sub-component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
interface SprintShowcaseProps { onNavigate: () => void; }
const SprintShowcase: React.FC<SprintShowcaseProps> = ({ onNavigate }) => {
  const { ref, inView } = useInView(0.15);
  return (
    <div
      ref={ref as React.Ref<HTMLDivElement>}
      className={`lp-sprint-showcase${inView ? ' lp-sprint-showcase--visible' : ''}`}
    >
      {/* Left: Sprint UI preview */}
      <div className="lp-sprint-preview">
        <div className="lp-sp-header">
          <div className="lp-sp-dots" aria-hidden="true">
            <span style={{ background: '#ef4444' }} />
            <span style={{ background: '#f97316' }} />
            <span style={{ background: '#22c55e' }} />
          </div>
          <span className="lp-sp-url">TracePilot Â· Sprint Dashboard</span>
        </div>

        <div className="lp-sp-body">
          <div className="lp-sp-title-row">
            <span className="lp-sp-sprint-name">Sprint Alpha</span>
            <span className="lp-sp-health"><span className="lp-sp-dot" />ON TRACK</span>
          </div>

          <div className="lp-sp-progress-wrap">
            <div className="lp-sp-prog-bar">
              <div className="lp-sp-prog-fill" style={{ width: '72%' }} />
            </div>
            <span className="lp-sp-prog-val">72%</span>
          </div>

          <div className="lp-sp-stats-grid">
            <div className="lp-sp-stat"><span className="lp-sp-stat-val">24</span><span className="lp-sp-stat-l">Total</span></div>
            <div className="lp-sp-stat"><span className="lp-sp-stat-val lp-sp-stat-green">17</span><span className="lp-sp-stat-l">Done</span></div>
            <div className="lp-sp-stat"><span className="lp-sp-stat-val lp-sp-stat-orange">7</span><span className="lp-sp-stat-l">Left</span></div>
            <div className="lp-sp-stat"><span className="lp-sp-stat-val">240h</span><span className="lp-sp-stat-l">Capacity</span></div>
          </div>

          {/* Mini burndown */}
          <div className="lp-sp-chart-label">
            <Activity size={11} aria-hidden="true" />
            Burndown Chart
            <span className="lp-chart-demo-tag">DEMO</span>
          </div>
          <ResponsiveContainer width="100%" height={90}>
            <LineChart data={burndownData}>
              <Line type="monotone" dataKey="ideal" stroke="#334155" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
              <Line type="monotone" dataKey="actual" stroke="#6366f1" strokeWidth={2} dot={false} />
              <Tooltip
                contentStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', fontSize: 11, color: 'var(--text-primary)' }}
                formatter={(v: number, name: string) => [`${v} pts`, name]}
              />
            </LineChart>
          </ResponsiveContainer>
          <div className="lp-sp-legend">
            <span><span className="lp-sp-legend-dot" style={{ background: '#334155' }} />Ideal</span>
            <span><span className="lp-sp-legend-dot" style={{ background: '#6366f1' }} />Actual</span>
          </div>
        </div>
      </div>

      {/* Right: copy */}
      <div className="lp-sprint-copy">
        <div className="lp-section-badge" style={{ marginBottom: '1.25rem' }}>
          <Clock size={12} aria-hidden="true" />Sprints
        </div>
        <h2 id="sprints-title" className="lp-section-title" style={{ textAlign: 'left' }}>
          Plan Smarter.<br />
          <span className="lp-gradient-text">Deliver Faster.</span>
        </h2>
        <p className="lp-sprint-copy-body">
          TracePilot's sprint management gives your team complete visibility into every iteration â€” from planning to retrospective.
        </p>
        <ul className="lp-sprint-features">
          {[
            'Sprint planning with capacity tracking',
            'Backlog assignment and issue ordering',
            'Real-time sprint health indicators',
            'Ideal vs. actual burndown analytics',
            'Safe issue rollover between sprints',
            'PDF sprint reports for stakeholders',
          ].map((f) => (
            <li key={f}>
              <CheckCircle2 size={15} aria-hidden="true" />
              <span>{f}</span>
            </li>
          ))}
        </ul>
        <button type="button" className="lp-btn lp-btn--primary lp-btn--lg" onClick={onNavigate}>
          Explore Sprint Management
          <ArrowRight size={17} />
        </button>
      </div>
    </div>
  );
};

/* â”€â”€â”€ Product Demo Sub-component [ENHANCEMENT 1] â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
type DemoTab = 'issues' | 'sprint' | 'analytics';

const ProductDemo: React.FC = () => {
  const [activeTab, setActiveTab] = useState<DemoTab>('issues');
  const { ref, inView } = useInView(0.1);

  const tabs: { id: DemoTab; label: string; icon: React.ReactNode }[] = [
    { id: 'issues', label: 'Issue Tracking', icon: <Bug size={15} /> },
    { id: 'sprint', label: 'Sprint Planning', icon: <Activity size={15} /> },
    { id: 'analytics', label: 'Analytics', icon: <BarChart3 size={15} /> },
  ];

  return (
    <div
      ref={ref as React.Ref<HTMLDivElement>}
      className={`lp-demo${inView ? ' lp-demo--visible' : ''}`}
    >
      {/* Tab bar */}
      <div
        className="lp-demo-tabs"
        role="tablist"
        aria-label="Product demo tabs"
      >
        {tabs.map(({ id, label, icon }) => (
          <button
            key={id}
            role="tab"
            type="button"
            id={`tab-${id}`}
            aria-selected={activeTab === id}
            aria-controls={`tabpanel-${id}`}
            className={`lp-demo-tab${activeTab === id ? ' lp-demo-tab--active' : ''}`}
            onClick={() => setActiveTab(id)}
          >
            {icon}
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* Panel */}
      <div className="lp-demo-panel">
        {/* Browser chrome */}
        <div className="lp-demo-chrome">
          <div className="lp-demo-dots" aria-hidden="true">
            <span style={{ background: '#ef4444' }} />
            <span style={{ background: '#f97316' }} />
            <span style={{ background: '#22c55e' }} />
          </div>
          <span className="lp-demo-url">
            TracePilot Â· {activeTab === 'issues' ? 'Issues' : activeTab === 'sprint' ? 'Sprint Dashboard' : 'Analytics'}
          </span>
          <span className="lp-chart-demo-tag">DEMO</span>
        </div>

        {/* Tab panels */}
        <div
          role="tabpanel"
          id={`tabpanel-${activeTab}`}
          aria-labelledby={`tab-${activeTab}`}
          className="lp-demo-content"
          key={activeTab}
        >
          {activeTab === 'issues' && <DemoIssuePanel />}
          {activeTab === 'sprint' && <DemoSprintPanel />}
          {activeTab === 'analytics' && <DemoAnalyticsPanel />}
        </div>
      </div>
    </div>
  );
};

const DemoIssuePanel: React.FC = () => (
  <div className="lp-demo-issues">
    {/* Filter bar */}
    <div className="lp-demo-filter-bar">
      <div className="lp-demo-filter-pill active">All Issues</div>
      <div className="lp-demo-filter-pill">Open</div>
      <div className="lp-demo-filter-pill">In Progress</div>
      <div className="lp-demo-filter-pill">Resolved</div>
    </div>
    {/* Issue rows */}
    {demoIssues.map((issue, i) => (
      <div
        key={issue.key}
        className="lp-demo-issue-row"
        style={{ animationDelay: `${i * 0.07}s` }}
      >
        <div className="lp-demo-issue-key">{issue.key}</div>
        <div className="lp-demo-issue-title">{issue.title}</div>
        <span
          className="lp-demo-badge"
          style={{ background: `${issue.severityColor}18`, color: issue.severityColor, border: `1px solid ${issue.severityColor}35` }}
        >
          {issue.severity}
        </span>
        <span
          className="lp-demo-badge"
          style={{ background: `${issue.statusColor}18`, color: issue.statusColor, border: `1px solid ${issue.statusColor}35` }}
        >
          {issue.status}
        </span>
        <div className="lp-demo-issue-avatar">{issue.assignee}</div>
      </div>
    ))}
  </div>
);

const DemoSprintPanel: React.FC = () => (
  <div className="lp-demo-sprint">
    {/* Sprint header */}
    <div className="lp-demo-sprint-hdr">
      <div>
        <div className="lp-demo-sprint-name">Sprint Alpha</div>
        <div className="lp-demo-sprint-dates">Sep 1 â€“ Sep 14, 2026</div>
      </div>
      <span className="lp-fc-tag lp-fc-tag--green">ON TRACK</span>
    </div>
    {/* Progress */}
    <div className="lp-demo-sprint-prog-wrap">
      <div className="lp-demo-sprint-prog-bar">
        <div className="lp-demo-sprint-prog-fill" />
      </div>
      <span className="lp-demo-sprint-prog-val">72%</span>
    </div>
    {/* Stats */}
    <div className="lp-demo-sprint-stats">
      {[
        { val: '24', label: 'Total', color: '' },
        { val: '17', label: 'Completed', color: '#22c55e' },
        { val: '7', label: 'Remaining', color: '#f59e0b' },
        { val: '250h', label: 'Capacity', color: '' },
        { val: '89pts', label: 'Est. Effort', color: '' },
      ].map(({ val, label, color }) => (
        <div key={label} className="lp-demo-sprint-stat">
          <span className="lp-demo-sprint-stat-val" style={color ? { color } : {}}>{val}</span>
          <span className="lp-demo-sprint-stat-l">{label}</span>
        </div>
      ))}
    </div>
    {/* Team workload */}
    <div className="lp-demo-workload-title">Team Workload</div>
    <div className="lp-demo-workload">
      {demoTeamWorkload.map(({ name, initials, issues, accent }) => (
        <div key={name} className="lp-demo-workload-card">
          <div className="lp-demo-workload-avatar" style={{ background: `linear-gradient(135deg, ${accent}, ${accent}99)` }}>{initials}</div>
          <div className="lp-demo-workload-name">{name}</div>
          <div className="lp-demo-workload-issues" style={{ color: accent }}>{issues} Issues</div>
          <div className="lp-demo-workload-bar-wrap">
            <div className="lp-demo-workload-bar" style={{ width: `${(issues / 8) * 100}%`, background: accent }} />
          </div>
        </div>
      ))}
    </div>
  </div>
);

const DemoAnalyticsPanel: React.FC = () => (
  <div className="lp-demo-analytics">
    <div className="lp-demo-analytics-metrics">
      {[
        { val: '98%', label: 'Resolution Rate', accent: '#6366f1' },
        { val: '24', label: 'Issues Resolved', accent: '#22c55e' },
        { val: '12', label: 'Active Issues', accent: '#f59e0b' },
        { val: '2.4d', label: 'Avg Resolution Time', accent: '#a855f7' },
      ].map(({ val, label, accent }) => (
        <div key={label} className="lp-demo-metric" style={{ '--accent': accent } as React.CSSProperties}>
          <div className="lp-demo-metric-val" style={{ color: accent }}>{val}</div>
          <div className="lp-demo-metric-label">{label}</div>
        </div>
      ))}
    </div>
    <div className="lp-demo-analytics-chart">
      <div className="lp-chart-header" style={{ marginBottom: '0.75rem' }}>
        <span className="lp-chart-title">Resolution Rate Trend</span>
        <span className="lp-chart-demo-tag">SAMPLE DATA</span>
      </div>
      <ResponsiveContainer width="100%" height={120}>
        <LineChart data={resolutionData}>
          <Line type="monotone" dataKey="v" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 3, fill: '#6366f1' }} />
          <Tooltip
            contentStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', fontSize: 11, color: 'var(--text-primary)' }}
            formatter={(v: number) => [`${v}%`, 'Rate']}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  </div>
);

/* â”€â”€â”€ Role Card [ENHANCEMENT 2] â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
interface RoleCardProps {
  icon: React.ReactNode;
  accent: string;
  role: string;
  subtitle: string;
  badge?: string;
  capabilities: string[];
}
const RoleCard: React.FC<RoleCardProps> = ({ icon, accent, role, subtitle, badge, capabilities }) => {
  const { ref, inView } = useInView(0.1);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientY - rect.top) / rect.height - 0.5) * 8;
    const y = -((e.clientX - rect.left) / rect.width - 0.5) * 8;
    setTilt({ x, y });
  };

  return (
    <div
      ref={ref as React.Ref<HTMLDivElement>}
      className={`lp-role-card${inView ? ' lp-role-card--visible' : ''}`}
      style={{
        '--accent': accent,
        transform: `perspective(700px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
      } as React.CSSProperties}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setTilt({ x: 0, y: 0 })}
    >
      {badge && (
        <div className="lp-role-badge-top" style={{ background: `linear-gradient(135deg, ${accent}, ${accent}cc)` }}>
          {badge}
        </div>
      )}
      <div className="lp-role-icon" style={{ color: accent, background: `${accent}18` }}>
        {icon}
      </div>
      <h3 className="lp-role-name">{role}</h3>
      <p className="lp-role-subtitle">{subtitle}</p>
      <ul className="lp-role-caps">
        {capabilities.map((cap) => (
          <li key={cap}>
            <CheckCircle2 size={13} aria-hidden="true" style={{ color: accent, flexShrink: 0 }} />
            <span>{cap}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

/* â”€â”€â”€ Notification Panel [ENHANCEMENT 3] â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
const NotificationPanel: React.FC = () => {
  const { ref, inView } = useInView(0.15);
  return (
    <div
      ref={ref as React.Ref<HTMLDivElement>}
      className={`lp-notif-panel${inView ? ' lp-notif-panel--visible' : ''}`}
      aria-label="Example real-time notifications"
    >
      <div className="lp-notif-header">
        <Bell size={15} aria-hidden="true" />
        <span>Notifications</span>
        <div className="lp-notif-live">
          <span className="lp-live-dot lp-live-dot--sm" aria-hidden="true" />
          LIVE PREVIEW
        </div>
      </div>
      <div className="lp-notif-list">
        {demoNotifications.map(({ icon, title, body, time, accent, unread }, i) => (
          <div
            key={title}
            className={`lp-notif-item${unread ? ' lp-notif-item--unread' : ''}`}
            style={{
              animationDelay: inView ? `${i * 0.12}s` : '0s',
              borderLeftColor: unread ? accent : 'transparent',
            }}
          >
            <div className="lp-notif-icon" style={{ background: `${accent}18`, color: accent }}>{icon}</div>
            <div className="lp-notif-body">
              <div className="lp-notif-title">{title}{unread && <span className="lp-notif-dot" style={{ background: accent }} />}</div>
              <div className="lp-notif-msg">{body}</div>
              <div className="lp-notif-time">{time}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="lp-notif-footer">
        <BookOpen size={12} aria-hidden="true" />
        Example real-time events â€” live notifications available after sign-in
      </div>
    </div>
  );
};

export default HomePage;

