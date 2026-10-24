# 🐞 TracePilot — Frontend Application

> **Intelligent Software Defect Tracking & Agile Project Management System**  
> Modern Single-Page Application (SPA) built with React 19, TypeScript, and Vite.

---

## 🚀 Overview

The TracePilot frontend provides an enterprise-tier web interface engineered for real-time defect lifecycle management, Agile sprint execution, interactive data visualization, and role-based governance.

It interfaces directly with the FastAPI REST API and WebSocket engine, enforcing client-side route guards, authenticated session state, live push notifications, and rich analytical charts.

---

## 🛠️ Technology Stack

| Layer | Technology | Version | Purpose |
| :--- | :--- | :--- | :--- |
| **Runtime & Framework** | React | `19.2.8` | Component-driven UI architecture |
| **Language** | TypeScript | `5.7.2` | Static type safety and data models |
| **Build & Bundler** | Vite | `5.4.19` | Fast HMR dev server and Rollup production builds |
| **Styling & Tokens** | Tailwind CSS | Modern | Tailored dark-mode glassmorphic design system |
| **Iconography** | Lucide React | `^1.16.0` | Accessible modern vector icons |
| **Data Visualization** | Plotly.js / React-Plotly | `^2.35.3` | Defect distributions, trends, and burndown curves |
| **Reporting & Export** | html2canvas + jspdf | `^1.4.1` / `^2.5.2` | Client-side visual and tabular PDF document generation |
| **Real-Time Client** | WebSockets | Native | Asynchronous event push and toast notifications |

---

## 🏛️ Role-Based Workspace Architecture

TracePilot enforces three canonical user roles with strict route-level protection via `<ProtectedRoute>` guards:

```
                          ┌──────────────────────────┐
                          │   TracePilot Frontend    │
                          └─────────────┬────────────┘
                                        │
           ┌────────────────────────────┼───────────────────────────┐
           ▼                            ▼                           ▼
 ┌───────────────────┐        ┌───────────────────┐       ┌───────────────────┐
 │  USER WORKSPACE   │        │DEVELOPER WORKSPACE│       │  ADMIN WORKSPACE  │
 │  /user-dashboard  │        │/developer-dash... │       │ /admin-dashboard  │
 ├───────────────────┤        ├───────────────────┤       ├───────────────────┤
 │• Report Defects   │        │• Assigned Backlog │       │• User Governance  │
 │• Track Submissions│        │• Testing Queue    │       │• Project Control  │
 │• Verify Fixes     │        │• Resolution Notes │       │• Defect Triage    │
 │• Close / Reopen   │        │• Sprint Execution │       │• Sprint Approvals │
 └───────────────────┘        └───────────────────┘       └───────────────────┘
```

### 1. 👤 USER Workspace (`/user-dashboard`)
- **Target Audience:** End-users, QA reporters, and client stakeholders.
- **Key Capabilities:**
  - Submit new defect reports with severity ratings, reproducible steps, and attachments.
  - Monitor live defect resolution status via interactive KPI cards.
  - Verify submitted resolutions and execute final closure (`RESOLVED` $\rightarrow$ `CLOSED`).
  - Request rework by reopening defects (`RESOLVED` / `CLOSED` $\rightarrow$ `REOPENED`).

### 2. 👨‍💻 DEVELOPER Workspace (`/developer-dashboard`)
- **Target Audience:** Software engineers and technical quality validators.
- **Key Capabilities:**
  - View prioritized defects assigned by administration.
  - Advance issues through active engineering states (`IN_DEVELOPMENT` $\rightarrow$ `IN_REVIEW` $\rightarrow$ `IN_TESTING`).
  - Execute pre-release testing in the **Testing & Validation Queue**.
  - Submit defect resolutions with root-cause summaries (`IN_TESTING` $\rightarrow$ `RESOLVED`).
  - Participate in active Agile sprints and monitor team workload indicators.

### 3. 🛡️ ADMIN Workspace (`/admin-dashboard`)
- **Target Audience:** Engineering managers, system administrators, and project leads.
- **Key Capabilities:**
  - Platform user management: account activation, deactivation, and role changes.
  - Project administration: creation, metadata management, and test fixture isolation.
  - Defect assignment matrix: matching unassigned defects to developers based on workload and expertise.
  - Sprint review & governance: approving completed sprints or requesting targeted revisions.
  - Live system health telemetry: database latency, WebSocket connectivity, and AI provider status.

### 🔄 Backward-Compatible Legacy Routes
For seamless backward compatibility with earlier project milestones, legacy tester URLs redirect transparently:
- `/tester-dashboard` $\longrightarrow$ Redirects to `/developer-dashboard`
- `/tester-sprints` $\longrightarrow$ Redirects to `/sprints`
- `/tester-issues` $\longrightarrow$ Redirects to `/developer-dashboard`

---

## ⚙️ Environment Configuration

Frontend environment variables are configured in `frontend/.env`. Refer to `frontend/.env.example`:

```bash
# Backend REST API base URL
VITE_API_BASE_URL=http://127.0.0.1:8000

# Backend WebSocket base URL
VITE_WS_BASE_URL=ws://127.0.0.1:8000
```

---

## 📦 Setup & Development Workflow

### Prerequisites
- **Node.js:** `v18.0.0` or higher (LTS recommended)
- **Package Manager:** `npm` (`v9.0.0`+) or `pnpm`

### Installation
```bash
# Navigate to the frontend directory
cd frontend

# Install project dependencies
npm install
```

### Development Server
```bash
# Launch Vite development server with Hot Module Replacement (HMR)
npm run dev
```
The application will be accessible at: `http://localhost:5173`

### Production Build & Type Checking
```bash
# Run TypeScript compilation check and create optimized production bundle
npm run build
```
Output artifacts are generated in the `dist/` directory.

### Preview Production Build
```bash
# Locally preview the built production bundle
npm run preview
```

---

## 📂 Directory Structure

```text
frontend/
├── dist/                     # Optimized production bundle output
├── public/                   # Static assets (favicons, manifest)
├── src/
│   ├── api/                  # Axios/Fetch clients and typed REST API services
│   ├── components/
│   │   ├── ai/               # AI Assistant modal and thinking indicator widgets
│   │   ├── common/           # Reusable UI primitives, Plotly charts, loaders
│   │   ├── dashboard/        # Role dashboard widgets, queues, verification modals
│   │   └── layout/           # Navbar, Sidebar, PageContainer, SwitchRoleModal
│   ├── context/              # AuthContext (JWT/user state), ToastContext
│   ├── hooks/                # useAuth, useWebSocket, useDebounce custom hooks
│   ├── pages/
│   │   ├── auth/             # Login, Register, OTP Verification, Password Reset
│   │   ├── dashboard/        # UserDashboard, DeveloperDashboard
│   │   ├── AdminPage.tsx     # Centralized Admin Management Console
│   │   ├── AnalyticsPage.tsx # Advanced defect and quality analytics charts
│   │   └── SprintsPage.tsx   # Agile sprint iteration planning & backlog
│   ├── routes/               # AppRoutes router definitions & ProtectedRoute guard
│   ├── types/                # TypeScript models (auth, issue, sprint, project)
│   └── utils/                # PDF generation helpers, date/status formatters
├── index.html                # Single-page application root HTML
├── package.json              # NPM dependencies and build scripts
├── tsconfig.json             # TypeScript project references
└── vite.config.ts            # Vite build configuration and path aliases
```

---

## 🧪 Quality Assurance & Build Verification

The frontend codebase is validated with:
1. **Strict TypeScript Compilation:** `tsc -b` ensures complete compile-time type safety.
2. **Optimized Rollup Chunking:** Dynamic vendor chunk splitting maintains fast first-contentful-paint (FCP).
3. **Route Protection Testing:** Automated browser tests verify unauthorized users cannot access restricted role routes.
