# API Test Cases

Run the automated API test suite:

```bash
node --test tests/api.test.mjs
```

The test suite starts the backend on an isolated localhost port and uses a temporary JSON database through `DATA_DIR`, so it does not mutate the demo database.

## Covered Cases

| # | Endpoint | Scenario | Expected Status | Expected Response |
| --- | --- | --- | --- | --- |
| 1 | `GET /api/health` | API is running | `200` | `{ ok: true, name: "Campus Issue Tracker API" }` |
| 2 | `GET /api/meta` | Fetch allowed enums | `200` | Categories, priorities, statuses arrays |
| 3 | `POST /api/auth/login` | Invalid credentials | `401` | Error message |
| 4 | `POST /api/auth/login` | Valid admin credentials | `200` | Token and admin user object |
| 5 | `POST /api/auth/signup` | New reporter signup | `201` | Token and user role `user` |
| 6 | `POST /api/auth/signup` | Duplicate email | `409` | Error message |
| 7 | `GET /api/issues` | No bearer token | `401` | Authentication error |
| 8 | `GET /api/users` | Reporter tries admin-only route | `403` | Admin access error |
| 9 | `GET /api/users` | Admin lists users | `200` | User array |
| 10 | `POST /api/issues` | Missing required issue fields | `400` | Validation error and missing fields |
| 11 | `POST /api/issues` | Reporter creates valid issue | `201` | Issue object with status `Open` |
| 12 | `GET /api/issues` | Reporter lists own issues | `200` | Only reporter-visible issues |
| 13 | `PATCH /api/issues/:id` | Reporter edits an Open issue once | `200` | Updated issue object |
| 14 | `PATCH /api/issues/:id` | Reporter edits same Open issue again | `200` | Updated issue remains `Open` |
| 15 | `POST /api/issues/:id/comments` | Reporter adds comment | `201` | Issue with new comment |
| 16 | `GET /api/stats` | Admin gets dashboard summary | `200` | Valid stats object |
| 17 | `PATCH /api/issues/:id` | Admin assigns issue | `200` | Status/assignee updated |
| 18 | `PATCH /api/issues/:id` | Reporter tries editing assigned issue | `403` | Permission error |
| 19 | `GET /api/issues?status=Assigned` | Admin filters assigned issues | `200` | Matching issue list |
| 20 | `DELETE /api/issues/:id` | Reporter tries deleting issue | `403` | Admin access error |
| 21 | `DELETE /api/issues/:id` | Admin deletes issue | `200` | `{ ok: true }` |
| 22 | `GET /api/issues/:id` | Fetch deleted issue | `404` | Not found error |
| 23 | `GET /api/meta` | Request under rate limit | `200` | `X-RateLimit-*` headers show remaining quota |
| 24 | `GET /api/meta` | Request over configured rate limit | `429` | Error response with `Retry-After` header |

## Notes

- The tests use actual HTTP calls rather than mocked function calls.
- The repeated-edit case verifies that an `Open` issue can be edited more than once.
- Permission tests cover unauthenticated, reporter, and admin roles.
- Rate-limit tests start a second temporary server with `RATE_LIMIT_MAX=2`.
