import React, { useState, useEffect, useRef } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import {
  Activity, AlertTriangle, ArrowRight, BarChart3, Bell, Bug,
  CheckCircle2, ClipboardList, Code2, Crown, FileText,
  GitBranch, Lock, LogIn, Menu, Moon,
  PlayCircle, Shield, ShieldCheck, Sun, Target,
  TrendingUp, Users, Wifi, X, Zap,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../context/ThemeContext';
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { TracePilotLogo } from '../components/common/TracePilotLogo';
import '../components/home/home.css';

/* ── Scroll-reveal hook ── */
function useReveal(threshold = 0.12) {
  const ref = useRef<HTMLElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setInView(true); obs.disconnect(); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, inView };
}

function Reveal({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const { ref, inView } = useReveal();
  return (
    <div
      ref={ref as React.Ref<HTMLDivElement>}
      className={`hp-reveal ${inView ? 'hp-in-view' : ''} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

/* ── Demo data (clearly labelled — not production data) ── */
const DEMO_ISSUES = [
  { key: 'BUG-1024', title: 'Login authentication failure', severity: 'CRITICAL', sevBg: 'rgba(239,68,68,0.15)', sevColor: '#ef4444' },
  { key: 'BUG-1025', title: 'Dashboard chart not loading', severity: 'HIGH', sevBg: 'rgba(249,115,22,0.15)', sevColor: '#f97316' },
  { key: 'BUG-1026', title: 'File upload timeout error', severity: 'MEDIUM', sevBg: 'rgba(245,158,11,0.15)', sevColor: '#f59e0b' },
];
const DEMO_RES_DATA = [
  { w: 'W1', v: 62 }, { w: 'W2', v: 71 }, { w: 'W3', v: 68 },
  { w: 'W4', v: 79 }, { w: 'W5', v: 85 }, { w: 'W6', v: 91 },
  { w: 'W7', v: 88 }, { w: 'W8', v: 95 }, { w: 'W9', v: 98 },
];
const DEMO_BURNDOWN = [
  { d: 'D1', ideal: 38, actual: 38 }, { d: 'D2', ideal: 32, actual: 34 },
  { d: 'D3', ideal: 26, actual: 29 }, { d: 'D4', ideal: 20, actual: 22 },
  { d: 'D5', ideal: 14, actual: 18 }, { d: 'D6', ideal: 8, actual: 12 },
  { d: 'D7', ideal: 2, actual: 7 },
];

/* ══════════════════════════════════════
   DASHBOARD PREVIEW (hero right panel)
═══════════════════════════════════════ */
function DashboardPreview() {
  const health = [
    { label: 'Critical', count: 3, pct: 12, color: '#ef4444' },
    { label: 'High',     count: 7, pct: 29, color: '#f97316' },
    { label: 'Medium',   count: 11, pct: 46, color: '#f59e0b' },
    { label: 'Low',      count: 3, pct: 12, color: '#818cf8' },
  ];
  return (
    <div className="hp-hero-right hp-anim-hero-right">
      <div className="hp-dashboard-glow" aria-hidden="true" />
      <div className="hp-dashboard-frame" role="img" aria-label="TracePilot dashboard preview — sample data">
        {/* Window chrome */}
        <div className="hp-db-topbar">
          <div className="hp-db-dot hp-db-dot-red" aria-hidden="true" />
          <div className="hp-db-dot hp-db-dot-amber" aria-hidden="true" />
          <div className="hp-db-dot hp-db-dot-green" aria-hidden="true" />
          <span className="hp-db-title">TracePilot &mdash; Dashboard</span>
          <span className="hp-db-live-badge">
            <span className="hp-db-live-dot" aria-hidden="true" />DEMO
          </span>
        </div>
        <div className="hp-db-body">
          {/* Stats */}
          <div className="hp-db-stats">
            {[{ val: '24', label: 'Issues' }, { val: '17', label: 'Resolved' }, { val: '7', label: 'Open' }, { val: '86%', label: 'Sprint' }].map(s => (
              <div key={s.label} className="hp-db-stat">
                <div className="hp-db-stat-val">{s.val}</div>
                <div className="hp-db-stat-label">{s.label}</div>
              </div>
            ))}
          </div>
          {/* Health bars */}
          <div className="hp-db-section-label">Issue Health</div>
          <div className="hp-db-health-bars">
            {health.map(h => (
              <div key={h.label} className="hp-db-health-row">
                <span className="hp-db-health-label">{h.label}</span>
                <div className="hp-db-health-bar">
                  <div className="hp-db-health-fill" style={{ width: `${h.pct}%`, background: h.color }} />
                </div>
                <span className="hp-db-health-count">{h.count}</span>
              </div>
            ))}
          </div>
          {/* Issues */}
          <div className="hp-db-section-label">Recent Issues</div>
          <div className="hp-db-issue-rows">
            {DEMO_ISSUES.map(i => (
              <div key={i.key} className="hp-db-issue-row">
                <span className="hp-db-issue-key">{i.key}</span>
                <span className="hp-db-issue-title">{i.title}</span>
                <span className="hp-db-badge" style={{ background: i.sevBg, color: i.sevColor }}>{i.severity}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* Floating cards */}
      <div className="hp-float-card hp-float-1">
        <div className="hp-float-card-icon" style={{ background: 'rgba(239,68,68,0.1)' }}>
          <AlertTriangle size={14} color="#ef4444" aria-hidden="true" />
        </div>
        <div><div>3 Critical Issues</div><div className="hp-float-card-sub">Needs attention</div></div>
      </div>
      <div className="hp-float-card hp-float-2">
        <div className="hp-float-card-icon" style={{ background: 'rgba(34,197,94,0.1)' }}>
          <TrendingUp size={14} color="#22c55e" aria-hidden="true" />
        </div>
        <div><div>86% Sprint Health</div><div className="hp-float-card-sub">On track</div></div>
      </div>
      <div className="hp-float-card hp-float-3">
        <div className="hp-float-card-icon" style={{ background: 'rgba(99,102,241,0.1)' }}>
          <CheckCircle2 size={14} color="#818cf8" aria-hidden="true" />
        </div>
        <div><div>17 Resolved</div><div className="hp-float-card-sub">This sprint</div></div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════
   NAVBAR
═══════════════════════════════════════ */
function Navbar({ onNav, onSignIn, onGetStarted, user, isAuthenticated, dashboardPath }: {
  onNav: (id: string) => void;
  onSignIn: () => void;
  onGetStarted: () => void;
  user: { role: string } | null;
  isAuthenticated: boolean;
  dashboardPath: string;
}) {
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', h, { passive: true });
    return () => window.removeEventListener('scroll', h);
  }, []);

  const navLinks = [
    { id: 'features', label: 'Features' },
    { id: 'workflow', label: 'Workflow' },
    { id: 'analytics', label: 'Analytics' },
    { id: 'sprints', label: 'Sprints' },
  ];

  return (
    <>
      <nav className={`hp-nav${scrolled ? ' hp-nav--scrolled' : ''}`} aria-label="Main navigation">
        <div className="hp-nav-inner">
          <button className="hp-nav-brand" onClick={() => onNav('home')} aria-label="TracePilot home">
            <TracePilotLogo size={28} />
            <span className="hp-nav-brand-name">TracePilot</span>
          </button>
          <div className="hp-nav-links">
            {navLinks.map(l => (
              <button key={l.id} className="hp-nav-link" onClick={() => onNav(l.id)}>{l.label}</button>
            ))}
          </div>
          <div className="hp-nav-actions">
            <button className="hp-theme-btn" onClick={toggleTheme} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
              {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            </button>
            {isAuthenticated && user ? (
              <button className="hp-btn-primary" onClick={() => navigate(dashboardPath)}>
                Dashboard <ArrowRight size={14} />
              </button>
            ) : (
              <>
                <button className="hp-btn-ghost" onClick={onSignIn}><LogIn size={14} /> Sign In</button>
                <button className="hp-btn-primary" onClick={onGetStarted}>Get Started <ArrowRight size={14} /></button>
              </>
            )}
            <button className="hp-nav-mobile-btn" onClick={() => setMobileOpen(v => !v)} aria-label="Toggle menu" aria-expanded={mobileOpen}>
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </nav>

      {mobileOpen && (
        <div className="hp-nav-mobile-menu">
          {navLinks.map(l => (
            <button key={l.id} className="hp-nav-mobile-link" onClick={() => { onNav(l.id); setMobileOpen(false); }}>{l.label}</button>
          ))}
          <hr style={{ border: 'none', borderTop: '1px solid var(--hp-border)', margin: '0.25rem 0' }} />
          {isAuthenticated && user ? (
            <button className="hp-nav-mobile-link" onClick={() => { navigate(dashboardPath); setMobileOpen(false); }}>Dashboard</button>
          ) : (
            <>
              <button className="hp-nav-mobile-link" onClick={() => { onSignIn(); setMobileOpen(false); }}>Sign In</button>
              <button className="hp-btn-primary hp-btn-lg" style={{ marginTop: '0.5rem', width: '100%', justifyContent: 'center' }} onClick={() => { onGetStarted(); setMobileOpen(false); }}>
                Get Started
              </button>
            </>
          )}
        </div>
      )}
    </>
  );
}

/* ══════════════════════════════════════
   HERO
═══════════════════════════════════════ */
function HeroSection({ onGetStarted, onExplore }: { onGetStarted: () => void; onExplore: () => void }) {
  return (
    <section className="hp-section hp-hero" id="home" aria-labelledby="hero-h1">
      <div className="hp-hero-grid">
        <div className="hp-hero-left hp-anim-hero-left">
          <div className="hp-eyebrow">Intelligent Software Management</div>
          <h1 className="hp-hero-h1" id="hero-h1">
            Track Bugs.<br />
            <span className="hp-hero-accent">Ship Better</span><br />
            Software.
          </h1>
          <p className="hp-hero-sub">
            TracePilot brings issues, projects, Agile sprints, analytics, and real-time collaboration into one powerful workspace.
          </p>
          <div className="hp-hero-actions">
            <button className="hp-btn-primary hp-btn-lg" onClick={onGetStarted}>
              Get Started Free <ArrowRight size={16} aria-hidden="true" />
            </button>
            <button className="hp-btn-secondary hp-btn-lg" onClick={onExplore}>
              Explore Product
            </button>
          </div>
          <div className="hp-hero-pills">
            <span className="hp-hero-pill"><Zap size={13} aria-hidden="true" /> No complex setup</span>
            <span className="hp-hero-pill"><Shield size={13} aria-hidden="true" /> Role-based access</span>
            <span className="hp-hero-pill"><Wifi size={13} aria-hidden="true" /> Real-time collaboration</span>
          </div>
        </div>
        <DashboardPreview />
      </div>
    </section>
  );
}

/* ══════════════════════════════════════
   CAPABILITY STRIP
═══════════════════════════════════════ */
function CapabilityStrip() {
  const caps = [
    { icon: <Bug size={14} aria-hidden="true" />, label: 'Issue Tracking' },
    { icon: <GitBranch size={14} aria-hidden="true" />, label: 'Sprint Management' },
    { icon: <BarChart3 size={14} aria-hidden="true" />, label: 'Analytics' },
    { icon: <Bell size={14} aria-hidden="true" />, label: 'Notifications' },
    { icon: <ShieldCheck size={14} aria-hidden="true" />, label: 'Role-Based Access' },
  ];
  return (
    <div className="hp-strip">
      <div className="hp-strip-inner">
        {caps.map((c, i) => (
          <React.Fragment key={c.label}>
            <span className="hp-strip-item">{c.icon} {c.label}</span>
            {i < caps.length - 1 && <span className="hp-strip-sep" aria-hidden="true" />}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════
   FEATURES BENTO
═══════════════════════════════════════ */
function FeaturesBento() {
  const miniSprints = [
    { name: 'Sprint Alpha', pct: 86 },
    { name: 'Sprint Beta', pct: 54 },
    { name: 'Sprint Gamma', pct: 100 },
  ];
  const miniNotifs = [
    { icon: <PlayCircle size={12} color="#6366f1" aria-hidden="true" />, bg: 'rgba(99,102,241,0.1)', title: 'Sprint Started', sub: 'Sprint Alpha is ACTIVE' },
    { icon: <CheckCircle2 size={12} color="#22c55e" aria-hidden="true" />, bg: 'rgba(34,197,94,0.1)', title: 'Issue Resolved', sub: 'BUG-1024 resolved' },
    { icon: <Bell size={12} color="#f59e0b" aria-hidden="true" />, bg: 'rgba(245,158,11,0.1)', title: 'New Assignment', sub: 'BUG-1028 assigned' },
  ];

  return (
    <section className="hp-section hp-section-gap" id="features" aria-labelledby="features-h2">
      <Reveal>
        <div className="hp-eyebrow">Platform Features</div>
        <h2 className="hp-h2" id="features-h2">Everything Your Engineering<br />Team Needs</h2>
        <p className="hp-h2-sub" style={{ marginBottom: '2.5rem' }}>
          From defect reporting to sprint delivery, TracePilot connects the entire software workflow.
        </p>
      </Reveal>

      <div className="hp-bento">
        {/* Card 1 — Issue Tracking (large) */}
        <Reveal delay={0} className="hp-bento-c1">
          <div className="hp-bento-card" style={{ height: '100%' }}>
            <div className="hp-bento-chip"><Bug size={10} aria-hidden="true" /> Issue Tracking</div>
            <h3 className="hp-bento-title">Intelligent Issue Tracking</h3>
            <p className="hp-bento-desc">
              Track bugs, tasks, and feature requests with powerful filtering, priority management,
              severity classification, comments, attachments, and workflow transitions.
            </p>
            <div className="hp-mini-table">
              <div className="hp-mini-table-row" style={{ background: 'rgba(99,102,241,0.04)', fontWeight: 700, fontSize: '0.62rem', color: 'var(--hp-text-3)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                <span style={{ minWidth: '52px' }}>Key</span><span style={{ flex: 1 }}>Title</span><span>Severity</span>
              </div>
              {DEMO_ISSUES.map(i => (
                <div key={i.key} className="hp-mini-table-row">
                  <span className="hp-mini-table-key">{i.key}</span>
                  <span className="hp-mini-table-title">{i.title}</span>
                  <span className="hp-db-badge" style={{ background: i.sevBg, color: i.sevColor }}>{i.severity}</span>
                </div>
              ))}
            </div>
          </div>
        </Reveal>

        {/* Card 2 — Sprint Management */}
        <Reveal delay={60} className="hp-bento-c2">
          <div className="hp-bento-card" style={{ height: '100%' }}>
            <div className="hp-bento-chip"><GitBranch size={10} aria-hidden="true" /> Sprints</div>
            <h3 className="hp-bento-title">Agile Sprint Management</h3>
            <p className="hp-bento-desc">Plan sprints, assign backlog issues, track capacity, and safely roll over unfinished work.</p>
            <div className="hp-mini-sprint">
              {miniSprints.map(s => (
                <div key={s.name} className="hp-mini-sprint-row">
                  <div className="hp-mini-sprint-label">
                    <span>{s.name}</span>
                    <span style={{ color: s.pct === 100 ? '#22c55e' : 'var(--hp-text-3)' }}>{s.pct}%</span>
                  </div>
                  <div className="hp-mini-sprint-bar">
                    <div className="hp-mini-sprint-fill" style={{ width: `${s.pct}%`, background: s.pct === 100 ? '#22c55e' : '#6366f1' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Reveal>

        {/* Card 3 — Analytics */}
        <Reveal delay={0} className="hp-bento-c3">
          <div className="hp-bento-card">
            <div className="hp-bento-chip"><BarChart3 size={10} aria-hidden="true" /> Analytics</div>
            <h3 className="hp-bento-title">Real-Time Analytics</h3>
            <p className="hp-bento-desc">Monitor issue trends, resolution performance, and sprint health.</p>
            <div style={{ height: '60px' }} aria-hidden="true">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={DEMO_RES_DATA}><Line type="monotone" dataKey="v" stroke="#6366f1" strokeWidth={2} dot={false} /></LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Reveal>

        {/* Card 4 — Notifications */}
        <Reveal delay={60} className="hp-bento-c4">
          <div className="hp-bento-card">
            <div className="hp-bento-chip"><Bell size={10} aria-hidden="true" /> Notifications</div>
            <h3 className="hp-bento-title">Real-Time Notifications</h3>
            <p className="hp-bento-desc">Stay informed about important issue and sprint activities.</p>
            <div className="hp-mini-notifs">
              {miniNotifs.map(n => (
                <div key={n.title} className="hp-mini-notif-item">
                  <div className="hp-mini-notif-icon" style={{ background: n.bg }}>{n.icon}</div>
                  <div>
                    <div className="hp-mini-notif-title">{n.title}</div>
                    <div className="hp-mini-notif-sub">{n.sub}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Reveal>

        {/* Card 5 — Roles */}
        <Reveal delay={120} className="hp-bento-c5">
          <div className="hp-bento-card">
            <div className="hp-bento-chip"><Shield size={10} aria-hidden="true" /> Access</div>
            <h3 className="hp-bento-title">Role-Based Workflows</h3>
            <p className="hp-bento-desc">Secure workflows with dedicated permissions for each team role.</p>
            <div className="hp-mini-roles">
              {[
                { label: 'Admin', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
                { label: 'Developer', color: '#6366f1', bg: 'rgba(99,102,241,0.1)' },
                { label: 'User', color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
              ].map(r => (
                <span key={r.label} className="hp-mini-role-pill" style={{ borderColor: r.color + '33', background: r.bg, color: r.color }}>{r.label}</span>
              ))}
            </div>
          </div>
        </Reveal>

        {/* Card 6 — Audit */}
        <Reveal delay={60} className="hp-bento-c6">
          <div className="hp-bento-card">
            <div className="hp-bento-chip"><FileText size={10} aria-hidden="true" /> Reporting</div>
            <h3 className="hp-bento-title">Audit &amp; Reporting</h3>
            <p className="hp-bento-desc">Trace important system operations and generate useful reports for compliance and retrospectives.</p>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
              {['Audit Log', 'PDF Reports', 'Activity Trail', 'Export'].map(t => (
                <span key={t} style={{ fontSize: '0.68rem', padding: '0.2rem 0.5rem', border: '1px solid var(--hp-border)', borderRadius: '5px', color: 'var(--hp-text-3)', background: 'var(--hp-surface2)' }}>{t}</span>
              ))}
            </div>
          </div>
        </Reveal>

        {/* Card 7 — Backlog */}
        <Reveal delay={120} className="hp-bento-c7">
          <div className="hp-bento-card">
            <div className="hp-bento-chip"><ClipboardList size={10} aria-hidden="true" /> Backlog</div>
            <h3 className="hp-bento-title">Backlog &amp; Project Management</h3>
            <p className="hp-bento-desc">
              Organize issues across multiple projects. Prioritize the backlog, manage sprints, and track deliverables from one unified view.
              Every project has its own issue queue, sprint history, and analytics dashboard.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════
   WORKFLOW SECTION
═══════════════════════════════════════ */
function WorkflowSection() {
  const steps = [
    { num: '01', label: 'Backlog', icon: <ClipboardList size={18} color="#6366f1" />, desc: 'Issues and feature requests collected and prioritized.' },
    { num: '02', label: 'Sprint Planning', icon: <Target size={18} color="#6366f1" />, desc: 'Select backlog items, estimate effort, and assign capacity.' },
    { num: '03', label: 'Active Sprint', icon: <Activity size={18} color="#6366f1" />, desc: 'Development work progresses through the sprint.' },
    { num: '04', label: 'Issue Resolution', icon: <CheckCircle2 size={18} color="#6366f1" />, desc: 'Issues investigated, fixed, reviewed, and resolved.' },
    { num: '05', label: 'Analytics', icon: <BarChart3 size={18} color="#6366f1" />, desc: 'Velocity, burndown, and sprint health reviewed.' },
    { num: '06', label: 'Release', icon: <Zap size={18} color="#6366f1" />, desc: 'Sprint completed. Next iteration begins.' },
  ];
  return (
    <section className="hp-section hp-section-gap" id="workflow" aria-labelledby="workflow-h2">
      <Reveal>
        <div className="hp-eyebrow">Product Workflow</div>
        <h2 className="hp-h2" id="workflow-h2">From Backlog to Release</h2>
        <p className="hp-h2-sub" style={{ marginBottom: '2.5rem' }}>A structured path from planning to delivery.</p>
      </Reveal>
      <Reveal delay={100}>
        <div className="hp-workflow-steps">
          {steps.map(s => (
            <div key={s.num} className="hp-workflow-step">
              <div className="hp-workflow-num">{s.num}</div>
              <div className="hp-workflow-icon" aria-hidden="true">{s.icon}</div>
              <div className="hp-workflow-step-title">{s.label}</div>
              <div className="hp-workflow-step-desc">{s.desc}</div>
            </div>
          ))}
        </div>
      </Reveal>
    </section>
  );
}

/* ══════════════════════════════════════
   SPRINT SHOWCASE
═══════════════════════════════════════ */
function SprintShowcase() {
  const features = ['Sprint planning', 'Capacity tracking', 'Backlog assignment', 'Issue ordering', 'Sprint health', 'Burndown analytics', 'Issue rollover', 'Sprint reports'];
  return (
    <section className="hp-section hp-section-gap" id="sprints" aria-labelledby="sprints-h2">
      <div className="hp-split">
        <Reveal>
          <div>
            <div className="hp-eyebrow">Sprint Management</div>
            <h2 className="hp-split-title" id="sprints-h2">Plan Smarter.<br />Deliver Faster.</h2>
            <p style={{ fontSize: '0.95rem', color: 'var(--hp-text-2)', lineHeight: 1.7, marginBottom: '0.5rem' }}>
              TracePilot's sprint management gives teams visibility into planning, capacity, issue progress, and delivery health.
            </p>
            <ul className="hp-feature-list">
              {features.map(f => <li key={f}><CheckCircle2 size={14} aria-hidden="true" /> {f}</li>)}
            </ul>
          </div>
        </Reveal>
        <Reveal delay={150}>
          <div className="hp-sprint-card" role="img" aria-label="Sample sprint dashboard">
            <div className="hp-sprint-header">
              <span className="hp-sprint-name">Sprint Alpha</span>
              <span className="hp-demo-label">SAMPLE DATA</span>
              <span className="hp-sprint-status">ON TRACK</span>
            </div>
            <div className="hp-sprint-ring-wrap">
              <div className="hp-sprint-ring" aria-label="72% complete"><span className="hp-sprint-ring-val">72%</span></div>
              <div className="hp-sprint-stats-grid">
                {[{ val: '24', label: 'Total' }, { val: '17', label: 'Done' }, { val: '7', label: 'Left' }, { val: '240h', label: 'Capacity' }].map(s => (
                  <div key={s.label} className="hp-sprint-stat-box">
                    <div className="hp-sprint-stat-val">{s.val}</div>
                    <div className="hp-sprint-stat-label">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--hp-text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Burndown</span>
                <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.65rem', color: 'var(--hp-text-3)' }}>
                  <span><span style={{ width: 10, height: 2, background: 'rgba(255,255,255,0.2)', display: 'inline-block', borderRadius: 1, marginRight: 4 }} />Ideal</span>
                  <span><span style={{ width: 10, height: 2, background: '#6366f1', display: 'inline-block', borderRadius: 1, marginRight: 4 }} />Actual</span>
                </div>
              </div>
              <div style={{ height: '80px' }} aria-hidden="true">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={DEMO_BURNDOWN}>
                    <XAxis dataKey="d" tick={{ fontSize: 9, fill: 'var(--hp-text-3)' }} axisLine={false} tickLine={false} />
                    <Line type="monotone" dataKey="ideal" stroke="rgba(255,255,255,0.18)" strokeWidth={1.5} dot={false} strokeDasharray="4 4" />
                    <Line type="monotone" dataKey="actual" stroke="#6366f1" strokeWidth={2} dot={false} />
                    <Tooltip contentStyle={{ background: 'var(--hp-surface2)', border: '1px solid var(--hp-border)', borderRadius: 6, fontSize: '0.72rem' }} labelStyle={{ color: 'var(--hp-text-3)' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════
   ANALYTICS SHOWCASE
═══════════════════════════════════════ */
function AnalyticsShowcase() {
  const metrics = [
    { val: '98%', label: 'Resolution Rate', color: '#22c55e' },
    { val: '24',  label: 'Active Issues',   color: '#6366f1' },
    { val: '12',  label: 'Projects',        color: '#818cf8' },
    { val: '86%', label: 'Sprint Completion', color: '#f59e0b' },
  ];
  return (
    <section className="hp-section hp-section-gap" id="analytics" aria-labelledby="analytics-h2">
      <Reveal>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
          <div>
            <div className="hp-eyebrow">Analytics</div>
            <h2 className="hp-h2" id="analytics-h2">See Everything.<br />Fix Faster.</h2>
            <p className="hp-h2-sub">Understand project health through actionable issue, sprint, and resolution metrics.</p>
          </div>
          <span className="hp-demo-label" style={{ marginTop: '0.5rem' }}>SAMPLE DATA</span>
        </div>
      </Reveal>
      <Reveal delay={100}>
        <div className="hp-analytics-metrics">
          {metrics.map(m => (
            <div key={m.label} className="hp-metric-card">
              <div className="hp-metric-val" style={{ color: m.color }}>{m.val}</div>
              <div className="hp-metric-label">{m.label}</div>
            </div>
          ))}
        </div>
      </Reveal>
      <Reveal delay={200}>
        <div className="hp-chart-card">
          <div className="hp-chart-header">
            <div>
              <div className="hp-chart-title">Resolution Rate Trend</div>
              <div className="hp-chart-sub">Weekly resolution rate across projects</div>
            </div>
          </div>
          <div style={{ height: '180px' }} aria-hidden="true">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={DEMO_RES_DATA}>
                <XAxis dataKey="w" tick={{ fontSize: 10, fill: 'var(--hp-text-3)' }} axisLine={false} tickLine={false} />
                <Line type="monotone" dataKey="v" stroke="#6366f1" strokeWidth={2.5} dot={{ fill: '#6366f1', r: 3 }} />
                <Tooltip contentStyle={{ background: 'var(--hp-surface2)', border: '1px solid var(--hp-border)', borderRadius: 6, fontSize: '0.78rem' }} labelStyle={{ color: 'var(--hp-text-3)' }} formatter={(val: number) => [`${val}%`, 'Resolution Rate']} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

/* ══════════════════════════════════════
   ROLES
═══════════════════════════════════════ */
function RoleSection() {
  const roles = [
    {
      tag: 'Administrator', title: 'Admin', subtitle: 'Full system control',
      icon: <Crown size={22} aria-hidden="true" />,
      perms: ['Manage users and permissions', 'Create and manage projects', 'Plan and oversee sprints', 'Monitor system analytics', 'Review audit activity', 'Manage workflows'],
    },
    {
      tag: 'Developer', title: 'Developer', subtitle: 'Build. Fix. Deliver.',
      icon: <Code2 size={22} aria-hidden="true" />,
      perms: ['Investigate reported defects', 'Work on assigned issues', 'Update issue progress', 'Validate fixes', 'Manage sprint work', 'Collaborate through comments'],
    },
    {
      tag: 'User', title: 'User', subtitle: 'Report. Track. Verify.',
      icon: <Users size={22} aria-hidden="true" />,
      perms: ['Submit detailed issues', 'Track resolution progress', 'Add comments', 'Upload screenshots', 'Receive notifications', 'Verify reported fixes'],
    },
  ];
  return (
    <section className="hp-section hp-section-gap" aria-labelledby="roles-h2">
      <Reveal>
        <div className="hp-eyebrow">Role-Based Access</div>
        <h2 className="hp-h2" id="roles-h2">Built for Every Role<br />in Your Software Team</h2>
        <p className="hp-h2-sub" style={{ marginBottom: '2.5rem' }}>
          Dedicated workflows and permissions for administrators, developers, and users.
        </p>
      </Reveal>
      <div className="hp-roles-grid">
        {roles.map((r, i) => (
          <Reveal key={r.title} delay={i * 80}>
            <div className="hp-role-card">
              <div className="hp-role-icon">{r.icon}</div>
              <div className="hp-role-tag">{r.tag}</div>
              <h3 className="hp-role-title">{r.title}</h3>
              <p className="hp-role-subtitle">{r.subtitle}</p>
              <ul className="hp-role-perms">
                {r.perms.map(p => <li key={p}><CheckCircle2 size={13} aria-hidden="true" /> {p}</li>)}
              </ul>
              <span className="hp-role-badge"><Lock size={9} aria-hidden="true" /> Role-Based Access</span>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ══════════════════════════════════════
   REALTIME SECTION
═══════════════════════════════════════ */
function RealtimeSection() {
  const notifs = [
    { icon: <PlayCircle size={16} aria-hidden="true" />, bg: 'rgba(99,102,241,0.15)',   color: '#818cf8', title: 'Sprint Started',        body: 'Sprint Alpha is now ACTIVE.', time: 'Just now',       unread: true },
    { icon: <CheckCircle2 size={16} aria-hidden="true" />, bg: 'rgba(34,197,94,0.15)', color: '#22c55e', title: 'Issue Resolved',         body: 'BUG-1024 was resolved.',      time: '2 minutes ago',  unread: true },
    { icon: <Activity size={16} aria-hidden="true" />,     bg: 'rgba(14,165,233,0.15)', color: '#38bdf8', title: 'Sprint Health Updated',  body: 'Sprint Alpha is ON TRACK.',   time: '5 minutes ago',  unread: false },
    { icon: <Bell size={16} aria-hidden="true" />,         bg: 'rgba(245,158,11,0.15)', color: '#f59e0b', title: 'New Issue Assigned',     body: 'BUG-1028 assigned to you.',   time: '12 minutes ago', unread: false },
  ];
  return (
    <section className="hp-section hp-section-gap" aria-labelledby="realtime-h2">
      <Reveal>
        <div className="hp-eyebrow">Real-Time</div>
        <h2 className="hp-h2" id="realtime-h2">Stay Updated.<br />In Real Time.</h2>
        <p className="hp-h2-sub" style={{ marginBottom: '2.5rem' }}>
          Important project events are delivered instantly so teams stay synchronized.
        </p>
      </Reveal>
      <div className="hp-realtime-split">
        <Reveal>
          <div className="hp-notif-timeline">
            {notifs.map(n => (
              <div key={n.title} className="hp-notif-item">
                <div className="hp-notif-icon-wrap" style={{ background: n.bg, color: n.color }}>{n.icon}</div>
                <div className="hp-notif-body">
                  <div className="hp-notif-title">{n.title}</div>
                  <div className="hp-notif-sub">{n.body}</div>
                  <div className="hp-notif-time">{n.time}</div>
                </div>
                {n.unread && <div className="hp-notif-unread" aria-label="Unread" />}
              </div>
            ))}
          </div>
        </Reveal>
        <Reveal delay={120}>
          <div className="hp-live-panel">
            <div className="hp-live-panel-header">
              <span className="hp-live-badge"><span className="hp-live-dot" aria-hidden="true" />CAPABILITY PREVIEW</span>
              <span className="hp-live-panel-title">Activity Feed</span>
            </div>
            <div className="hp-live-panel-body">
              <div className="hp-live-ws-indicator"><Wifi size={14} aria-hidden="true" /> WebSocket Connected</div>
              {[
                { label: 'Issue Updates', desc: 'Status changes, comments' },
                { label: 'Sprint Events', desc: 'Start, complete, health' },
                { label: 'Comments', desc: 'New replies and mentions' },
                { label: 'Assignments', desc: 'Issue assignments' },
              ].map(ch => (
                <div key={ch.label} className="hp-live-channel">
                  <div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--hp-text)' }}>{ch.label}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--hp-text-3)' }}>{ch.desc}</div>
                  </div>
                  <span className="hp-live-channel-badge">ACTIVE</span>
                </div>
              ))}
              <p className="hp-preview-disclaimer">
                This panel illustrates the capability. The homepage itself does not receive live events.
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════
   PLATFORM GRID
═══════════════════════════════════════ */
function PlatformSection() {
  const items = [
    { icon: <Bug size={18} aria-hidden="true" />,          title: 'Issue Tracking',    desc: 'Report, triage, and resolve defects with full workflow support.' },
    { icon: <GitBranch size={18} aria-hidden="true" />,    title: 'Sprint Management', desc: 'Plan, execute, and retrospect Agile sprints.' },
    { icon: <BarChart3 size={18} aria-hidden="true" />,    title: 'Analytics',         desc: 'Resolution trends, sprint health, and workload insights.' },
    { icon: <Bell size={18} aria-hidden="true" />,         title: 'Notifications',     desc: 'Real-time alerts for issues, sprints, and assignments.' },
    { icon: <ShieldCheck size={18} aria-hidden="true" />,  title: 'Security',          desc: 'Role-based access control with JWT authentication.' },
    { icon: <FileText size={18} aria-hidden="true" />,     title: 'Audit Trail',       desc: 'Complete log of all system operations for compliance.' },
  ];
  return (
    <section className="hp-section hp-section-gap" aria-labelledby="platform-h2">
      <Reveal>
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <h2 className="hp-h2" id="platform-h2">One Platform.<br />Every Capability.</h2>
        </div>
      </Reveal>
      <Reveal delay={100}>
        <div className="hp-platform-grid">
          {items.map(i => (
            <div key={i.title} className="hp-platform-item">
              <div className="hp-platform-icon">{i.icon}</div>
              <div className="hp-platform-title">{i.title}</div>
              <div className="hp-platform-desc">{i.desc}</div>
            </div>
          ))}
        </div>
      </Reveal>
    </section>
  );
}

/* ══════════════════════════════════════
   WHY TRACEPILOT
═══════════════════════════════════════ */
function WhySection() {
  const reasons = [
    { num: '01', title: 'One Workspace',       desc: 'Projects, issues, sprints, analytics, and collaboration in one place. No context switching.' },
    { num: '02', title: 'Real-Time Visibility', desc: 'Understand what is happening across your software workflow as it happens.' },
    { num: '03', title: 'Smarter Delivery',    desc: 'Use workflow and analytics data to continuously improve team delivery.' },
  ];
  return (
    <div style={{ borderTop: '1px solid var(--hp-border)' }}>
      <div className="hp-section hp-section-gap" aria-labelledby="why-h2">
        <Reveal>
          <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
            <div className="hp-eyebrow">Why TracePilot</div>
            <h2 className="hp-h2" id="why-h2">Built on Three Principles</h2>
          </div>
        </Reveal>
        <Reveal delay={100}>
          <div className="hp-why-grid">
            {reasons.map(r => (
              <div key={r.num} className="hp-why-item">
                <div className="hp-why-num" aria-hidden="true">{r.num}</div>
                <h3 className="hp-why-title">{r.title}</h3>
                <p className="hp-why-desc">{r.desc}</p>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════
   CTA
═══════════════════════════════════════ */
function CTASection({ onGetStarted, onDashboard }: { onGetStarted: () => void; onDashboard: () => void }) {
  return (
    <div className="hp-cta-section" aria-labelledby="cta-h2">
      <div className="hp-cta-bg" aria-hidden="true" />
      <div className="hp-cta-glow" aria-hidden="true" />
      <Reveal>
        <div className="hp-cta-inner">
          <div className="hp-eyebrow">Ready When You Are</div>
          <h2 className="hp-cta-h2" id="cta-h2">Ready to Build Better<br />Software?</h2>
          <p className="hp-cta-sub">Bring your team, projects, issues, and sprints together in one intelligent workspace.</p>
          <div className="hp-cta-actions">
            <button className="hp-btn-primary hp-btn-lg" onClick={onGetStarted}>
              Get Started Free <ArrowRight size={16} aria-hidden="true" />
            </button>
            <button className="hp-btn-secondary hp-btn-lg" onClick={onDashboard}>View Dashboard</button>
          </div>
        </div>
      </Reveal>
    </div>
  );
}

/* ══════════════════════════════════════
   FOOTER
═══════════════════════════════════════ */
function Footer({ onNav }: { onNav: (id: string) => void }) {
  const navigate = useNavigate();
  return (
    <footer className="hp-footer" aria-label="Site footer">
      <div className="hp-footer-inner">
        <div className="hp-footer-grid">
          <div>
            <button className="hp-footer-brand" onClick={() => onNav('home')} aria-label="TracePilot home">
              <TracePilotLogo size={24} /><span className="hp-footer-brand-name">TracePilot</span>
            </button>
            <p className="hp-footer-tagline">Intelligent software management for modern engineering teams.</p>
          </div>
          <div>
            <div className="hp-footer-col-title">Product</div>
            <ul className="hp-footer-links">
              <li><button onClick={() => onNav('features')}>Features</button></li>
              <li><button onClick={() => onNav('workflow')}>Issues</button></li>
              <li><button onClick={() => onNav('sprints')}>Sprints</button></li>
              <li><button onClick={() => onNav('analytics')}>Analytics</button></li>
            </ul>
          </div>
          <div>
            <div className="hp-footer-col-title">Platform</div>
            <ul className="hp-footer-links">
              <li><button onClick={() => navigate('/login')}>Projects</button></li>
              <li><button onClick={() => navigate('/login')}>Notifications</button></li>
              <li><button onClick={() => navigate('/login')}>Reports</button></li>
              <li><button onClick={() => navigate('/login')}>Security</button></li>
            </ul>
          </div>
          <div>
            <div className="hp-footer-col-title">Resources</div>
            <ul className="hp-footer-links">
              <li><a href="#" onClick={e => e.preventDefault()}>Documentation</a></li>
              <li><a href="#" onClick={e => e.preventDefault()}>API Docs</a></li>
              <li>
                <a href="https://github.com/AjayKumarKR07/TracePilot" target="_blank" rel="noopener noreferrer">
                  GitHub
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="hp-footer-bottom">
          <span className="hp-footer-copy">&copy; 2026 TracePilot. All rights reserved.</span>
          <div className="hp-footer-legal">
            <a href="#" onClick={e => e.preventDefault()}>Privacy</a>
            <a href="#" onClick={e => e.preventDefault()}>Terms</a>
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ══════════════════════════════════════════════════════════════
   MAIN EXPORT
══════════════════════════════════════════════════════════════ */
export const HomePage: React.FC = () => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const navigate = useNavigate();

  const getDashboardPath = () => {
    if (!user) return '/login';
    if (user.role === 'ADMIN') return '/admin-dashboard';
    if (user.role === 'DEVELOPER') return '/developer-dashboard';
    return '/dashboard';
  };

  const dashboardPath = getDashboardPath();

  const scrollToSection = (id: string) => {
    if (id === 'home') { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleGetStarted = () => {
    if (isAuthenticated && user) { navigate(dashboardPath); return; }
    navigate('/register');
  };

  // Wait for auth resolution — prevents flash
  if (isLoading) return null;

  // Authenticated users go straight to their dashboard
  if (isAuthenticated && user) return <Navigate to={dashboardPath} replace />;

  return (
    <div className="hp-root">
      {/* Subtle background */}
      <div className="hp-grid-bg" aria-hidden="true" />
      <div className="hp-radial-glow" aria-hidden="true" />

      <div className="hp-content">
        <Navbar
          onNav={scrollToSection}
          onSignIn={() => navigate('/login')}
          onGetStarted={handleGetStarted}
          user={user}
          isAuthenticated={isAuthenticated}
          dashboardPath={dashboardPath}
        />

        <main>
          <HeroSection onGetStarted={handleGetStarted} onExplore={() => scrollToSection('features')} />
          <CapabilityStrip />
          <FeaturesBento />
          <hr className="hp-divider" />
          <WorkflowSection />
          <hr className="hp-divider" />
          <SprintShowcase />
          <hr className="hp-divider" />
          <AnalyticsShowcase />
          <hr className="hp-divider" />
          <RoleSection />
          <hr className="hp-divider" />
          <RealtimeSection />
          <hr className="hp-divider" />
          <PlatformSection />
          <WhySection />
          <CTASection onGetStarted={handleGetStarted} onDashboard={() => navigate('/login')} />
        </main>

        <Footer onNav={scrollToSection} />
      </div>
    </div>
  );
};
