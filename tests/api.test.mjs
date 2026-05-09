import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const port = 3600 + Math.floor(Math.random() * 1000);
const host = '127.0.0.1';
const baseUrl = `http://${host}:${port}/api`;

let serverProcess;
let dataDir;
let adminToken;
let reporterToken;
let createdIssueId;

async function request(pathname, { method = 'GET', token, body } = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  return { status: response.status, data };
}

async function waitForHealth(targetBaseUrl = baseUrl) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 8000) {
    try {
      const response = await fetch(`${targetBaseUrl}/health`);
      if (response.ok) {
        return;
      }
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 120));
    }
  }

  throw new Error('Timed out waiting for API server health check');
}

test.before(async () => {
  dataDir = await mkdtemp(path.join(tmpdir(), 'campus-issue-api-'));
  serverProcess = spawn(process.execPath, ['server/index.js'], {
    cwd: rootDir,
    env: {
      ...process.env,
      HOST: host,
      PORT: String(port),
      DATA_DIR: dataDir
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let stderr = '';
  serverProcess.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });

  serverProcess.once('exit', (code) => {
    if (code !== null && code !== 0 && stderr) {
      console.error(stderr);
    }
  });

  await waitForHealth();
});

test.after(async () => {
  if (serverProcess && !serverProcess.killed) {
    serverProcess.kill('SIGTERM');
  }

  if (dataDir) {
    await rm(dataDir, { recursive: true, force: true });
  }
});

test('health and metadata endpoints return valid 200 JSON responses', async () => {
  const health = await request('/health');
  assert.equal(health.status, 200);
  assert.equal(health.data.ok, true);
  assert.equal(health.data.name, 'Campus Issue Tracker API');

  const meta = await request('/meta');
  assert.equal(meta.status, 200);
  assert.ok(meta.data.categories.includes('Network'));
  assert.ok(meta.data.priorities.includes('Critical'));
  assert.ok(meta.data.statuses.includes('Open'));
});

test('login returns 200 for valid credentials and 401 for invalid credentials', async () => {
  const invalid = await request('/auth/login', {
    method: 'POST',
    body: { email: 'admin@campus.local', password: 'wrong-password' }
  });
  assert.equal(invalid.status, 401);
  assert.equal(invalid.data.error, 'Invalid email or password');

  const valid = await request('/auth/login', {
    method: 'POST',
    body: { email: 'admin@campus.local', password: 'admin123' }
  });
  assert.equal(valid.status, 200);
  assert.equal(valid.data.user.role, 'admin');
  assert.ok(valid.data.token);
  adminToken = valid.data.token;
});

test('signup returns 201 and duplicate signup returns 409', async () => {
  const signup = await request('/auth/signup', {
    method: 'POST',
    body: {
      name: 'Test Reporter',
      email: 'test.reporter@example.com',
      password: 'reporter123',
      department: 'QA'
    }
  });
  assert.equal(signup.status, 201);
  assert.equal(signup.data.user.role, 'user');
  assert.ok(signup.data.token);
  reporterToken = signup.data.token;

  const duplicate = await request('/auth/signup', {
    method: 'POST',
    body: {
      name: 'Test Reporter',
      email: 'test.reporter@example.com',
      password: 'reporter123',
      department: 'QA'
    }
  });
  assert.equal(duplicate.status, 409);
});

test('protected routes return 401 without auth and enforce admin-only access with 403', async () => {
  const unauthenticatedIssues = await request('/issues');
  assert.equal(unauthenticatedIssues.status, 401);

  const reporterUsers = await request('/users', { token: reporterToken });
  assert.equal(reporterUsers.status, 403);

  const adminUsers = await request('/users', { token: adminToken });
  assert.equal(adminUsers.status, 200);
  assert.ok(adminUsers.data.users.some((user) => user.email === 'admin@campus.local'));
});

test('issue creation validates required fields and returns 201 for valid complaints', async () => {
  const invalid = await request('/issues', {
    method: 'POST',
    token: reporterToken,
    body: { title: 'Missing fields' }
  });
  assert.equal(invalid.status, 400);
  assert.equal(invalid.data.error, 'Missing required fields');

  const valid = await request('/issues', {
    method: 'POST',
    token: reporterToken,
    body: {
      title: 'Water dispenser is leaking',
      category: 'Facilities',
      priority: 'Medium',
      location: 'Block C lobby',
      description: 'Water is collecting near the dispenser and needs maintenance.'
    }
  });
  assert.equal(valid.status, 201);
  assert.equal(valid.data.issue.status, 'Open');
  assert.equal(valid.data.issue.reporter.email, 'test.reporter@example.com');
  createdIssueId = valid.data.issue.id;
});

test('reporter can list own issues and edit an Open issue repeatedly', async () => {
  const list = await request('/issues', { token: reporterToken });
  assert.equal(list.status, 200);
  assert.equal(list.data.issues.length, 1);
  assert.equal(list.data.issues[0].id, createdIssueId);

  const firstEdit = await request(`/issues/${createdIssueId}`, {
    method: 'PATCH',
    token: reporterToken,
    body: {
      title: 'Water dispenser leaking near lobby',
      category: 'Facilities',
      priority: 'High',
      location: 'Block C lobby',
      description: 'The leak has spread and the floor is slippery.'
    }
  });
  assert.equal(firstEdit.status, 200);
  assert.equal(firstEdit.data.issue.priority, 'High');

  const secondEdit = await request(`/issues/${createdIssueId}`, {
    method: 'PATCH',
    token: reporterToken,
    body: {
      title: 'Water dispenser leaking near lobby entrance',
      category: 'Facilities',
      priority: 'High',
      location: 'Block C lobby entrance',
      description: 'The same issue is still open and the location details were refined.'
    }
  });
  assert.equal(secondEdit.status, 200);
  assert.equal(secondEdit.data.issue.title, 'Water dispenser leaking near lobby entrance');
  assert.equal(secondEdit.data.issue.status, 'Open');
  assert.ok(secondEdit.data.issue.history.length >= 3);
});

test('comments return 201 and stats return valid 200 summaries', async () => {
  const comment = await request(`/issues/${createdIssueId}/comments`, {
    method: 'POST',
    token: reporterToken,
    body: { message: 'Adding a follow-up note before assignment.' }
  });
  assert.equal(comment.status, 201);
  assert.equal(comment.data.issue.comments.length, 1);

  const stats = await request('/stats', { token: adminToken });
  assert.equal(stats.status, 200);
  assert.ok(stats.data.stats.total >= 3);
  assert.ok(Number.isInteger(stats.data.stats.open));
});

test('admin can assign issue and reporter cannot edit after assignment', async () => {
  const assigned = await request(`/issues/${createdIssueId}`, {
    method: 'PATCH',
    token: adminToken,
    body: {
      status: 'Assigned',
      priority: 'High',
      category: 'Facilities',
      assigneeId: 'usr_admin',
      dueDate: '2026-05-15',
      resolution: 'Assigned to facilities for inspection.'
    }
  });
  assert.equal(assigned.status, 200);
  assert.equal(assigned.data.issue.status, 'Assigned');
  assert.equal(assigned.data.issue.assignee.email, 'admin@campus.local');

  const reporterEdit = await request(`/issues/${createdIssueId}`, {
    method: 'PATCH',
    token: reporterToken,
    body: {
      title: 'Reporter tries to edit assigned issue',
      category: 'Facilities',
      priority: 'High',
      location: 'Block C lobby entrance',
      description: 'This should fail because the issue is assigned.'
    }
  });
  assert.equal(reporterEdit.status, 403);
});

test('admin filters and deletion return expected status codes', async () => {
  const filtered = await request('/issues?status=Assigned', { token: adminToken });
  assert.equal(filtered.status, 200);
  assert.ok(filtered.data.issues.some((issue) => issue.id === createdIssueId));

  const reporterDelete = await request(`/issues/${createdIssueId}`, {
    method: 'DELETE',
    token: reporterToken
  });
  assert.equal(reporterDelete.status, 403);

  const adminDelete = await request(`/issues/${createdIssueId}`, {
    method: 'DELETE',
    token: adminToken
  });
  assert.equal(adminDelete.status, 200);
  assert.equal(adminDelete.data.ok, true);

  const missing = await request(`/issues/${createdIssueId}`, { token: adminToken });
  assert.equal(missing.status, 404);
});

test('rate limiting returns headers and 429 after the configured request limit', async () => {
  const limitedPort = port + 2000;
  const limitedBaseUrl = `http://${host}:${limitedPort}/api`;
  const limitedDataDir = await mkdtemp(path.join(tmpdir(), 'campus-issue-rate-limit-'));
  const limitedServer = spawn(process.execPath, ['server/index.js'], {
    cwd: rootDir,
    env: {
      ...process.env,
      HOST: host,
      PORT: String(limitedPort),
      DATA_DIR: limitedDataDir,
      RATE_LIMIT_WINDOW_MS: '60000',
      RATE_LIMIT_MAX: '2'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  try {
    await waitForHealth(limitedBaseUrl);

    const first = await fetch(`${limitedBaseUrl}/meta`);
    assert.equal(first.status, 200);
    assert.equal(first.headers.get('x-ratelimit-limit'), '2');
    assert.equal(first.headers.get('x-ratelimit-remaining'), '1');

    const second = await fetch(`${limitedBaseUrl}/meta`);
    assert.equal(second.status, 200);
    assert.equal(second.headers.get('x-ratelimit-remaining'), '0');

    const third = await fetch(`${limitedBaseUrl}/meta`);
    const body = await third.json();
    assert.equal(third.status, 429);
    assert.equal(third.headers.get('x-ratelimit-limit'), '2');
    assert.equal(third.headers.get('x-ratelimit-remaining'), '0');
    assert.ok(Number(third.headers.get('retry-after')) >= 1);
    assert.equal(body.error, 'Too many requests. Please wait before trying again.');
    assert.equal(body.details.limit, 2);
  } finally {
    if (!limitedServer.killed) {
      limitedServer.kill('SIGTERM');
    }
    await rm(limitedDataDir, { recursive: true, force: true });
  }
});
