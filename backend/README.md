# 🐞 TracePilot — Backend

> **Intelligent Software Defect Tracking & Agile Project Management System**  
> High-performance asynchronous REST API and real-time WebSocket backend powered by FastAPI, SQLAlchemy 2.0, and PostgreSQL.

---

## 🚀 Overview

TracePilot Backend provides an enterprise-grade service architecture engineered for automated defect tracking, role-governed workflows, Agile sprint iteration management, and advisory AI root-cause diagnostics.

### Core Capabilities:
- 🔐 **Secure JWT Authentication & RBAC:** Fine-grained role-based access control across `ADMIN`, `DEVELOPER`, and `USER` roles with OTP verification.
- 🐞 **Complete Defect Lifecycle State Machine:** Strict transitions (`REPORTED` $\rightarrow$ `ASSIGNED` $\rightarrow$ `IN_DEVELOPMENT` $\rightarrow$ `IN_REVIEW` $\rightarrow$ `IN_TESTING` $\rightarrow$ `RESOLVED` $\rightarrow$ `CLOSED` / `REOPENED`).
- 📁 **Project & Backlog Management:** Project-isolated issue tracking, priority calculation matrices, and unassigned backlog triage.
- 🏃 **Agile Sprint Execution:** Single-active-sprint enforcement per project, capacity calculation, administrative approval gates (`READY_FOR_APPROVAL`), and safe issue rollover.
- 🔔 **Real-Time WebSocket Notifications:** Full-duplex connection broadcasting instant alerts for assignments, state transitions, and sprint events.
- 📝 **Immutable Audit Trail:** Append-only activity logging capturing actor attribution, entity snapshots, and client IP addresses.
- 📎 **Secure Attachment & Comment Threads:** Magic-byte validated file storage and threaded discussion histories.
- 📊 **Quality & Defect Analytics:** High-performance aggregation queries for defect velocity, backlog aging, and team throughput.
- 📑 **High-Fidelity PDF Sprint Reporting:** Programmatic report generation built on ReportLab.
- 🤖 **Advisory AI Assistant:** Dual-provider architecture (Groq primary with Google Gemini fallback) for non-destructive root-cause diagnostics and reproduction guides.

---

## 🛠️ Technology Stack

| Component | Technology | Version | Purpose |
| :--- | :--- | :--- | :--- |
| **Language** | Python | `3.10+` / `3.14` | High-efficiency backend execution |
| **Framework** | FastAPI | `0.141.1` | High-performance asynchronous REST API framework |
| **Database** | PostgreSQL | `14+` / `18` | ACID-compliant relational data persistence |
| **ORM** | SQLAlchemy | `2.0.52` | Modern asyncio ORM with greenlet threading |
| **Migrations** | Alembic | `1.19.1` | Declarative schema revision control |
| **Validation** | Pydantic v2 | `2.13.4` | Strict request/response typing and validation |
| **Authentication** | PyJWT + Bcrypt | `2.13.0` / `5.0.0` | JWT token issuing, verification, and password hashing |
| **Real-Time** | WebSockets | `17.0.1` | Bidirectional push notification broadcasts |
| **PDF Generation**| ReportLab | `4.1.0` | Enterprise sprint metrics and summary PDF exports |
| **Testing** | Pytest | `9.1.1` | Comprehensive unit, integration, and regression tests |

---

## 📂 Project Structure

```text
backend/
├── alembic/                  # Schema migration scripts and environments
│   └── versions/             # Versioned schema migration files
├── app/
│   ├── core/                 # Settings (pydantic-settings), security, constants
│   ├── database/             # Async connection engine, session factories, base model
│   ├── dependencies/         # FastAPI injection dependencies (get_db, require_role)
│   ├── models/               # SQLAlchemy ORM models (User, Project, Issue, Sprint, AuditLog)
│   ├── routes/               # API route controllers (auth, users, projects, issues, sprints, etc.)
│   ├── schemas/              # Pydantic schemas for data serialization and validation
│   ├── services/             # Core business logic (issue_service, sprint_service, ai_service, pdf)
│   ├── utils/                # Password hashing, token generators, file validation
│   └── main.py               # Application factory, CORS middleware, router registrations
├── storage/                  # Local directory for uploaded defect attachments
├── tests/                    # Comprehensive Pytest test suites (500+ tests)
├── .env.example              # Template environment configuration file
├── alembic.ini               # Alembic database migration configuration
├── pytest.ini                # Pytest runtime configuration
└── requirements.txt          # Python library dependencies
```

---

## ⚙️ Prerequisites & Environment Setup

### 1. Prerequisites
- **Python:** `3.10` or higher (Python `3.14` fully supported with asyncio event loop selector)
- **PostgreSQL:** `14.0` or higher running locally or via Docker
- **Git**

### 2. Virtual Environment Setup

**Windows PowerShell:**
```powershell
# Navigate to the backend directory
cd backend

# Create virtual environment
python -m venv .venv

# Activate virtual environment
.\.venv\Scripts\Activate.ps1
```

**macOS / Linux:**
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
```

### 3. Install Dependencies
```bash
pip install --upgrade pip
pip install -r requirements.txt
```

### 4. Configure Environment Variables
Copy `.env.example` to `.env` and fill in your database credentials:
```bash
cp .env.example .env
```
Key configuration settings:
```ini
APP_NAME=TracePilot
APP_ENV=development
DEBUG=true

# Database parameters
DB_DRIVER=postgresql+psycopg
DB_USER=postgres
DB_PASSWORD=your_password
DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=bugtracker_db

# Security & Tokens
JWT_SECRET_KEY=generate_with_python_secrets_token_hex
ACCESS_TOKEN_EXPIRE_MINUTES=60

# AI Provider Configuration (Optional)
AI_ENABLED=true
AI_PROVIDER=groq
GROQ_API_KEY=your_groq_api_key
GROQ_MODEL=openai/gpt-oss-120b
```

---

## 🗄️ Database Migrations

Apply all schema migrations to create tables, indexes, and constraints:
```bash
# Run all pending migrations up to head
alembic upgrade head
```

To create a new migration after updating ORM models:
```bash
alembic revision --autogenerate -m "describe_migration_changes"
```

---

## ▶️ Running the Application

### Start Development Server
```bash
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

### Health Check Endpoint
Verify server and database health:
```bash
curl http://127.0.0.1:8000/health
```
Response:
```json
{
  "status": "healthy",
  "service": "TracePilot API"
}
```

---

## 📚 API Documentation & Explorer

When the server is running, interactive API documentation is available at:
- **Swagger UI:** [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs) — Interactive API explorer with token authentication support.
- **ReDoc:** [http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc) — Detailed, searchable API specification.
- **OpenAPI JSON:** [http://127.0.0.1:8000/openapi.json](http://127.0.0.1:8000/openapi.json)

---

## 🧪 Testing & Verification

TracePilot features an automated test harness covering security, RBAC enforcement, defect state machines, and API endpoints.

### Run All Pytest Suites
```bash
pytest tests -q
```
*Current Suite Status:* **509 passed, 10 skipped, 0 failures** in ~85s.

### Run End-to-End Workflow Verification Script
```bash
python ../scripts/verify_e2e_workflow.py
```
Validates the complete 14-module lifecycle across:
`USER_CREATE` $\rightarrow$ `ADMIN_TRIAGE` $\rightarrow$ `ADMIN_ASSIGN` $\rightarrow$ `DEV_INVESTIGATE` $\rightarrow$ `DEV_RESOLUTION` $\rightarrow$ `FINAL_CLOSURE` + Notifications + Audit Logging + AI fallback.

---

## 🔒 Canonical Role-Based Access Control (RBAC)

The backend enforces three authoritative roles via the `require_role(...)` dependency:

1. **`ADMIN`:**
   - Platform governance, user account management, and role promotion.
   - Project creation and defect assignment.
   - Sprint lifecycle approval (`READY_FOR_APPROVAL` $\rightarrow$ `COMPLETED`).
   - System health metrics and complete audit log oversight.

2. **`DEVELOPER`:**
   - Management of assigned defect queues.
   - State progression (`IN_DEVELOPMENT` $\rightarrow$ `IN_REVIEW` $\rightarrow$ `IN_TESTING`).
   - Pre-release testing and resolution submission (`IN_TESTING` $\rightarrow$ `RESOLVED`).
   - Active sprint participation and burndown tracking.

3. **`USER`:**
   - Defect submission and reproduction detail authoring.
   - Personal reported issue tracking.
   - Verification of completed defect resolutions (`RESOLVED` $\rightarrow$ `CLOSED`).
   - Reopening unresolved defects for rework (`RESOLVED` $\rightarrow$ `REOPENED`).
