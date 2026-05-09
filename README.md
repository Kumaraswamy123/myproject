# Campus Issue Tracker

A full-stack Issue Tracking Platform for campuses or companies where informal complaints currently cause delays and weak accountability.

The system lets users raise complaints, lets admins assign and resolve them, and keeps a transparent activity timeline for every issue.

## Features

- Simulated token-based authentication
- Reporter and admin roles
- User signup and login
- Issue creation with category, priority, location, and description
- Admin assignment, SLA due date, status updates, priority changes, and resolution notes
- Comments and timeline history for accountability
- Search and filtering by status, category, priority, assignee, and text
- JSON-file persistence as the database layer
- Responsive React frontend served by the Node backend

## Tech Stack

- Frontend: React 18, HTML, CSS
- Backend: Node.js HTTP API
- Database: JSON persistence file at `server/data/db.json`
- Architecture style: API gateway plus service-layer separation in a single demo process

The app vendors React browser builds in `frontend/vendor/` so it runs without `npm install`.

## Run Locally

```bash
node server/index.js
```

Open:

```text
http://localhost:3000
```

You can also run:

```bash
npm start
```

if your machine has `npm` available.

## Run API Tests

```bash
node --test tests/api.test.mjs
```

The API tests launch a temporary localhost server with an isolated JSON database, then verify response bodies and status codes for authentication, validation, issue CRUD, comments, stats, permissions, filtering, and deletion.

## Rate Limiting

API requests are rate limited in memory. Defaults:

```text
RATE_LIMIT_MAX=120
RATE_LIMIT_WINDOW_MS=60000
```

Authenticated requests are limited by bearer token, and unauthenticated requests are limited by client IP. The API returns `429 Too Many Requests` with `Retry-After` and `X-RateLimit-*` headers when the quota is exceeded.

## Demo Accounts

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@campus.local` | `admin123` |
| Admin | `network@campus.local` | `network123` |
| User | `asha@student.local` | `user123` |

## Main Workflows

1. Login as a user and raise a complaint.
2. Login as an admin and open the issue queue.
3. Assign the issue, set a due date, update status, and add resolution notes.
4. Add comments from either role.
5. Inspect the accountability timeline for the full audit trail.

## Folder Structure

```text
frontend/
  assets/                  local visual asset used in the login screen
  src/app.js               React UI and state management
  src/styles.css           responsive UI styling
  vendor/                  vendored React browser builds
server/
  data/db.json             runtime JSON database created on first run
  db.js                    persistence helpers and seed data
  index.js                 API routes, static server, and gateway
  security.js              token and password helpers
docs/
  API.md
  ARCHITECTURE.md
  DB_SCHEMA.md
  COMPONENT_HIERARCHY.md
  WIREFRAMES.md
  AI_USAGE_LOG_TEMPLATE.md
  THIRD_PARTY.md
```

## Assignment Documentation

- API documentation: `docs/API.md`
- OpenAPI specification: `docs/openapi.json`
- Architecture: `docs/ARCHITECTURE.md`
- DB schema: `docs/DB_SCHEMA.md`
- Component hierarchy: `docs/COMPONENT_HIERARCHY.md`
- UI wireframes: `docs/WIREFRAMES.md`
- AI usage template: `docs/AI_USAGE_LOG_TEMPLATE.md`

## Academic Honesty Note

The assignment document says AI-generated reflection or log entries should not be submitted as your own. The AI usage file is therefore a template and checklist. Fill it with your own prompts, decisions, debugging notes, and reflection before submission.
