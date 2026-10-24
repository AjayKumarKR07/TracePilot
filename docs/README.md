# 📚 TracePilot Documentation Index

Welcome to the TracePilot project documentation repository.

## 📁 Repository Documentation Directory Structure

- **[System Overview & Architecture](../README.md)**: Main project documentation, defect state machines, Agile sprint rules, and visual showcase.
- **[Backend Technical Guide](../backend/README.md)**: FastAPI REST API architecture, database migrations, security dependencies, and testing instructions.
- **[Frontend Technical Guide](../frontend/README.md)**: React 19 + TypeScript architecture, Tailwind design tokens, Plotly charts, and role-based route guards.
- **[Technical Milestone Report](../report.md)**: Detailed report on workflow automation, role governance, and collaboration state machines.
- **[Milestone 3 LaTeX Source](../report.tex)**: Academic submission document formatting and structural specifications.

## 🏛️ Architecture & Specifications Overview

| Document Area | Target Audience | Location |
| :--- | :--- | :--- |
| **Defect Lifecycle Specification** | All Roles | `README.md` Section: *Defect Lifecycle* |
| **Agile Sprint & Rollover Rules** | Developers & Admins | `README.md` Section: *Advanced Sprint Management* |
| **API Endpoints & Schemas** | Backend & API Consumers | Swagger UI at `/docs` or ReDoc at `/redoc` |
| **Environment Configuration** | System Administrators | `backend/.env.example` & `frontend/.env.example` |
| **Automated Test Harness** | QA Engineers | `backend/tests/` & `scripts/verify_e2e_workflow.py` |
