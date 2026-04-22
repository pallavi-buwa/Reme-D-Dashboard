# Reme-D Diagnostic Workflow System

A structured diagnostic complaint management platform for Reme-D laboratory equipment support teams. Replaces manual ticketing with a schema-driven intake form, automatic prioritization engine, routing engine, and a full internal dashboard.

---

## Quick Start

### Prerequisites
- Node.js 22.5+ (uses the built-in `node:sqlite` — no native compilation needed)
- npm

### Setup

```bash
# 1. Install all dependencies
npm run setup

# 2. Start both servers (API + frontend dev server)
npm run dev
```

- **Customer Form**: http://localhost:5173
- **Staff Dashboard**: http://localhost:5173/login
- **API**: http://localhost:3001/api

---

## Default Accounts

| Email | Password | Role |
|-------|----------|------|
| admin@remed.com | Admin@123 | Admin (full control) |
| specialist@remed.com | Spec@123 | Technical Specialist |
| manager@remed.com | Manager@123 | Account Manager |
| viewer@remed.com | View@123 | Viewer (read-only) |

---

## Architecture

```
/
├── server/                 Node.js + Express API
│   ├── index.js            Express app entry point
│   ├── database.js         SQLite (node:sqlite) setup + seed data
│   ├── schema.json         Single source of truth for form structure
│   ├── engines/
│   │   ├── priority.js     Rule-based priority evaluator (P0–P3)
│   │   ├── routing.js      Team/role routing engine
│   │   └── signals.js      Derived diagnostic signals extractor
│   ├── middleware/
│   │   └── auth.js         JWT auth + role guards
│   └── routes/
│       ├── auth.js         POST /login, GET /me
│       ├── schema.js       GET /schema
│       ├── complaints.js   CRUD + submit + CSV export
│       ├── admin.js        Users, priority rules, routing rules
│       └── analytics.js    Aggregated stats + charts data
│
└── client/                 React 18 + Vite + Tailwind CSS
    └── src/
        ├── App.jsx          Router + protected routes
        ├── api/index.js     Axios client with JWT interceptor
        ├── context/         Auth context (JWT stored in localStorage)
        ├── components/
        │   ├── form/        Dynamic multi-step wizard (schema-driven)
        │   │   ├── FormWizard.jsx   Step controller + progress bar
        │   │   ├── FormStep.jsx     Per-section field renderer
        │   │   └── fields/          TextField, Radio, Dropdown, Checkbox, DateTime, File
        │   └── Layout.jsx   Staff layout with nav + role-aware links
        └── pages/
            ├── SubmitComplaint.jsx   Public form (fully dynamic from JSON schema)
            ├── Login.jsx
            ├── Dashboard.jsx         Complaint table with filters + 4 views
            ├── ComplaintDetail.jsx   Full detail + status/assign/notes/history
            ├── Analytics.jsx         Charts: priority, status, category, 30d trend
            └── Admin.jsx             User management + rule editor (priority + routing)
```

---

## Key Features

### Dynamic Form Generation
The entire multi-step form is generated from `server/schema.json`. No fields are hardcoded in the UI. Conditional fields (e.g., `blood_type` shown only when `sample_type = Blood`) are driven by `condition` metadata in the schema.

### Priority Engine (P0–P3)
Rules live in the database — not hardcoded. Admins can add, edit, reorder, or deactivate rules at runtime. Evaluated in `order_index` order; first match wins.

| Priority | Default Rule |
|----------|-------------|
| **P0** | Device not working + Hospital lab |
| **P1** | Power issue; IC failure all samples; No amplification + no FAM; Low RFU all samples |
| **P2** | Reagent issue + improper storage; Protocol not followed |
| **P3** | Device fully functional + single sample affected |

### Routing Engine
Category → Team, Device type → Specialist, P0/P1 → Manager escalation. All rules configurable in Admin panel. A single complaint can match multiple routing rules (e.g., both team assignment and escalation).

### Complaint Lifecycle
`New → Triaged → Assigned → In Progress → Escalated → Resolved → Closed`

Full status history and assignment history tracked per complaint with timestamps and actor names.

### Derived Signals
Boolean diagnostic flags extracted at submission (`complete_pcr_failure`, `systemic_assay_failure`, `critical_patient_risk`, etc.) and stored alongside each complaint for fast triage review.

---

## Sample Data (pre-loaded on first run)

| Ticket | Lab | Device | Issue | Priority |
|--------|-----|--------|-------|----------|
| RMD-2024-0001 | Hospital, Cairo | PseeR 32 | No amplification + IC failure, device not working | **P0** |
| RMD-2024-0002 | Private Lab | Extractor | Abnormal curve, protocol not followed | **P2** |
| RMD-2024-0003 | Blood Bank | PseeR 16 | Low RFU all samples | **P1** |

---

## Storage

- Database: `server/data/remed.db` (SQLite, auto-created)
- File uploads: `server/uploads/`
- JWT secret: set `JWT_SECRET` env var in production (defaults to a dev key)
