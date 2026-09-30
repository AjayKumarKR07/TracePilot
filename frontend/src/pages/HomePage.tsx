import React, { useState, useEffect, useRef } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import {
  Activity, AlertTriangle, ArrowRight, BarChart3, Bell, Bug,
  CheckCircle2, ChartNoAxesCombined, ClipboardList, Code2, Crown,
  FileText, GitBranch, Key, Layers, Lock, LogIn, Menu, Moon,
  Shield, ShieldCheck, Sparkles, Sun, Target,
  TrendingUp, Users, Wifi, X, Zap,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../context/ThemeContext';
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { TracePilotLogo } from '../components/common/TracePilotLogo';
import '../components/home/home.css';

/* ─── Scroll-reveal ─── */
function useReveal(threshold = 0.1) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, visible };
}
function Reveal({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const { ref, visible } = useReveal();
  return (
    <div ref={ref} className={`hp-reveal ${visible ? 'hp-in-view' : ''} ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

/* ─── Demo / sample data ─── */
const DEMO_ISSUES = [
  { key: 'BUG-1024', title: 'Login authentication failure', sev: 'CRITICAL', sevBg: 'rgba(239,68,68,0.15)', sevC: '#ef4444' },
  { key: 'BUG-1025', title: 'Dashboard chart not loading',  sev: 'HIGH',     sevBg: 'rgba(249,115,22,0.15)', sevC: '#f97316' },
  { key: 'BUG-1026', title: 'File upload timeout error',    sev: 'MEDIUM',   sevBg: 'rgba(245,158,11,0.15)', sevC: '#f59e0b' },
  { key: 'FEAT-088', title: 'Export issues to CSV',         sev: 'LOW',      sevBg: 'rgba(99,102,241,0.15)', sevC: '#818cf8' },
];
const DEMO_CHART = [
  { w: 'W1', v: 58 }, { w: 'W2', v: 65 }, { w: 'W3', v: 62 },
  { w: 'W4', v: 74 }, { w: 'W5', v: 80 }, { w: 'W6', v: 88 },
  { w: 'W7', v: 84 }, { w: 'W8', v: 93 }, { w: 'W9', v: 97 },
];

/* ─── Navbar ─── */
function Navbar({ onNav, onSignIn, onGetStarted, isAuthenticated, user, dashPath }: {
  onNav: (id: string) => void;
  onSignIn: () => void;
  onGetStarted: () => void;
  isAuthenticated: boolean;
  user: { role: string } | null;
  dashPath: string;
}) {
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', h, { passive: true });
    return () => window.removeEventListener('scroll', h);
  }, []);
  const links = [
    { id: 'home',      label: 'Home' },
    { id: 'features',  label: 'Features' },
    { id: 'workflow',  label: 'Workflow' },
    { id: 'analytics', label: 'Analytics' },
    { id: 'sprints',   label: 'Sprints' },
  ];
  return (
    <>
      <nav className={`hp-nav${scrolled ? ' hp-nav--scrolled' : ''}`} aria-label="Main navigation">
        <div className="hp-nav-inner">
          <button className="hp-nav-brand" onClick={() => onNav('home')} aria-label="TracePilot home">
            <TracePilotLogo size={26} />
            <span className="hp-nav-brand-name">TracePilot</span>
          </button>
          <div className="hp-nav-links">
            {links.map(l => <button key={l.id} className="hp-nav-link" onClick={() => onNav(l.id)}>{l.label}</button>)}
          </div>
          <div className="hp-nav-actions">
            <button className="hp-theme-btn" onClick={toggleTheme} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
              {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            </button>
            {isAuthenticated && user ? (
              <button className="hp-btn-primary" onClick={() => navigate(dashPath)}>Dashboard <ArrowRight size={13} /></button>
            ) : (
              <>
                <button className="hp-btn-ghost" onClick={onSignIn}><LogIn size={14} /> Sign In</button>
                <button className="hp-btn-primary" onClick={onGetStarted}>Get Started <ArrowRight size={13} /></button>
              </>
            )}
            <button className="hp-nav-mobile-btn" onClick={() => setOpen(v => !v)} aria-label="Toggle menu" aria-expanded={open}>
              {open ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </nav>
      {open && (
        <div className="hp-nav-mobile-menu">
          {links.map(l => <button key={l.id} className="hp-nav-mobile-link" onClick={() => { onNav(l.id); setOpen(false); }}>{l.label}</button>)}
          <hr style={{ border: 'none', borderTop: '1px solid var(--hp-border)', margin: '0.25rem 0' }} />
          {isAuthenticated && user
            ? <button className="hp-nav-mobile-link" onClick={() => { navigate(dashPath); setOpen(false); }}>Dashboard</button>
            : <>
                <button className="hp-nav-mobile-link" onClick={() => { onSignIn(); setOpen(false); }}>Sign In</button>
                <button className="hp-btn-primary hp-btn-lg" style={{ marginTop: '0.5rem', width: '100%', justifyContent: 'center' }} onClick={() => { onGetStarted(); setOpen(false); }}>Get Started</button>
              </>
          }
        </div>
      )}
    </>
  );
}

/* ─── Product Preview (hero dashboard mock) ─── */
function ProductPreview() {
  const health = [
    { label: 'Critical', n: 3,  pct: 12, c: '#ef4444' },
    { label: 'High',     n: 7,  pct: 29, c: '#f97316' },
    { label: 'Medium',   n: 11, pct: 46, c: '#f59e0b' },
    { label: 'Low',      n: 3,  pct: 12, c: '#818cf8' },
  ];
  return (
    <div className="hp-preview-wrap">
      <div className="hp-preview-glow" aria-hidden="true" />
      <div className="hp-preview-frame" role="img" aria-label="TracePilot product preview — sample data">
        {/* Window bar */}
        <div className="hp-preview-bar">
          <div className="hp-pw-dot hp-pw-dot-r" aria-hidden="true" />
          <div className="hp-pw-dot hp-pw-dot-a" aria-hidden="true" />
          <div className="hp-pw-dot hp-pw-dot-g" aria-hidden="true" />
          <span className="hp-pw-title">TracePilot &mdash; Overview</span>
          <span className="hp-pw-badge">
            <span className="hp-pw-badge-dot" aria-hidden="true" />
            DEMO PREVIEW
          </span>
        </div>
        {/* Body — sidebar / main / chart panel */}
        <div className="hp-preview-body">
          {/* Sidebar */}
          <div className="hp-preview-sidebar" aria-hidden="true">
            {[
              { icon: <BarChart3 size={13} />, label: 'Overview', active: true },
              { icon: <Bug size={13} />, label: 'Issues' },
              { icon: <GitBranch size={13} />, label: 'Sprints' },
              { icon: <Bell size={13} />, label: 'Notifications' },
              { icon: <Users size={13} />, label: 'Team' },
              { icon: <Shield size={13} />, label: 'Security' },
            ].map(n => (
              <div key={n.label} className={`hp-pw-nav-item${n.active ? ' active' : ''}`}>
                {n.icon} {n.label}
              </div>
            ))}
          </div>
          {/* Main */}
          <div className="hp-preview-main">
            <div className="hp-pw-stats-row">
              {[
                { v: '24',  l: 'Issues' },
                { v: '17',  l: 'Resolved' },
                { v: '7',   l: 'Open' },
                { v: '86%', l: 'Sprint' },
              ].map(s => (
                <div key={s.l} className="hp-pw-stat">
                  <div className="hp-pw-stat-v">{s.v}</div>
                  <div className="hp-pw-stat-l">{s.l}</div>
                </div>
              ))}
            </div>
            <div className="hp-pw-section-label">Recent Issues</div>
            {DEMO_ISSUES.map(i => (
              <div key={i.key} className="hp-pw-issue-row">
                <span className="hp-pw-issue-key">{i.key}</span>
                <span className="hp-pw-issue-title">{i.title}</span>
                <span className="hp-pw-badge-sev" style={{ background: i.sevBg, color: i.sevC }}>{i.sev}</span>
              </div>
            ))}
            <div style={{ marginTop: '1rem', height: '64px' }} aria-hidden="true">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={DEMO_CHART}>
                  <Line type="monotone" dataKey="v" stroke="#3b82f6" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          {/* Chart panel — Issue Health */}
          <div className="hp-preview-chart-panel" aria-hidden="true">
            <div className="hp-pw-section-label" style={{ marginBottom: '0.65rem' }}>Issue Health</div>
            {health.map(h => (
              <div key={h.label} className="hp-pw-health-row">
                <span className="hp-pw-health-label">{h.label}</span>
                <div className="hp-pw-health-bar">
                  <div className="hp-pw-health-fill" style={{ width: `${h.pct}%`, background: h.c }} />
                </div>
                <span className="hp-pw-health-n">{h.n}</span>
              </div>
            ))}
            <div style={{ marginTop: '1.25rem' }}>
              <div className="hp-pw-section-label" style={{ marginBottom: '0.5rem' }}>Sprint Health</div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--hp-text)', letterSpacing: '-0.04em' }}>86%</div>
                <div style={{ fontSize: '0.6rem', color: 'var(--hp-text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>On Track</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Hero ─── */
function Hero({ onGetStarted, onExplore }: { onGetStarted: () => void; onExplore: () => void }) {
  return (
    <section id="home" className="hp-hero-wrap" aria-labelledby="hero-h1">
      <div className="hp-hero-radial" aria-hidden="true" />
      {/* Arc rings */}
      <div className="hp-arc-wrap" aria-hidden="true">
        <div className="hp-arc-ring" /><div className="hp-arc-dot" />
        <div className="hp-arc-ring" />
        <div className="hp-arc-ring" />
        <div className="hp-arc-ring" />
      </div>

      <div className="hp-hero-inner hp-anim-in" style={{ animationDelay: '0.05s' }}>
        <div className="hp-eyebrow">
          <span className="hp-eyebrow-dot" aria-hidden="true" />
          Intelligent Software Management
          <span className="hp-eyebrow-dot" aria-hidden="true" />
        </div>
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
        <div className="hp-hero-caps">
          <span className="hp-hero-cap"><span className="hp-hero-cap-dot" aria-hidden="true" />Issue Tracking</span>
          <span className="hp-hero-cap"><span className="hp-hero-cap-dot" aria-hidden="true" />Sprint Management</span>
          <span className="hp-hero-cap"><span className="hp-hero-cap-dot" aria-hidden="true" />Real-Time Analytics</span>
        </div>
      </div>

      <ProductPreview />
    </section>
  );
}

/* ─── Capability Strip ─── */
function CapabilityStrip() {
  const items = [
    { icon: <Bug size={13} />, label: 'Issue Tracking' },
    { icon: <GitBranch size={13} />, label: 'Sprint Management' },
    { icon: <BarChart3 size={13} />, label: 'Analytics' },
    { icon: <Wifi size={13} />, label: 'Real-Time Updates' },
    { icon: <ShieldCheck size={13} />, label: 'Role-Based Access' },
    { icon: <FileText size={13} />, label: 'Audit Trail' },
  ];
  return (
    <div className="hp-strip" aria-label="Platform capabilities">
      <div className="hp-strip-label">Built for Modern Software Teams</div>
      <div className="hp-strip-items">
        {items.map(i => (
          <span key={i.label} className="hp-strip-item" aria-label={i.label}>
            {i.icon} {i.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ─── Platform Capabilities (3 large cards) ─── */
function PlatformCapabilities({ onNav }: { onNav: (id: string) => void }) {
  const cards = [
    {
      icon: <Bug size={20} aria-hidden="true" />,
      title: 'Intelligent Issue Tracking',
      desc: 'Track bugs, tasks, and feature requests with priority, severity, comments, attachments, and workflow states.',
      id: 'features',
    },
    {
      icon: <Layers size={20} aria-hidden="true" />,
      title: 'Agile Sprint Management',
      desc: 'Plan sprints, manage backlog issues, track capacity, monitor progress, and roll over unfinished work.',
      id: 'sprints',
    },
    {
      icon: <ChartNoAxesCombined size={20} aria-hidden="true" />,
      title: 'Real-Time Analytics',
      desc: 'Monitor resolution trends, issue health, sprint progress, and project performance in one view.',
      id: 'analytics',
    },
  ];
  return (
    <section className="hp-container hp-section-py" id="features" aria-labelledby="cap-h2">
      <Reveal>
        <div className="hp-eyebrow"><span className="hp-eyebrow-dot" aria-hidden="true" />Platform Capabilities</div>
        <h2 className="hp-h2" id="cap-h2">Everything teams need to manage<br />software delivery end-to-end.</h2>
        <p className="hp-h2-sub" style={{ marginBottom: '2.5rem' }}>
          From issue discovery to resolution, TracePilot connects every step of your engineering workflow.
        </p>
      </Reveal>
      <div className="hp-cap-grid">
        {cards.map((c, i) => (
          <Reveal key={c.title} delay={i * 70}>
            <div className="hp-cap-card">
              <div className="hp-cap-icon">{c.icon}</div>
              <div className="hp-cap-title">{c.title}</div>
              <p className="hp-cap-desc">{c.desc}</p>
              <button className="hp-cap-link" onClick={() => onNav(c.id)} aria-label={`Explore ${c.title}`}>
                EXPLORE <ArrowRight size={12} aria-hidden="true" />
              </button>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ─── Feature Grid (2×3) ─── */
function FeatureGrid() {
  const feats = [
    { icon: <Bug size={16} />, title: 'Issue Tracking', desc: 'Report, triage, and resolve bugs with full workflow support.' },
    { icon: <ClipboardList size={16} />, title: 'Sprint Planning', desc: 'Plan sprints, assign backlog issues, and track capacity.' },
    { icon: <BarChart3 size={16} />, title: 'Burndown Analytics', desc: 'Visualize sprint progress and resolution rates in real time.' },
    { icon: <Bell size={16} />, title: 'Notifications', desc: 'Real-time alerts for issue, sprint, and assignment events.' },
    { icon: <Sparkles size={16} />, title: 'AI Assistant', desc: 'Ask questions about issues, sprints, and metrics with built-in AI.' },
    { icon: <ShieldCheck size={16} />, title: 'Role-Based Security', desc: 'Secure access control for admins, developers, and users.' },
  ];
  return (
    <section className="hp-container" style={{ paddingBottom: '7rem' }} aria-labelledby="feat-h2">
      <Reveal>
        <div className="hp-eyebrow"><span className="hp-eyebrow-dot" aria-hidden="true" />Engineering Workflow</div>
        <h2 className="hp-h2" id="feat-h2" style={{ marginBottom: '2rem' }}>Built for how engineering<br />teams actually work.</h2>
      </Reveal>
      <div className="hp-feat-grid">
        {feats.map((f, i) => (
          <Reveal key={f.title} delay={i * 50}>
            <div className="hp-feat-card">
              <div className="hp-feat-icon">{f.icon}</div>
              <div className="hp-feat-title">{f.title}</div>
              <p className="hp-feat-desc">{f.desc}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ─── Why TracePilot ─── */
function WhySection() {
  const pillars = [
    { n: '01', title: 'One Workspace', desc: 'Projects, issues, sprints, analytics, and collaboration in one platform.' },
    { n: '02', title: 'Real-Time Visibility', desc: 'Track issue and sprint activity as work progresses.' },
    { n: '03', title: 'Smarter Delivery', desc: 'Use analytics and workflow insights to understand delivery performance.' },
  ];
  return (
    <section className="hp-container hp-section-py" aria-labelledby="why-h2">
      <Reveal>
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <div className="hp-eyebrow" style={{ justifyContent: 'center' }}>
            <span className="hp-eyebrow-dot" aria-hidden="true" />Why TracePilot?
          </div>
          <h2 className="hp-h2 hp-h2-center" id="why-h2">One workspace for the complete<br />software delivery lifecycle.</h2>
        </div>
      </Reveal>
      <Reveal delay={100}>
        <div className="hp-why-grid" style={{ position: 'relative' }}>
          <div className="hp-why-connector" aria-hidden="true" />
          {pillars.map((p, i) => (
            <div key={p.n} className="hp-why-item" style={{ borderLeft: i > 0 ? '1px solid var(--hp-border)' : 'none' }}>
              <div className="hp-why-num-badge" aria-hidden="true">{p.n}</div>
              <div className="hp-why-title">{p.title}</div>
              <p className="hp-why-desc">{p.desc}</p>
            </div>
          ))}
        </div>
      </Reveal>
    </section>
  );
}

/* ─── Workflow ─── */
function WorkflowSection() {
  const steps = [
    { n: '01', icon: <ClipboardList size={16} />, title: 'Backlog',         desc: 'Issues collected and prioritized.' },
    { n: '02', icon: <Target size={16} />,         title: 'Sprint Planning', desc: 'Items selected, effort estimated.' },
    { n: '03', icon: <Activity size={16} />,       title: 'Active Sprint',   desc: 'Development progresses.' },
    { n: '04', icon: <CheckCircle2 size={16} />,   title: 'Resolution',      desc: 'Issues fixed and resolved.' },
    { n: '05', icon: <BarChart3 size={16} />,      title: 'Analytics',       desc: 'Velocity and health reviewed.' },
    { n: '06', icon: <Zap size={16} />,             title: 'Release',         desc: 'Sprint complete. Next begins.' },
  ];
  return (
    <section className="hp-container hp-section-py" id="workflow" aria-labelledby="wf-h2">
      <Reveal>
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <div className="hp-eyebrow" style={{ justifyContent: 'center' }}>
            <span className="hp-eyebrow-dot" aria-hidden="true" />Product Workflow
          </div>
          <h2 className="hp-h2 hp-h2-center" id="wf-h2">From Backlog to Release</h2>
          <p className="hp-h2-sub hp-h2-sub-center" style={{ marginTop: '0.75rem' }}>A structured path from planning to delivery.</p>
        </div>
      </Reveal>
      <Reveal delay={100}>
        <div className="hp-wf-steps" style={{ position: 'relative' }}>
          <div className="hp-wf-connector" aria-hidden="true" />
          {steps.map(s => (
            <div key={s.n} className="hp-wf-step">
              <div className="hp-wf-num">{s.n}</div>
              <div className="hp-wf-icon" aria-hidden="true">{s.icon}</div>
              <div className="hp-wf-title">{s.title}</div>
              <div className="hp-wf-desc">{s.desc}</div>
            </div>
          ))}
        </div>
      </Reveal>
    </section>
  );
}

/* ─── Delivery at a Glance ─── */
function DeliverySection() {
  const cards = [
    {
      title: 'Issue Health',
      rows: [
        { label: 'Open',        val: '7',  pct: 29, c: '#3b82f6' },
        { label: 'In Progress', val: '4',  pct: 17, c: '#f59e0b' },
        { label: 'Resolved',    val: '17', pct: 71, c: '#10b981' },
      ],
    },
    {
      title: 'Sprint Health',
      rows: [
        { label: 'Completed',  val: '17', pct: 71, c: '#10b981' },
        { label: 'Remaining',  val: '7',  pct: 29, c: '#6366f1' },
        { label: 'Capacity',   val: '240h',pct: 86, c: '#3b82f6' },
      ],
    },
    {
      title: 'Resolution Performance',
      rows: [
        { label: 'Resolution Rate',  val: '86%', pct: 86, c: '#10b981' },
        { label: 'Avg. Resolution',  val: '1.8d', pct: 55, c: '#3b82f6' },
        { label: 'Critical Fixed',   val: '100%', pct: 100, c: '#22c55e' },
      ],
    },
    {
      title: 'Project Visibility',
      rows: [
        { label: 'Active Projects', val: '3',  pct: 60, c: '#6366f1' },
        { label: 'Total Issues',    val: '24', pct: 75, c: '#3b82f6' },
        { label: 'Sprint Velocity', val: '17', pct: 85, c: '#10b981' },
      ],
    },
  ];
  return (
    <section className="hp-container hp-section-py" aria-labelledby="delivery-h2">
      <Reveal>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
          <div>
            <div className="hp-eyebrow"><span className="hp-eyebrow-dot" aria-hidden="true" />Delivery at a Glance</div>
            <h2 className="hp-h2" id="delivery-h2">Workspace metrics<br />in one view.</h2>
          </div>
          <span className="hp-demo-tag">SAMPLE DATA</span>
        </div>
      </Reveal>
      <div className="hp-delivery-grid">
        {cards.map((c, i) => (
          <Reveal key={c.title} delay={i * 60}>
            <div className="hp-delivery-card">
              <div className="hp-delivery-title">{c.title}</div>
              {c.rows.map(r => (
                <div key={r.label}>
                  <div className="hp-delivery-row">
                    <span className="hp-delivery-row-label">{r.label}</span>
                    <span className="hp-delivery-row-val">{r.val}</span>
                  </div>
                  <div className="hp-delivery-bar">
                    <div className="hp-delivery-fill" style={{ width: `${r.pct}%`, background: r.c }} />
                  </div>
                </div>
              ))}
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ─── Analytics Showcase ─── */
function AnalyticsSection() {
  const metrics = [
    { icon: <TrendingUp size={16} />, iconBg: 'rgba(16,185,129,0.12)', iconC: '#10b981', val: '97%',  label: 'Resolution Rate' },
    { icon: <Bug size={16} />,        iconBg: 'rgba(59,130,246,0.12)', iconC: '#3b82f6', val: '24',   label: 'Active Issues' },
    { icon: <GitBranch size={16} />,  iconBg: 'rgba(99,102,241,0.12)', iconC: '#818cf8', val: '3',    label: 'Active Projects' },
    { icon: <Activity size={16} />,   iconBg: 'rgba(245,158,11,0.12)', iconC: '#f59e0b', val: '86%',  label: 'Sprint Completion' },
  ];
  return (
    <section className="hp-container hp-section-py" id="analytics" aria-labelledby="analytics-h2">
      <Reveal>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '2.5rem' }}>
          <div>
            <div className="hp-eyebrow"><span className="hp-eyebrow-dot" aria-hidden="true" />Analytics</div>
            <h2 className="hp-h2" id="analytics-h2">
              See Everything.<br />
              <span className="hp-hero-accent">Fix Faster.</span>
            </h2>
            <p className="hp-h2-sub">Turn issue and sprint activity into actionable engineering visibility.</p>
          </div>
          <span className="hp-demo-tag">DEMO DATA</span>
        </div>
      </Reveal>
      <div className="hp-analytics-split">
        {/* Chart */}
        <Reveal>
          <div className="hp-analytics-chart-card">
            <div className="hp-analytics-chart-title">Resolution Rate Trend</div>
            <div className="hp-analytics-chart-sub">Weekly issue resolution rate across all projects</div>
            <div style={{ height: '200px' }} aria-hidden="true">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={DEMO_CHART}>
                  <XAxis dataKey="w" tick={{ fontSize: 10, fill: 'var(--hp-text-3)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--hp-text-3)' }} axisLine={false} tickLine={false} domain={[50, 100]} />
                  <Line type="monotone" dataKey="v" stroke="#3b82f6" strokeWidth={2.5} dot={{ fill: '#3b82f6', r: 3 }} />
                  <Tooltip
                    contentStyle={{ background: 'rgba(5,11,20,0.95)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, fontSize: '0.78rem' }}
                    labelStyle={{ color: 'var(--hp-text-3)' }}
                    formatter={(v: number) => [`${v}%`, 'Resolution Rate']}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Reveal>
        {/* Metrics */}
        <Reveal delay={100}>
          <div className="hp-metrics-stack">
            {metrics.map(m => (
              <div key={m.label} className="hp-metric-card">
                <div className="hp-metric-icon" style={{ background: m.iconBg, color: m.iconC }}>{m.icon}</div>
                <div>
                  <div className="hp-metric-val">{m.val}</div>
                  <div className="hp-metric-label">{m.label}</div>
                </div>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ─── Roles ─── */
function RoleSection() {
  const roles = [
    {
      icon: <Crown size={22} aria-hidden="true" />, tag: 'Administrator', title: 'Admin', subtitle: 'Full system control',
      perms: ['Manage users and permissions', 'Create and manage projects', 'Plan and oversee sprints', 'Monitor system analytics', 'Review audit activity', 'Configure workflows'],
    },
    {
      icon: <Code2 size={22} aria-hidden="true" />, tag: 'Developer', title: 'Developer', subtitle: 'Build. Fix. Deliver.',
      perms: ['Investigate reported defects', 'Work on assigned issues', 'Update issue progress', 'Validate fixes', 'Manage sprint work', 'Collaborate through comments'],
    },
    {
      icon: <Users size={22} aria-hidden="true" />, tag: 'User', title: 'User', subtitle: 'Report. Track. Verify.',
      perms: ['Submit detailed issues', 'Track resolution progress', 'Add comments', 'Upload screenshots', 'Receive notifications', 'Verify reported fixes'],
    },
  ];
  return (
    <section className="hp-container hp-section-py" aria-labelledby="roles-h2">
      <Reveal>
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div className="hp-eyebrow" style={{ justifyContent: 'center' }}>
            <span className="hp-eyebrow-dot" aria-hidden="true" />Role Experience
          </div>
          <h2 className="hp-h2 hp-h2-center" id="roles-h2">Built for Every Role</h2>
          <p className="hp-h2-sub hp-h2-sub-center" style={{ marginTop: '0.75rem' }}>
            Dedicated workflows and permissions for each team member type.
          </p>
        </div>
      </Reveal>
      <div className="hp-roles-grid">
        {roles.map((r, i) => (
          <Reveal key={r.title} delay={i * 80}>
            <div className="hp-role-card">
              <div className="hp-role-icon">{r.icon}</div>
              <div className="hp-role-tag">{r.tag}</div>
              <h3 className="hp-role-title">{r.title}</h3>
              <p className="hp-role-subtitle">{r.subtitle}</p>
              <ul className="hp-role-perms" aria-label={`${r.title} permissions`}>
                {r.perms.map(p => (
                  <li key={p}><CheckCircle2 size={13} aria-hidden="true" /> {p}</li>
                ))}
              </ul>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ─── Real-Time Section ─── */
function RealtimeSection() {
  const notifs = [
    { icon: <Bug size={15} />,          bg: 'rgba(239,68,68,0.12)',   c: '#ef4444', title: 'Issue Created',  body: 'BUG-1028 reported',                 time: 'Just now',   unread: true  },
    { icon: <Users size={15} />,        bg: 'rgba(59,130,246,0.12)',  c: '#3b82f6', title: 'Issue Assigned', body: 'Developer assigned to BUG-1028',    time: '1 min ago',  unread: true  },
    { icon: <AlertTriangle size={15} />,bg: 'rgba(245,158,11,0.12)', c: '#f59e0b', title: 'Comment Added',  body: 'New collaboration activity',          time: '3 min ago',  unread: false },
    { icon: <CheckCircle2 size={15} />, bg: 'rgba(16,185,129,0.12)', c: '#10b981', title: 'Issue Resolved', body: 'BUG-1024 resolved successfully',      time: '6 min ago',  unread: false },
    { icon: <Activity size={15} />,     bg: 'rgba(99,102,241,0.12)', c: '#818cf8', title: 'Sprint Updated',  body: 'Sprint health changed to ON TRACK',  time: '12 min ago', unread: false },
  ];
  const channels = [
    { icon: <Bug size={13} />,       name: 'Issue Updates',  desc: 'Status changes, transitions' },
    { icon: <GitBranch size={13} />, name: 'Sprint Events',  desc: 'Start, health, completion'   },
    { icon: <Bell size={13} />,      name: 'Comments',       desc: 'New replies and mentions'     },
    { icon: <Users size={13} />,     name: 'Assignments',    desc: 'Issue and task assignments'   },
    { icon: <Sparkles size={13} />,  name: 'AI Insights',    desc: 'AI-generated summaries'       },
  ];
  const connChannels = [
    { icon: <Bug size={12} />,       label: 'Issue Events'  },
    { icon: <GitBranch size={12} />, label: 'Sprint Events' },
    { icon: <Bell size={12} />,      label: 'Notifications' },
    { icon: <Sparkles size={12} />,  label: 'AI Events'     },
  ];
  return (
    <section className="hp-container hp-section-py" aria-labelledby="rt-h2">
      <Reveal>
        {/* ONE outer container */}
        <div className="hp-rt-container">
          <div className="hp-rt-inner">

            {/* ── LEFT: eyebrow + heading + event timeline ── */}
            <div className="hp-rt-left">
              <div className="hp-eyebrow"><span className="hp-eyebrow-dot" aria-hidden="true" />Real-Time</div>
              <h2 className="hp-h2" id="rt-h2" style={{ marginTop: '0.5rem' }}>
                Real-Time.<br />
                <span className="hp-hero-accent">Always in Sync.</span>
              </h2>
              <p className="hp-h2-sub" style={{ marginBottom: '1.75rem' }}>
                Important issue and sprint events are delivered through TracePilot's real-time notification infrastructure.
              </p>

              {/* Event timeline */}
              <div className="hp-notif-list">
                {notifs.map((n, i) => (
                  <div key={n.title + i} className="hp-notif-item">
                    <div className="hp-notif-icon" style={{ background: n.bg, color: n.c }}>{n.icon}</div>
                    <div className="hp-notif-body">
                      <div className="hp-notif-title">{n.title}</div>
                      <div className="hp-notif-sub">{n.body}</div>
                      <div className="hp-notif-time">{n.time}</div>
                    </div>
                    {n.unread && <div className="hp-notif-dot" aria-label="Unread" />}
                  </div>
                ))}
              </div>
            </div>

            {/* ── RIGHT: Activity Feed + Live Connection ── */}
            <div className="hp-rt-right">

              {/* Activity Feed — no extra card, just inline content */}
              <div className="hp-rt-feed-header">
                <span className="hp-live-pill">
                  <span className="hp-live-pill-dot" aria-hidden="true" />
                  LIVE CAPABILITY PREVIEW
                </span>
                <span className="hp-rt-panel-title">Activity Feed</span>
              </div>

              <div className="hp-rt-channels">
                {channels.map(ch => (
                  <div key={ch.name} className="hp-rt-channel">
                    <div className="hp-rt-channel-left">
                      <span className="hp-rt-channel-icon">{ch.icon}</span>
                      <div>
                        <div className="hp-rt-channel-name">{ch.name}</div>
                        <div className="hp-rt-channel-desc">{ch.desc}</div>
                      </div>
                    </div>
                    <span className="hp-rt-channel-badge">ACTIVE</span>
                  </div>
                ))}
                <p className="hp-rt-disclaimer">
                  CAPABILITY PREVIEW — this page does not receive live events.
                </p>
              </div>

              {/* Live Connection — separated by border-top */}
              <div className="hp-rt-conn-section">
                <div className="hp-rt-conn-header">
                  <Wifi size={13} aria-hidden="true" className="hp-rt-conn-header-icon" />
                  <span className="hp-rt-conn-title">LIVE CONNECTION</span>
                </div>
                <div className="hp-rt-conn-status">
                  <span className="hp-rt-conn-dot" aria-hidden="true" />
                  <span className="hp-rt-conn-status-text">WebSocket Connected</span>
                </div>
                <div className="hp-rt-conn-channels">
                  {connChannels.map(c => (
                    <div key={c.label} className="hp-rt-conn-row">
                      <span className="hp-rt-conn-row-icon">{c.icon}</span>
                      <span className="hp-rt-conn-row-label">{c.label}</span>
                      <CheckCircle2 size={12} className="hp-rt-conn-check" aria-hidden="true" />
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}


/* ─── AI Assistant ─── */
function AISection() {
  const messages = [
    { role: 'user', text: 'How can I reproduce BUG-1024?' },
    { role: 'ai',   text: 'To reproduce BUG-1024 (login authentication failure):\n1. Navigate to /login with an expired session token.\n2. Enter valid credentials and submit.\n3. Observe: 401 Unauthorized error returned without redirect.' },
    { role: 'user', text: 'Explain my sprint health.' },
    { role: 'ai',   text: 'Sprint Alpha is currently ON TRACK at 72% completion. 17 of 24 issues resolved. Burndown is ahead of the ideal line. Critical issues have all been addressed.' },
  ];
  return (
    <section className="hp-container hp-section-py" id="sprints" aria-labelledby="ai-h2">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5rem', alignItems: 'center' }}>
        <Reveal>
          <div>
            <div className="hp-eyebrow"><span className="hp-eyebrow-dot" aria-hidden="true" />AI Assistant</div>
            <h2 className="hp-h2" id="ai-h2">Intelligent Assistance<br />for Your Workflow</h2>
            <p className="hp-h2-sub" style={{ marginTop: '0.5rem' }}>
              Use TracePilot AI to understand issues, generate testing guidance, explain metrics, and assist with technical questions.
            </p>
          </div>
        </Reveal>
        <Reveal delay={120}>
          <div className="hp-ai-wrap">
            <div className="hp-ai-bar">
              <Sparkles size={15} color="#818cf8" aria-hidden="true" />
              <span className="hp-ai-bar-title">TracePilot AI</span>
              <span className="hp-ai-pill">AI CAPABILITY PREVIEW</span>
            </div>
            <div className="hp-ai-body">
              {messages.map((m, i) => (
                <div key={i} className="hp-ai-msg">
                  <div className={`hp-ai-avatar ${m.role === 'user' ? 'hp-ai-avatar-user' : 'hp-ai-avatar-ai'}`} aria-hidden="true">
                    {m.role === 'user' ? 'U' : 'AI'}
                  </div>
                  <div className={`hp-ai-bubble ${m.role === 'ai' ? 'hp-ai-bubble-ai' : ''}`} style={{ whiteSpace: 'pre-line' }}>
                    {m.text}
                  </div>
                </div>
              ))}
            </div>
            <p className="hp-ai-disclaimer">AI capability preview — not connected to backend on this page.</p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ─── Security Section ─── */
function SecuritySection() {
  const items = [
    { icon: <Shield size={17} />, title: 'Role-Based Access', desc: 'Admin, Developer, User roles with distinct permissions.' },
    { icon: <Key size={17} />, title: 'JWT Authentication', desc: 'Secure token-based auth with expiry controls.' },
    { icon: <Lock size={17} />, title: 'Protected APIs', desc: 'All endpoints secured and validated server-side.' },
    { icon: <FileText size={17} />, title: 'Audit Trail', desc: 'Complete log of all system operations.' },
    { icon: <CheckCircle2 size={17} />, title: 'Controlled Workflows', desc: 'State transitions enforced by role permissions.' },
  ];
  return (
    <section className="hp-container hp-section-py" aria-labelledby="sec-h2">
      <Reveal>
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div className="hp-eyebrow" style={{ justifyContent: 'center' }}>
            <span className="hp-eyebrow-dot" aria-hidden="true" />Security
          </div>
          <h2 className="hp-h2 hp-h2-center" id="sec-h2">Secure by Design</h2>
          <p className="hp-h2-sub hp-h2-sub-center" style={{ marginTop: '0.75rem' }}>
            Every layer of TracePilot is designed with access control and auditability in mind.
          </p>
        </div>
      </Reveal>
      <Reveal delay={100}>
        <div className="hp-security-grid">
          {items.map(item => (
            <div key={item.title} className="hp-security-item">
              <div className="hp-security-icon">{item.icon}</div>
              <div className="hp-security-title">{item.title}</div>
              <p className="hp-security-desc">{item.desc}</p>
            </div>
          ))}
        </div>
      </Reveal>
    </section>
  );
}

/* ─── CTA ─── */
function CTASection({ onGetStarted, onDash }: { onGetStarted: () => void; onDash: () => void }) {
  return (
    <div className="hp-cta-wrap" aria-labelledby="cta-h2">
      <div className="hp-cta-glow" aria-hidden="true" />
      <div className="hp-cta-arc" aria-hidden="true" />
      <div className="hp-cta-arc-2" aria-hidden="true" />
      <Reveal>
        <div className="hp-cta-inner">
          <div className="hp-eyebrow" style={{ justifyContent: 'center' }}>
            <span className="hp-eyebrow-dot" aria-hidden="true" />Ready When You Are
          </div>
          <h2 className="hp-cta-h2" id="cta-h2">
            Ready to Ship Better<br />Software?
          </h2>
          <p className="hp-cta-sub">
            Bring issues, projects, sprints, analytics, and collaboration together in one intelligent workspace.
          </p>
          <div className="hp-cta-btns">
            <button className="hp-btn-primary hp-btn-lg" onClick={onGetStarted}>
              Get Started Free <ArrowRight size={16} aria-hidden="true" />
            </button>
            <button className="hp-btn-secondary hp-btn-lg" onClick={onDash}>
              Explore Dashboard
            </button>
          </div>
        </div>
      </Reveal>
    </div>
  );
}

/* ─── Footer ─── */
function Footer({ onNav }: { onNav: (id: string) => void }) {
  const navigate = useNavigate();
  return (
    <footer className="hp-footer" aria-label="Site footer">
      <div className="hp-footer-inner">
        <div className="hp-footer-grid">
          <div>
            <button className="hp-footer-brand" onClick={() => onNav('home')} aria-label="TracePilot home">
              <TracePilotLogo size={22} />
              <span className="hp-footer-brand-name">TracePilot</span>
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

/* ═══════════════════════════════════════════════════════
   MAIN EXPORT
═══════════════════════════════════════════════════════ */
export const HomePage: React.FC = () => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const navigate = useNavigate();

  const getDashPath = () => {
    if (!user) return '/login';
    if (user.role === 'ADMIN') return '/admin-dashboard';
    if (user.role === 'DEVELOPER') return '/developer-dashboard';
    return '/dashboard';
  };
  const dashPath = getDashPath();

  const scrollTo = (id: string) => {
    if (id === 'home') { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleGetStarted = () => {
    if (isAuthenticated && user) { navigate(dashPath); return; }
    navigate('/register');
  };

  // Wait for auth — prevents unauthenticated flash
  if (isLoading) return null;

  // Redirect authenticated users to their dashboard
  if (isAuthenticated && user) return <Navigate to={dashPath} replace />;

  return (
    <div className="hp-root">
      {/* Background layers */}
      <div className="hp-bg-canvas" aria-hidden="true" />
      <div className="hp-grid-bg" aria-hidden="true" />
      <div className="hp-content">
        <Navbar
          onNav={scrollTo}
          onSignIn={() => navigate('/login')}
          onGetStarted={handleGetStarted}
          isAuthenticated={isAuthenticated}
          user={user}
          dashPath={dashPath}
        />
        <main>
          {/* 1 Hero + Product Preview */}
          <Hero onGetStarted={handleGetStarted} onExplore={() => scrollTo('features')} />

          {/* 2 Capability Strip */}
          <CapabilityStrip />

          {/* 3 Platform Capabilities */}
          <PlatformCapabilities onNav={scrollTo} />

          <hr className="hp-divider" />

          {/* 4 Feature Grid */}
          <FeatureGrid />

          <hr className="hp-divider" />

          {/* 5 Why TracePilot */}
          <WhySection />

          <hr className="hp-divider" />

          {/* 6 Workflow */}
          <WorkflowSection />

          <hr className="hp-divider" />

          {/* 7 Delivery at a Glance */}
          <DeliverySection />

          <hr className="hp-divider" />

          {/* 8 Analytics */}
          <AnalyticsSection />

          <hr className="hp-divider" />

          {/* 9 Roles */}
          <RoleSection />

          <hr className="hp-divider" />

          {/* 10 Real-Time */}
          <RealtimeSection />

          <hr className="hp-divider" />

          {/* 11 AI Assistant */}
          <AISection />

          <hr className="hp-divider" />

          {/* 12 Security */}
          <SecuritySection />

          {/* 13 CTA */}
          <CTASection onGetStarted={handleGetStarted} onDash={() => navigate('/login')} />
        </main>
        <Footer onNav={scrollTo} />
      </div>
    </div>
  );
};
