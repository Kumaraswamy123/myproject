# API Documentation

Base URL:

```text
http://localhost:3000/api
```

Machine-readable OpenAPI specification:

```text
docs/openapi.json
```

Authentication uses a simulated bearer token returned by login or signup.

```http
Authorization: Bearer <token>
```

## Rate Limiting

API routes are rate limited in memory. Static frontend assets are not counted.

Default limit:

```text
120 requests per 60 seconds
```

Configuration:

| Environment Variable | Default | Purpose |
| --- | --- | --- |
| `RATE_LIMIT_MAX` | `120` | Maximum API requests allowed in a window |
| `RATE_LIMIT_WINDOW_MS` | `60000` | Window size in milliseconds |

Logged-in requests are limited by bearer token. Unauthenticated requests are limited by client IP. `GET /api/health` is exempt so monitoring checks do not consume the quota.

Rate limit headers:

```http
X-RateLimit-Limit: 120
X-RateLimit-Remaining: 119
X-RateLimit-Reset: 1777896000
```

When the limit is exceeded:

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 42
```

```json
{
  "error": "Too many requests. Please wait before trying again.",
  "details": {
    "limit": 120,
    "retryAfterSeconds": 42
  }
}
```

## Auth

### `POST /auth/signup`

Creates a reporter account.

Request:

```json
{
  "name": "Student Name",
  "email": "student@example.com",
  "password": "password123",
  "department": "Computer Science"
}
```

Response `201`:

```json
{
  "token": "generated-token",
  "user": {
    "id": "usr_x",
    "name": "Student Name",
    "email": "student@example.com",
    "role": "user",
    "department": "Computer Science"
  }
}
```

### `POST /auth/login`

Request:

```json
{
  "email": "admin@campus.local",
  "password": "admin123"
}
```

Response `200`: same shape as signup.

### `GET /auth/me`

Returns the logged-in user.

### `POST /auth/logout`

Invalidates the current token.

## Issues

### `GET /issues`

Returns visible issues. Admins see all issues; reporters see only their own issues.

Optional query parameters:

- `search`
- `status`
- `category`
- `priority`
- `assigneeId`

Example:

```http
GET /api/issues?status=In%20Progress&priority=High
```

### `POST /issues`

Creates a complaint.

Request:

```json
{
  "title": "Projector not powering on",
  "category": "Equipment",
  "priority": "Medium",
  "location": "Academic Block B, Room 203",
  "description": "Projector does not start from the remote or wall switch."
}
```

Response `201`:

```json
{
  "issue": {
    "id": "iss_x",
    "status": "Open",
    "reporterId": "usr_x",
    "history": []
  }
}
```

### `GET /issues/:id`

Returns one issue if the current user is allowed to view it.

### `PATCH /issues/:id`

Reporter behavior:

- Can edit issue details while status is `Open` or `Reopened`.
- Can reopen an issue after it is `Resolved` or `Closed`.

Admin behavior:

- Can update `status`, `priority`, `category`, `assigneeId`, `dueDate`, and `resolution`.
- Every update adds a history event.

Admin request example:

```json
{
  "status": "In Progress",
  "priority": "High",
  "category": "Network",
  "assigneeId": "usr_network",
  "dueDate": "2026-05-08",
  "resolution": "Network team is replacing the access point."
}
```

### `DELETE /issues/:id`

Admin-only deletion.

### `POST /issues/:id/comments`

Adds a comment and timeline event.

Request:

```json
{
  "message": "Technician visited the room and confirmed the fault."
}
```

## Users

### `GET /users`

Admin-only. Returns users for assignment dropdowns.

## Stats

### `GET /stats`

Returns counts for visible issues.

Response:

```json
{
  "stats": {
    "total": 2,
    "open": 2,
    "resolved": 0,
    "overdue": 0,
    "byStatus": {
      "Open": 1,
      "In Progress": 1
    }
  }
}
```

## Validation Rules

- Required issue fields: `title`, `category`, `priority`, `location`, `description`
- Valid categories: `Facilities`, `Network`, `Equipment`, `Safety`, `Cleanliness`, `Other`
- Valid priorities: `Low`, `Medium`, `High`, `Critical`
- Valid statuses: `Open`, `Assigned`, `In Progress`, `Resolved`, `Reopened`, `Closed`, `Rejected`
