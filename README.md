# 🐞 TracePilot — Backend

### Intelligent Software Defect Tracking & Agile Project Management System

TracePilot is a production-oriented **FastAPI backend** for software defect tracking, project management, Agile sprint planning, backlog management, analytics, notifications, audit logging, and reporting.

The backend manages the complete defect lifecycle from **issue creation and assignment through testing, resolution, sprint execution, analytics, and reporting**.

---

## 🚀 Version

| Property                    | Details               |
| --------------------------- | --------------------- |
| **Current Version**         | `v1.0.0`              |
| **Status**                  | 🟢 Active Development |
| **Backend Framework**       | FastAPI               |
| **Database**                | PostgreSQL            |
| **ORM**                     | SQLAlchemy            |
| **Migrations**              | Alembic               |
| **Authentication**          | JWT + Email OTP       |
| **Real-Time Communication** | WebSocket             |
| **Testing**                 | Pytest                |

---

# 📌 Overview

TracePilot provides a centralized backend for managing software development and defect-tracking workflows.

The backend provides APIs for:

* 🔐 Authentication and authorization
* 👥 Role-Based Access Control (RBAC)
* 🐞 Issue and defect tracking
* 📁 Project management
* 🏃 Agile sprint planning
* 📋 Backlog management
* 📊 Sprint analytics
* 📉 Burndown tracking
* ⚖️ Team workload analysis
* 🔔 Real-time notifications
* 📝 Audit logging
* 💬 Issue comments
* 📎 File attachments
* 📈 Advanced analytics
* 📄 CSV reporting
* 📑 PDF sprint reports
* 🔄 Issue rollover and sprint management
* 🔗 GitHub/Webhook integration
* 🤖 **AI Testing Assistant** (Gemini-powered chatbot inside Tester Dashboard)

---

# 🤖 AI Testing Assistant

The Tester Dashboard includes a built-in AI Testing Assistant powered by **Google Gemini**.

## What it does

| Feature | Description |
|---|---|
| **General Chat** | Ask any QA/testing question; AI answers with markdown |
| **Defect Analysis** | Full structured analysis: root causes, test scenarios, edge cases |
| **Test Case Generation** | Positive, negative, boundary, regression cases |
| **Reproduction Steps** | Detailed, step-by-step reproduction guides |
| **Root Cause Analysis** | Advisory investigation with layered analysis |
| **Sprint Summary** | AI analysis of sprint health, risks, and focus areas |
| **Explain Metrics** | Plain-language explanation of TracePilot analytics |
| **Quick Actions** | One-click prompt templates with issue/sprint context |

> **Advisory only** — The AI never modifies any data. All suggestions must be acted on through the TracePilot UI by the appropriate team member.

## Setup

**Step 1**: Get a free Gemini API key at [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey).

**Step 2**: Edit `backend/.env`:

```env
AI_ENABLED=true
GEMINI_API_KEY=your-key-here
AI_MODEL=gemini-2.5-flash
```

**Step 3**: Restart the backend server. The AI chatbot will appear live in the Tester Dashboard.

> ⚠️ **Security**: Never commit your `GEMINI_API_KEY` to version control. It is already in `.gitignore` via `.env`.

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/ai/health` | Service availability check |
| `POST` | `/ai/chat` | General chat with optional issue/sprint context |
| `POST` | `/ai/analyze-issue` | Structured defect analysis |
| `POST` | `/ai/generate-test-cases` | Structured test cases |
| `POST` | `/ai/reproduction-steps` | Detailed reproduction guide |
| `POST` | `/ai/root-cause` | Root cause analysis |
| `POST` | `/ai/sprint-summary` | Sprint health analysis |
| `POST` | `/ai/explain-metrics` | Metrics explanation |

All AI endpoints require **TESTER** or **ADMIN** role.

---

# 👥 Supported Roles

TracePilot currently uses three application roles:

| Role     | Access                                                                                         |
| -------- | ---------------------------------------------------------------------------------------------- |
| `ADMIN`  | System administration, project management, sprint management, analytics and approval workflows |
| `TESTER` | Testing workflow, assigned sprint work, issue verification and defect-related activities       |
| `USER`   | Standard authenticated application access                                                      |

> **Note:** The application workflow no longer uses a `DEVELOPER` role. A legacy PostgreSQL enum value may remain for database compatibility, but it is not an active application role.

---

# 🔐 Authentication & Security

TracePilot provides secure authentication and authorization mechanisms.

### Features

* JWT-based authentication
* Secure password hashing
* Email OTP verification
* Role-Based Access Control
* Protected API routes
* Dependency-based authorization
* Role-specific resource access
* Token-based authenticated requests
* Secure environment configuration

### Authentication Flow

```text
User
 │
 ▼
Login / Registration
 │
 ▼
Authentication
 │
 ▼
JWT Token
 │
 ▼
Protected API
 │
 ▼
Role Authorization
 │
 ├── ADMIN
 ├── TESTER
 └── USER
```

---

# 🐞 Issue & Defect Management

TracePilot supports the complete software defect management lifecycle.

### Features

* Create issues
* Update issues
* Assign issues
* Track issue status
* Set priority
* Set severity
* Add descriptions
* Track reporters
* Track testers
* Estimate effort
* Search issues
* Filter issues
* Sort issues
* Bulk issue operations
* Assign issues to sprints
* Return issues to backlog
* Track resolution timestamps
* Add comments
* Attach files
* Maintain issue history

### Issue Workflow

```text
Create Issue
     │
     ▼
Issue Assignment
     │
     ▼
Sprint Planning
     │
     ▼
Testing / Work
     │
     ▼
Resolution
     │
     ▼
Verification
     │
     ▼
Completed
```

---

# 📁 Project Management

Projects provide the primary workspace for organizing development activities.

### Features

* Create projects
* Update project information
* Manage project members
* Track project issues
* Manage project sprints
* Project-level analytics
* Project backlog management
* Sprint summaries
* Team workload analysis

Each project maintains:

```text
PROJECT
 ├── Members
 ├── Issues
 ├── Backlog
 ├── Sprints
 ├── Analytics
 └── Workload Data
```

---

# 🏃 Advanced Sprint Management

TracePilot provides a controlled Agile sprint lifecycle.

## Sprint Lifecycle

```text
PLANNED
   │
   ▼
ACTIVE
   │
   ▼
IN PROGRESS
   │
   ▼
AWAITING APPROVAL
   │
   ├──────────────► Request Changes
   │                       │
   │                       ▼
   │                  IN PROGRESS
   │
   ▼
COMPLETED
```

### Sprint Operations

* Create sprint
* Update sprint
* Start sprint
* Assign tester
* Begin sprint work
* Submit sprint for approval
* Approve sprint
* Request changes
* Complete sprint
* Extend sprint
* Archive sprint
* Safely delete eligible sprints
* Assign issues to sprint
* Bulk assign backlog issues
* Rollover unfinished issues
* Return unfinished issues to backlog

---

# 🟢 Single Active Sprint Rule

TracePilot enforces a project-level rule:

> **Only one sprint can be actively executed for a project at a time.**

This prevents overlapping sprint execution cycles and maintains consistent Agile workflow management.

---

# 📋 Advanced Backlog Management

The project backlog contains issues that are not currently assigned to a sprint.

### Features

* Backlog filtering
* Text search
* Status filtering
* Priority filtering
* Severity filtering
* Issue type filtering
* Sorting
* Recommended priority ordering
* Backlog aging indicators
* Bulk issue selection
* Bulk sprint assignment
* Estimated effort visibility

### Priority Recommendation

Backlog prioritization can consider:

* Severity
* Priority
* Issue age
* Resolution urgency

---

# 📊 Sprint Analytics

Sprint analytics are calculated from actual database data.

### Analytics Include

* Total issues
* Completed issues
* Remaining issues
* Completion percentage
* Sprint health
* Sprint overdue status
* Days remaining
* Days overdue
* Team workload
* Capacity hours
* Estimated effort
* Burndown information

---

# 🏥 Sprint Health

Sprint health is dynamically calculated based on sprint progress.

| Status         | Meaning                                      |
| -------------- | -------------------------------------------- |
| 🟢 `ON_TRACK`  | Sprint progress is meeting expected progress |
| 🟡 `AT_RISK`   | Sprint progress is behind expected progress  |
| 🔴 `OFF_TRACK` | Sprint is significantly behind or overdue    |

The calculation considers:

* Sprint duration
* Elapsed time
* Completion percentage
* Remaining issues
* Overdue status

---

# 📉 Sprint Burndown

TracePilot generates burndown information from actual issue completion history.

The system compares:

* **Ideal Remaining Work**
* **Actual Remaining Work**

```text
Remaining Work
10 ┤●
 9 ┤ ╲
 8 ┤  ●
 7 ┤   ╲
 6 ┤    ●
 5 ┤     ╲
 4 ┤      ●
 3 ┤       ╲
 2 ┤        ●
 1 ┤         ●
 0 ┼──────────────
     Day 1 → Day 10
```

The system does **not generate fake historical data** when sufficient completion history is unavailable. Instead, the API returns an appropriate empty state.

---

# ⚖️ Capacity Planning

Sprint capacity can be calculated using:

* Team members
* Working days
* Hours per day

### Capacity Formula

```text
Total Capacity Hours
=
Team Members
×
Working Days
×
Hours Per Day
```

### Example

```text
5 Team Members
×
10 Working Days
×
6 Hours Per Day
=
300 Capacity Hours
```

Capacity is maintained separately from issue count and estimated effort.

---

# 👥 Workload Analysis

TracePilot calculates workload distribution across team members.

Example:

| Team Member | Assigned Issues |
| ----------- | --------------: |
| Tester A    |               8 |
| Tester B    |               6 |
| Tester C    |               5 |
| Unassigned  |               2 |

This helps administrators understand workload distribution during sprint planning.

---

# 🔄 Safe Issue Rollover

TracePilot prevents unfinished issues from being lost when a sprint is completed.

### Return to Backlog

```text
CURRENT SPRINT
      │
      ▼
COMPLETE SPRINT
      │
      ▼
UNFINISHED ISSUES
      │
      ▼
PROJECT BACKLOG
```

### Move to Another Sprint

```text
CURRENT SPRINT
      │
      ▼
COMPLETE
      │
      ▼
UNFINISHED ISSUES
      │
      ▼
NEXT SPRINT
```

The system preserves:

* Issue information
* Comments
* Attachments
* Status
* Resolution information
* Audit history
* Project relationship

---

# 🗑️ Safe Sprint Deletion

TracePilot protects active workflow data.

Sprints involved in active execution or approval workflows cannot be arbitrarily deleted.

Eligible planned or completed sprints can be safely deleted according to backend validation rules.

Before deletion, linked issues are detached from the sprint instead of being deleted.

```text
Sprint
   │
   ├── Issue A ──┐
   ├── Issue B ──┤
   └── Issue C ──┘
                 │
                 ▼
          Sprint Deleted
                 │
                 ▼
       Issues Preserved
       sprint_id = NULL
```

This prevents accidental issue data loss.

---

# 🔔 Real-Time Notifications

TracePilot uses **WebSockets** for real-time communication.

Notifications can be generated for events such as:

* Sprint assignment
* Sprint started
* Sprint submission
* Sprint approval
* Changes requested
* Issue updates
* Assignment changes
* Workflow events
* System notifications

Connected users can receive updates without manually refreshing the application.

---

# 📝 Audit Logging

Important system operations are recorded through audit logs.

### Sprint Audit Actions

```text
SPRINT_CREATED
SPRINT_UPDATED
SPRINT_STARTED
SPRINT_EXTENDED
SPRINT_SUBMITTED_FOR_APPROVAL
SPRINT_APPROVED
SPRINT_CHANGES_REQUESTED
SPRINT_COMPLETED
SPRINT_ARCHIVED
SPRINT_DELETED
SPRINT_TESTER_ASSIGNED
```

### Other Auditable Activities

* Issue creation
* Issue updates
* Status changes
* Assignment changes
* Project updates
* User actions
* Workflow events

Audit logging improves:

* Traceability
* Accountability
* Debugging
* Activity monitoring
* Data integrity

---

# 📎 Comments & Attachments

TracePilot supports issue collaboration through:

### Comments

* Add comments to issues
* Track comment authors
* Maintain comment history

### Attachments

* Upload issue-related files
* Associate files with issues
* Preserve attachments during sprint rollover

---

# 📄 Sprint PDF Reports

TracePilot generates professional Sprint Reports using **ReportLab**.

Reports are generated dynamically in memory.

### Report Contents

* Sprint information
* Sprint goal
* Start date
* End date
* Sprint health
* Completion statistics
* Issue distribution
* Team workload
* Capacity information
* Estimated effort
* Generated timestamp
* Page numbering

### PDF Workflow

```text
User
 │
 ▼
Request Sprint Report
 │
 ▼
FastAPI Endpoint
 │
 ▼
Fetch Sprint Data
 │
 ▼
Calculate Analytics
 │
 ▼
Generate PDF
 │
 ▼
StreamingResponse
 │
 ▼
Browser
```

No permanent temporary PDF file is required on the server.

---

# 📈 Advanced Analytics & Reporting

TracePilot provides analytics for issues, projects, sprints, and system activity.

### Analytics Endpoints

| Endpoint                                  | Method | Access        | Description                          |
| ----------------------------------------- | ------ | ------------- | ------------------------------------ |
| `/analytics/overview`                     | `GET`  | ADMIN         | System-wide analytics                |
| `/analytics/issues/status-distribution`   | `GET`  | Authenticated | Issue status distribution            |
| `/analytics/issues/severity-distribution` | `GET`  | Authenticated | Severity distribution                |
| `/analytics/issues/trends`                | `GET`  | Authenticated | Issue creation and resolution trends |
| `/analytics/projects`                     | `GET`  | Authenticated | Project analytics                    |
| `/analytics/projects/{project_id}`        | `GET`  | Authenticated | Single project analytics             |
| `/analytics/reports/issues/export`        | `GET`  | Authenticated | CSV issue export                     |

---

# 📊 Quality & Defect Analytics

TracePilot supports analysis of:

* Issue status distribution
* Severity distribution
* Issue trends
* Resolution trends
* Project statistics
* Sprint completion
* Workload distribution
* Estimated effort
* Defect activity

These analytics are generated from application/database data rather than static demonstration values.

---

# 🔗 GitHub & Webhook Integration

TracePilot includes GitHub/webhook integration as part of its development and integration capabilities.

The backend provides webhook handling for Git-based workflow events.

Example workflow:

```text
GitHub
   │
   ▼
Webhook
   │
   ▼
TracePilot API
   │
   ▼
Webhook Processing
   │
   ▼
Issue / Project Workflow
```

Webhook endpoints are protected and validated according to the backend integration configuration.

---

# 🔒 RBAC Isolation

## ADMIN

```text
✓ System administration
✓ User management
✓ Project management
✓ Sprint management
✓ Issue management
✓ Analytics
✓ Reports
✓ Sprint approval workflow
✓ Audit access
```

## TESTER

```text
✓ Assigned testing workflow
✓ Issue testing
✓ Defect reporting
✓ Sprint work
✓ Sprint submission
✓ Relevant project access
✗ System administration
✗ User administration
✗ Sprint approval
```

## USER

```text
✓ Standard authenticated access
✓ Authorized application resources
✗ Administrative operations
```

---

# 🏗️ Technology Stack

| Technology     | Purpose                      |
| -------------- | ---------------------------- |
| **Python**     | Backend programming language |
| **FastAPI**    | REST API framework           |
| **PostgreSQL** | Primary relational database  |
| **SQLAlchemy** | ORM and database operations  |
| **Alembic**    | Database migrations          |
| **Pydantic**   | Validation and serialization |
| **JWT**        | Authentication               |
| **WebSocket**  | Real-time communication      |
| **ReportLab**  | PDF generation               |
| **Pytest**     | Automated testing            |

---

# 📂 Project Structure

```text
backend/
│
├── alembic/
│   ├── env.py
│   └── versions/
│       └── Database migration files
│
├── app/
│   │
│   ├── database/
│   │   ├── base.py
│   │   └── session.py
│   │
│   ├── models/
│   │   ├── user.py
│   │   ├── project.py
│   │   ├── issue.py
│   │   ├── sprint.py
│   │   └── audit_log.py
│   │
│   ├── schemas/
│   │   ├── user.py
│   │   ├── project.py
│   │   ├── issue.py
│   │   └── sprint.py
│   │
│   ├── routes/
│   │   ├── auth.py
│   │   ├── users.py
│   │   ├── projects.py
│   │   ├── issues.py
│   │   ├── sprints.py
│   │   └── analytics.py
│   │
│   ├── services/
│   │   ├── auth_service.py
│   │   ├── issue_service.py
│   │   ├── sprint_service.py
│   │   ├── analytics_service.py
│   │   └── pdf_service.py
│   │
│   ├── utils/
│   │   ├── security.py
│   │   └── dependencies.py
│   │
│   └── main.py
│
├── tests/
│
├── requirements.txt
├── alembic.ini
└── README.md
```

---

# ⚙️ Installation

## 1️⃣ Clone Repository

```powershell
git clone https://github.com/AjayKumarKR07/TracePilot.git
cd TracePilot/backend
```

---

## 2️⃣ Create Virtual Environment

### Windows PowerShell

```powershell
python -m venv .venv
```

Activate:

```powershell
.\.venv\Scripts\Activate.ps1
```

---

## 3️⃣ Install Dependencies

```powershell
pip install -r requirements.txt
```

---

# 🔧 Environment Configuration

Create your environment file:

```powershell
Copy-Item .env.example .env
```

Configure the required values.

Example:

```env
DATABASE_URL=postgresql+asyncpg://username:password@localhost/bugtracker_db

SECRET_KEY=your_secret_key

ALGORITHM=HS256

ACCESS_TOKEN_EXPIRE_MINUTES=60
```

> Never commit `.env` files, database credentials, JWT secrets, email credentials, or other sensitive configuration to Git.

---

# 🗄️ Database Setup

Ensure PostgreSQL is running.

Create the required database:

```text
bugtracker_db
```

Configure the database connection in `.env`.

---

# 🔄 Database Migrations

Apply migrations:

```powershell
alembic upgrade head
```

Check the current migration:

```powershell
alembic current
```

View migration history:

```powershell
alembic history
```

---

# ▶️ Run Development Server

From the `backend` directory:

```powershell
uvicorn app.main:app --reload --port 8000
```

Backend:

```text
http://127.0.0.1:8000
```

---

# 📚 API Documentation

FastAPI automatically generates interactive API documentation.

### Swagger UI

```text
http://127.0.0.1:8000/docs
```

### ReDoc

```text
http://127.0.0.1:8000/redoc
```

---

# ❤️ Health Check

| Endpoint      | Description           |
| ------------- | --------------------- |
| `GET /`       | TracePilot API status |
| `GET /health` | Backend health        |
| `GET /docs`   | Swagger UI            |

Example health response:

```json
{
  "status": "healthy",
  "service": "TracePilot API"
}
```

---

# 🏃 Sprint API Overview

| Endpoint                                | Method   | Description                   |
| --------------------------------------- | -------- | ----------------------------- |
| `/sprints`                              | `POST`   | Create sprint                 |
| `/sprints`                              | `GET`    | List sprints                  |
| `/sprints/{id}`                         | `GET`    | Get sprint                    |
| `/sprints/{id}`                         | `PATCH`  | Update sprint                 |
| `/sprints/{id}/start`                   | `POST`   | Start sprint                  |
| `/sprints/{id}/complete`                | `POST`   | Complete sprint               |
| `/sprints/{id}/extend`                  | `POST`   | Extend sprint                 |
| `/sprints/{id}/archive`                 | `POST`   | Archive sprint                |
| `/sprints/{id}`                         | `DELETE` | Safely delete eligible sprint |
| `/sprints/{id}/analytics`               | `GET`    | Sprint analytics              |
| `/sprints/{id}/report`                  | `GET`    | Download PDF report           |
| `/sprints/project/{project_id}/summary` | `GET`    | Project sprint summary        |

---

# 📋 Backlog API Overview

| Endpoint                               | Method | Description                      |
| -------------------------------------- | ------ | -------------------------------- |
| `/issues?project_id={id}&backlog=true` | `GET`  | Get project backlog              |
| `/issues/bulk-assign-sprint`           | `POST` | Assign multiple issues to sprint |

---

# 🧪 Testing

Run the complete backend test suite:

```powershell
pytest
```

Verbose output:

```powershell
pytest -v
```

---

# 🔍 Code Quality

Recommended checks:

```powershell
flake8
```

Type checking:

```powershell
mypy app
```

---

# 🛡️ Data Integrity & Safety

TracePilot implements several safeguards:

* Cross-project sprint assignment validation
* Single active sprint per project
* Controlled sprint lifecycle
* Sprint approval workflow
* Safe sprint deletion
* Issue preservation during sprint deletion
* Unfinished issue rollover
* No issue data loss during sprint completion
* PostgreSQL enum migration compatibility
* Audit logging
* Role-based authorization
* Transactional bulk operations
* Project-level data validation

---

# 🗺️ System Workflow

```text
PROJECT
   │
   ├── BACKLOG
   │      │
   │      └── Issues
   │
   └── SPRINT
          │
          ├── PLANNED
          │
          ▼
        ACTIVE
          │
          ▼
      IN PROGRESS
          │
          ├── Testing
          ├── Issue Updates
          └── Resolution
          │
          ▼
   AWAITING APPROVAL
          │
          ├──────────────► REQUEST CHANGES
          │                       │
          │                       ▼
          │                  IN PROGRESS
          │
          ▼
       COMPLETED
          │
          ▼
       ARCHIVED
```

---

# 📦 Reporting

## CSV Reports

Issue data can be exported for:

* Project analysis
* External reporting
* Management review
* Spreadsheet analysis

## PDF Sprint Reports

Sprint reports include:

```text
Sprint Details
Sprint Goal
Progress Metrics
Sprint Health
Issue Statistics
Team Workload
Capacity Information
Estimated Effort
Report Timestamp
Page Numbers
```

---

# 🛣️ Development Roadmap

## ✅ Completed

* [x] Project foundation
* [x] PostgreSQL integration
* [x] Alembic migrations
* [x] JWT authentication
* [x] Email OTP
* [x] Role-Based Access Control
* [x] Project management
* [x] Issue tracking
* [x] Comments
* [x] File attachments
* [x] Audit logging
* [x] Real-time notifications
* [x] Advanced analytics
* [x] CSV reporting
* [x] Agile sprint planning
* [x] Advanced backlog management
* [x] Sprint analytics
* [x] Burndown data
* [x] Capacity planning
* [x] Sprint health calculation
* [x] Team workload analysis
* [x] Sprint approval workflow
* [x] Safe sprint deletion
* [x] Issue rollover
* [x] PDF sprint reports
* [x] GitHub/webhook integration
* [x] Automated backend test coverage

## 🚧 Planned Improvements

* [ ] Automated scheduled sprint reminders
* [ ] Improved email notifications
* [ ] Sprint templates
* [ ] Advanced velocity forecasting
* [ ] Machine-learning based issue prioritization
* [ ] Extended CI/CD integration
* [ ] Docker deployment
* [ ] Kubernetes deployment
* [ ] Production monitoring
* [ ] Performance optimization
* [ ] Advanced AI-assisted defect analysis

---

# 📌 Version History

## `v1.0.0`

### Major Features

* Advanced Sprint Planning
* Advanced Backlog Management
* Sprint Lifecycle Management
* Tester Assignment
* Sprint Approval Workflow
* Capacity Planning
* Sprint Health Analytics
* Real Burndown Data
* Team Workload Analysis
* Safe Issue Rollover
* Bulk Sprint Assignment
* Sprint PDF Reports
* Real-Time Notifications
* Audit Logging
* Enhanced RBAC Validation
* GitHub/Webhook Integration
* Advanced Analytics

---

# 🤝 Contributing

Contributions are welcome.

Recommended workflow:

```text
Fork Repository
      ↓
Create Feature Branch
      ↓
Develop Feature
      ↓
Run Tests
      ↓
Create Pull Request
      ↓
Code Review
      ↓
Merge
```

Before submitting changes:

```powershell
pytest
flake8
mypy app
```

---

# 🔐 Security

Never commit:

* `.env`
* Database passwords
* JWT secrets
* Email credentials
* API keys
* Production configuration
* Private credentials

Use environment variables for sensitive configuration.

---

# 📄 License

This project is currently intended for **educational and development purposes**.

A production license should be added before commercial deployment.

---

# 👨‍💻 Author

**TracePilot Development Team**

GitHub:

`https://github.com/AjayKumarKR07/TracePilot`

---

# ⭐ Project Status

🟢 **Actively Developed**

TracePilot currently provides a comprehensive backend foundation for:

> **Defect Tracking + Project Management + Agile Sprint Planning + Backlog Management + Sprint Analytics + Real-Time Notifications + Audit Logging + Reporting + GitHub Integration**

---

<p align="center">

**🐞 TracePilot**

**Track. Resolve. Deliver.**

Built with ❤️ using **FastAPI, PostgreSQL, SQLAlchemy and modern Agile principles.**

</p>
