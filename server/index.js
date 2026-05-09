import http from 'node:http';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createId, createToken, hashPassword, now, verifyPassword } from './security.js';
import { clearSessions, ensureDb, readDb, transact } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const FRONTEND_DIR = path.join(ROOT_DIR, 'frontend');
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '127.0.0.1';
const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS || 60_000);
const RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX || 120);

const CATEGORIES = ['Facilities', 'Network', 'Equipment', 'Safety', 'Cleanliness', 'Other'];
const PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];
const STATUSES = ['Open', 'Assigned', 'In Progress', 'Resolved', 'Reopened', 'Closed', 'Rejected'];
const TERMINAL_STATUSES = new Set(['Closed', 'Rejected']);
const rateLimitBuckets = new Map();

function sendJson(res, statusCode, payload, headers = {}) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers
  });
  res.end(JSON.stringify(payload));
}

function sendError(res, statusCode, message, details = undefined, headers = {}) {
  sendJson(res, statusCode, { error: message, details }, headers);
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';

    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        reject(Object.assign(new Error('Request body too large'), { statusCode: 413 }));
        req.destroy();
      }
    });

    req.on('end', () => {
      if (!body) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch {
        reject(Object.assign(new Error('Invalid JSON body'), { statusCode: 400 }));
      }
    });

    req.on('error', reject);
  });
}

function requireFields(payload, fields) {
  const missing = fields.filter((field) => {
    const value = payload[field];
    return typeof value !== 'string' || value.trim() === '';
  });

  if (missing.length) {
    const error = new Error('Missing required fields');
    error.statusCode = 400;
    error.details = missing;
    throw error;
  }
}

function cleanString(value, fallback = '') {
  if (typeof value !== 'string') {
    return fallback;
  }
  return value.trim();
}

function publicUser(user) {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    department: user.department || ''
  };
}

function issuePresenter(issue, db) {
  const reporter = db.users.find((user) => user.id === issue.reporterId);
  const assignee = db.users.find((user) => user.id === issue.assigneeId);

  return {
    ...issue,
    reporter: publicUser(reporter),
    assignee: publicUser(assignee)
  };
}

function getToken(req) {
  const header = req.headers.authorization || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : '';
}

function getClientIp(req) {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
    return forwardedFor.split(',')[0].trim();
  }

  return req.socket.remoteAddress || 'unknown';
}

function getRateLimitKey(req) {
  const token = getToken(req);
  return token ? `token:${token}` : `ip:${getClientIp(req)}`;
}

function cleanupRateLimitBuckets(timestamp) {
  for (const [key, bucket] of rateLimitBuckets.entries()) {
    if (bucket.resetAt <= timestamp) {
      rateLimitBuckets.delete(key);
    }
  }
}

function rateLimitHeaders(bucket, timestamp) {
  const resetSeconds = Math.ceil(bucket.resetAt / 1000);
  const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - timestamp) / 1000));

  return {
    'X-RateLimit-Limit': String(RATE_LIMIT_MAX),
    'X-RateLimit-Remaining': String(Math.max(0, RATE_LIMIT_MAX - bucket.count)),
    'X-RateLimit-Reset': String(resetSeconds),
    'Retry-After': String(retryAfterSeconds)
  };
}

function applyRateLimit(req, res, url) {
  if (url.pathname === '/api/health' || RATE_LIMIT_MAX <= 0) {
    return true;
  }

  const timestamp = Date.now();
  cleanupRateLimitBuckets(timestamp);

  const key = getRateLimitKey(req);
  let bucket = rateLimitBuckets.get(key);

  if (!bucket || bucket.resetAt <= timestamp) {
    bucket = {
      count: 0,
      resetAt: timestamp + RATE_LIMIT_WINDOW_MS
    };
    rateLimitBuckets.set(key, bucket);
  }

  bucket.count += 1;
  const headers = rateLimitHeaders(bucket, timestamp);

  if (bucket.count > RATE_LIMIT_MAX) {
    sendError(
      res,
      429,
      'Too many requests. Please wait before trying again.',
      {
        limit: RATE_LIMIT_MAX,
        retryAfterSeconds: Number(headers['Retry-After'])
      },
      headers
    );
    return false;
  }

  const allowedHeaders = { ...headers };
  delete allowedHeaders['Retry-After'];
  for (const [name, value] of Object.entries(allowedHeaders)) {
    res.setHeader(name, value);
  }

  return true;
}

function getSessionUser(req, db) {
  const token = getToken(req);
  if (!token) {
    return null;
  }

  const session = db.sessions.find((item) => item.token === token);
  if (!session) {
    return null;
  }

  return db.users.find((user) => user.id === session.userId) || null;
}

function assertAuthenticated(user) {
  if (!user) {
    const error = new Error('Authentication required');
    error.statusCode = 401;
    throw error;
  }
}

function assertAdmin(user) {
  assertAuthenticated(user);
  if (user.role !== 'admin') {
    const error = new Error('Admin access required');
    error.statusCode = 403;
    throw error;
  }
}

function canSeeIssue(user, issue) {
  return user.role === 'admin' || issue.reporterId === user.id;
}

function addHistory(issue, actor, action, detail) {
  issue.history.push({
    id: createId('hist'),
    actorId: actor.id,
    actorName: actor.name,
    action,
    detail,
    createdAt: now()
  });
  issue.updatedAt = now();
}

function validateIssuePayload(payload) {
  requireFields(payload, ['title', 'category', 'priority', 'location', 'description']);

  const category = cleanString(payload.category);
  const priority = cleanString(payload.priority);

  if (!CATEGORIES.includes(category)) {
    const error = new Error('Invalid issue category');
    error.statusCode = 400;
    error.details = CATEGORIES;
    throw error;
  }

  if (!PRIORITIES.includes(priority)) {
    const error = new Error('Invalid issue priority');
    error.statusCode = 400;
    error.details = PRIORITIES;
    throw error;
  }

  return {
    title: cleanString(payload.title).slice(0, 140),
    category,
    priority,
    location: cleanString(payload.location).slice(0, 120),
    description: cleanString(payload.description).slice(0, 1200)
  };
}

function filterIssues(issues, query) {
  let result = [...issues];
  const search = cleanString(query.get('search')).toLowerCase();
  const status = cleanString(query.get('status'));
  const priority = cleanString(query.get('priority'));
  const category = cleanString(query.get('category'));
  const assigneeId = cleanString(query.get('assigneeId'));

  if (search) {
    result = result.filter((issue) => {
      return [issue.id, issue.title, issue.category, issue.location, issue.description, issue.status]
        .join(' ')
        .toLowerCase()
        .includes(search);
    });
  }

  if (status && status !== 'All') {
    result = result.filter((issue) => issue.status === status);
  }

  if (priority && priority !== 'All') {
    result = result.filter((issue) => issue.priority === priority);
  }

  if (category && category !== 'All') {
    result = result.filter((issue) => issue.category === category);
  }

  if (assigneeId && assigneeId !== 'All') {
    result =
      assigneeId === 'Unassigned'
        ? result.filter((issue) => !issue.assigneeId)
        : result.filter((issue) => issue.assigneeId === assigneeId);
  }

  return result.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

function makeStats(issues) {
  const byStatus = Object.fromEntries(STATUSES.map((status) => [status, 0]));
  const byCategory = Object.fromEntries(CATEGORIES.map((category) => [category, 0]));
  const byPriority = Object.fromEntries(PRIORITIES.map((priority) => [priority, 0]));
  const today = new Date();
  let overdue = 0;

  for (const issue of issues) {
    byStatus[issue.status] = (byStatus[issue.status] || 0) + 1;
    byCategory[issue.category] = (byCategory[issue.category] || 0) + 1;
    byPriority[issue.priority] = (byPriority[issue.priority] || 0) + 1;

    if (issue.dueDate && !TERMINAL_STATUSES.has(issue.status)) {
      const due = new Date(`${issue.dueDate}T23:59:59`);
      if (due < today) {
        overdue += 1;
      }
    }
  }

  return {
    total: issues.length,
    open: issues.filter((issue) => !TERMINAL_STATUSES.has(issue.status)).length,
    resolved: issues.filter((issue) => ['Resolved', 'Closed'].includes(issue.status)).length,
    overdue,
    byStatus,
    byCategory,
    byPriority
  };
}

async function handleApi(req, res, url) {
  const segments = url.pathname.split('/').filter(Boolean);
  const [, resource, id, child] = segments;
  const method = req.method || 'GET';

  if (method === 'GET' && resource === 'health') {
    sendJson(res, 200, {
      ok: true,
      name: 'Campus Issue Tracker API',
      timestamp: now()
    });
    return;
  }

  if (resource === 'meta' && method === 'GET') {
    sendJson(res, 200, { categories: CATEGORIES, priorities: PRIORITIES, statuses: STATUSES });
    return;
  }

  if (resource === 'auth' && id === 'signup' && method === 'POST') {
    const payload = await parseBody(req);
    requireFields(payload, ['name', 'email', 'password']);

    const result = await transact((db) => {
      const email = cleanString(payload.email).toLowerCase();
      if (db.users.some((user) => user.email.toLowerCase() === email)) {
        const error = new Error('An account already exists for this email');
        error.statusCode = 409;
        throw error;
      }

      const user = {
        id: createId('usr'),
        name: cleanString(payload.name).slice(0, 80),
        email,
        role: 'user',
        department: cleanString(payload.department, 'General').slice(0, 80),
        passwordHash: hashPassword(payload.password),
        createdAt: now()
      };
      const token = createToken();

      db.users.push(user);
      db.sessions.push({ token, userId: user.id, createdAt: now(), lastSeenAt: now() });

      return { token, user: publicUser(user) };
    });

    sendJson(res, 201, result);
    return;
  }

  if (resource === 'auth' && id === 'login' && method === 'POST') {
    const payload = await parseBody(req);
    requireFields(payload, ['email', 'password']);

    const result = await transact((db) => {
      const user = db.users.find(
        (item) => item.email.toLowerCase() === cleanString(payload.email).toLowerCase()
      );

      if (!user || !verifyPassword(payload.password, user.passwordHash)) {
        const error = new Error('Invalid email or password');
        error.statusCode = 401;
        throw error;
      }

      const token = createToken();
      db.sessions = db.sessions.filter((session) => session.userId !== user.id);
      db.sessions.push({ token, userId: user.id, createdAt: now(), lastSeenAt: now() });
      return { token, user: publicUser(user) };
    });

    sendJson(res, 200, result);
    return;
  }

  if (resource === 'auth' && id === 'logout' && method === 'POST') {
    const token = getToken(req);
    await transact((db) => {
      db.sessions = db.sessions.filter((session) => session.token !== token);
      return null;
    });
    sendJson(res, 200, { ok: true });
    return;
  }

  const db = await readDb();
  const user = getSessionUser(req, db);

  if (resource === 'auth' && id === 'me' && method === 'GET') {
    assertAuthenticated(user);
    sendJson(res, 200, { user: publicUser(user) });
    return;
  }

  if (resource === 'users' && method === 'GET') {
    assertAdmin(user);
    sendJson(res, 200, {
      users: db.users.map(publicUser).sort((a, b) => a.name.localeCompare(b.name))
    });
    return;
  }

  if (resource === 'stats' && method === 'GET') {
    assertAuthenticated(user);
    const scoped = user.role === 'admin' ? db.issues : db.issues.filter((issue) => issue.reporterId === user.id);
    sendJson(res, 200, { stats: makeStats(scoped) });
    return;
  }

  if (resource !== 'issues') {
    sendError(res, 404, 'API route not found');
    return;
  }

  if (!id && method === 'GET') {
    assertAuthenticated(user);
    const visible = user.role === 'admin' ? db.issues : db.issues.filter((issue) => issue.reporterId === user.id);
    const issues = filterIssues(visible, url.searchParams).map((issue) => issuePresenter(issue, db));
    sendJson(res, 200, { issues });
    return;
  }

  if (!id && method === 'POST') {
    assertAuthenticated(user);
    const payload = await parseBody(req);
    const valid = validateIssuePayload(payload);

    const issue = await transact((mutableDb) => {
      const createdAt = now();
      const newIssue = {
        id: createId('iss'),
        ...valid,
        status: 'Open',
        reporterId: user.id,
        assigneeId: null,
        dueDate: '',
        resolution: '',
        createdAt,
        updatedAt: createdAt,
        closedAt: null,
        comments: [],
        history: [
          {
            id: createId('hist'),
            actorId: user.id,
            actorName: user.name,
            action: 'Issue created',
            detail: `Issue reported in ${valid.category} category with ${valid.priority} priority.`,
            createdAt
          }
        ]
      };

      mutableDb.issues.push(newIssue);
      return issuePresenter(newIssue, mutableDb);
    });

    sendJson(res, 201, { issue });
    return;
  }

  const issue = db.issues.find((item) => item.id === id);
  if (!issue) {
    sendError(res, 404, 'Issue not found');
    return;
  }

  assertAuthenticated(user);
  if (!canSeeIssue(user, issue)) {
    sendError(res, 403, 'You do not have access to this issue');
    return;
  }

  if (method === 'GET' && !child) {
    sendJson(res, 200, { issue: issuePresenter(issue, db) });
    return;
  }

  if (method === 'PATCH' && !child) {
    const payload = await parseBody(req);

    const updated = await transact((mutableDb) => {
      const mutableIssue = mutableDb.issues.find((item) => item.id === id);
      const previousStatus = mutableIssue.status;

      if (user.role === 'admin') {
        const nextStatus = cleanString(payload.status, mutableIssue.status);
        if (!STATUSES.includes(nextStatus)) {
          const error = new Error('Invalid issue status');
          error.statusCode = 400;
          error.details = STATUSES;
          throw error;
        }

        const nextPriority = cleanString(payload.priority, mutableIssue.priority);
        if (!PRIORITIES.includes(nextPriority)) {
          const error = new Error('Invalid issue priority');
          error.statusCode = 400;
          error.details = PRIORITIES;
          throw error;
        }

        if (payload.assigneeId !== undefined) {
          const assigneeId = cleanString(payload.assigneeId);
          if (assigneeId && !mutableDb.users.some((candidate) => candidate.id === assigneeId && candidate.role === 'admin')) {
            const error = new Error('Assignee must be an admin user');
            error.statusCode = 400;
            throw error;
          }
          mutableIssue.assigneeId = assigneeId || null;
        }

        mutableIssue.status = nextStatus;
        mutableIssue.priority = nextPriority;
        mutableIssue.dueDate = cleanString(payload.dueDate);
        mutableIssue.resolution = cleanString(payload.resolution).slice(0, 1200);
        mutableIssue.category = CATEGORIES.includes(cleanString(payload.category))
          ? cleanString(payload.category)
          : mutableIssue.category;

        if (TERMINAL_STATUSES.has(nextStatus) || nextStatus === 'Resolved') {
          mutableIssue.closedAt = mutableIssue.closedAt || now();
        } else {
          mutableIssue.closedAt = null;
        }

        if (previousStatus !== nextStatus) {
          addHistory(mutableIssue, user, 'Status changed', `Status changed from ${previousStatus} to ${nextStatus}.`);
        } else {
          addHistory(mutableIssue, user, 'Issue updated', 'Admin updated assignment, SLA, priority, or resolution details.');
        }
      } else if (mutableIssue.reporterId === user.id) {
        if (payload.status === 'Reopened' && ['Resolved', 'Closed'].includes(mutableIssue.status)) {
          mutableIssue.status = 'Reopened';
          mutableIssue.closedAt = null;
          addHistory(mutableIssue, user, 'Reopened', 'Reporter reopened the issue for further action.');
        } else if (['Open', 'Reopened'].includes(mutableIssue.status)) {
          const valid = validateIssuePayload({ ...mutableIssue, ...payload });
          Object.assign(mutableIssue, valid);
          addHistory(mutableIssue, user, 'Issue edited', 'Reporter updated issue details before resolution.');
        } else {
          const error = new Error('Only admins can update an assigned or in-progress issue');
          error.statusCode = 403;
          throw error;
        }
      }

      return issuePresenter(mutableIssue, mutableDb);
    });

    sendJson(res, 200, { issue: updated });
    return;
  }

  if (method === 'DELETE' && !child) {
    assertAdmin(user);
    await transact((mutableDb) => {
      mutableDb.issues = mutableDb.issues.filter((item) => item.id !== id);
      return null;
    });
    sendJson(res, 200, { ok: true });
    return;
  }

  if (method === 'POST' && child === 'comments') {
    const payload = await parseBody(req);
    requireFields(payload, ['message']);

    const updated = await transact((mutableDb) => {
      const mutableIssue = mutableDb.issues.find((item) => item.id === id);
      if (!canSeeIssue(user, mutableIssue)) {
        const error = new Error('You do not have access to this issue');
        error.statusCode = 403;
        throw error;
      }

      const message = cleanString(payload.message).slice(0, 800);
      mutableIssue.comments.push({
        id: createId('com'),
        authorId: user.id,
        authorName: user.name,
        message,
        createdAt: now()
      });
      addHistory(mutableIssue, user, 'Comment added', message.slice(0, 120));

      return issuePresenter(mutableIssue, mutableDb);
    });

    sendJson(res, 201, { issue: updated });
    return;
  }

  sendError(res, 404, 'API route not found');
}

function contentType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  const types = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.ico': 'image/x-icon'
  };

  return types[extension] || 'application/octet-stream';
}

async function serveStatic(req, res, url) {
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === '/') {
    pathname = '/index.html';
  }

  const candidate = path.normalize(path.join(FRONTEND_DIR, pathname));
  if (!candidate.startsWith(FRONTEND_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  try {
    const file = await readFile(candidate);
    res.writeHead(200, {
      'Content-Type': contentType(candidate),
      'Cache-Control': candidate.includes('/vendor/') ? 'public, max-age=31536000' : 'no-cache'
    });
    res.end(file);
  } catch {
    const fallback = await readFile(path.join(FRONTEND_DIR, 'index.html'));
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
    res.end(fallback);
  }
}

await ensureDb();
await clearSessions();

const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://${req.headers.host || `${HOST}:${PORT}`}`);

  try {
    if (url.pathname.startsWith('/api/')) {
      if (!applyRateLimit(req, res, url)) {
        return;
      }

      await handleApi(req, res, url);
      return;
    }

    await serveStatic(req, res, url);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    sendError(res, statusCode, error.message || 'Unexpected server error', error.details);
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Campus Issue Tracker running at http://${HOST}:${PORT}`);
});
