const { useEffect, useMemo, useState } = React;
const { createRoot } = ReactDOM;

const CATEGORIES = ['Facilities', 'Network', 'Equipment', 'Safety', 'Cleanliness', 'Other'];
const PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];
const STATUSES = ['Open', 'Assigned', 'In Progress', 'Resolved', 'Reopened', 'Closed', 'Rejected'];

function E(type, props, ...children) {
  return React.createElement(
    type,
    props || {},
    ...children.flat().filter((child) => child !== null && child !== undefined && child !== false)
  );
}

function cx(...classes) {
  return classes.filter(Boolean).join(' ');
}

function formatDate(value) {
  if (!value) {
    return 'Not set';
  }

  return new Intl.DateTimeFormat('en', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(new Date(value));
}

function formatDateTime(value) {
  if (!value) {
    return 'Not set';
  }

  return new Intl.DateTimeFormat('en', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}

function Button({ children, variant = 'primary', className = '', loading = false, disabled = false, ...props }) {
  return E(
    'button',
    {
      ...props,
      disabled: disabled || loading,
      'aria-busy': loading ? 'true' : undefined,
      className: cx('btn', `btn-${variant}`, loading && 'is-loading', className)
    },
    loading ? E('span', { className: 'btn-spinner', 'aria-hidden': 'true' }) : null,
    E('span', null, children)
  );
}

function Field({ label, children }) {
  return E('label', { className: 'field' }, E('span', null, label), children);
}

function Select({ label, value, onChange, options, includeAll = false }) {
  return E(
    Field,
    { label },
    E(
      'select',
      { value, onChange: (event) => onChange(event.target.value) },
      includeAll ? E('option', { value: 'All' }, 'All') : null,
      options.map((option) => E('option', { key: option, value: option }, option))
    )
  );
}

function EmptyState({ title, body }) {
  return E(
    'div',
    { className: 'empty-state' },
    E('div', { className: 'empty-mark' }, '!'),
    E('h3', null, title),
    E('p', null, body)
  );
}

function Toast({ toast, onDismiss }) {
  if (!toast) {
    return null;
  }

  return E(
    'div',
    { className: 'toast-stack', role: 'status', 'aria-live': 'polite' },
    E(
      'div',
      { className: cx('toast', `toast-${toast.type || 'success'}`) },
      E('span', { className: 'toast-icon', 'aria-hidden': 'true' }, toast.type === 'error' ? '!' : 'OK'),
      E('div', { className: 'toast-copy' }, E('strong', null, toast.title), toast.message ? E('p', null, toast.message) : null),
      E('button', { type: 'button', onClick: onDismiss, 'aria-label': 'Dismiss notification' }, 'Close')
    )
  );
}

function AuthScreen({ onAuthenticated }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({
    name: '',
    email: 'admin@campus.local',
    password: 'admin123',
    department: ''
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');

    try {
      const response = await fetch(`/api/auth/${mode === 'login' ? 'login' : 'signup'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      onAuthenticated(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function useDemo(email, password) {
    setMode('login');
    setForm((current) => ({ ...current, email, password }));
  }

  return E(
    'main',
    { className: 'auth-page' },
    E(
      'section',
      { className: 'auth-hero' },
      E('p', { className: 'eyebrow' }, 'Centralized accountability'),
      E('h1', null, 'Campus Issue Tracker'),
      E(
        'p',
        { className: 'hero-copy' },
        'Raise complaints, assign owners, track SLA deadlines, and keep every update visible from report to resolution.'
      ),
      E(
        'div',
        { className: 'hero-stats' },
        E('div', null, E('strong', null, '4'), E('span', null, 'Issue categories')),
        E('div', null, E('strong', null, '7'), E('span', null, 'Workflow states')),
        E('div', null, E('strong', null, '100%'), E('span', null, 'Timeline audit trail'))
      )
    ),
    E(
      'section',
      { className: 'auth-card' },
      E(
        'div',
        { className: 'tabs compact' },
        Button({
          variant: mode === 'login' ? 'primary' : 'ghost',
          onClick: () => setMode('login'),
          type: 'button',
          children: 'Login'
        }),
        Button({
          variant: mode === 'signup' ? 'primary' : 'ghost',
          onClick: () => setMode('signup'),
          type: 'button',
          children: 'Sign up'
        })
      ),
      E(
        'form',
        { onSubmit: submit, className: 'auth-form' },
        mode === 'signup'
          ? Field({
              label: 'Name',
              children: E('input', {
                value: form.name,
                onChange: (event) => update('name', event.target.value),
                placeholder: 'Your full name',
                required: true
              })
            })
          : null,
        Field({
          label: 'Email',
          children: E('input', {
            type: 'email',
            value: form.email,
            onChange: (event) => update('email', event.target.value),
            placeholder: 'name@example.com',
            required: true
          })
        }),
        Field({
          label: 'Password',
          children: E('input', {
            type: 'password',
            value: form.password,
            onChange: (event) => update('password', event.target.value),
            placeholder: 'Password',
            required: true
          })
        }),
        mode === 'signup'
          ? Field({
              label: 'Department',
              children: E('input', {
                value: form.department,
                onChange: (event) => update('department', event.target.value),
                placeholder: 'Department or team'
              })
            })
          : null,
        error ? E('p', { className: 'form-error' }, error) : null,
        Button({ type: 'submit', loading: busy, children: busy ? 'Checking account...' : mode === 'login' ? 'Login' : 'Create account' })
      ),
      E(
        'div',
        { className: 'demo-logins' },
        E('p', null, 'Demo accounts'),
        Button({
          variant: 'secondary',
          type: 'button',
          onClick: () => useDemo('admin@campus.local', 'admin123'),
          children: 'Admin'
        }),
        Button({
          variant: 'secondary',
          type: 'button',
          onClick: () => useDemo('asha@student.local', 'user123'),
          children: 'User'
        })
      )
    )
  );
}

function StatCard({ label, value, hint }) {
  return E(
    'article',
    { className: 'stat-card' },
    E('span', null, label),
    E('strong', null, value),
    E('small', null, hint)
  );
}

function IssueForm({ api, onCreated, notify }) {
  const initialForm = {
    title: '',
    category: 'Facilities',
    priority: 'Medium',
    location: '',
    description: ''
  };
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');

    try {
      const data = await api('/issues', { method: 'POST', body: form });
      setForm(initialForm);
      notify({
        title: 'Issue submitted',
        message: `${data.issue.id} was saved and added to My Issues.`
      });
      onCreated(data.issue.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return E(
    'section',
    { className: 'panel issue-form-panel' },
    E('div', { className: 'section-heading' }, E('h2', null, 'Raise a Complaint'), E('p', null, 'Capture enough detail so the right owner can act quickly.')),
    E(
      'form',
      { onSubmit: submit, className: 'issue-form' },
      Field({
        label: 'Title',
        children: E('input', {
          value: form.title,
          onChange: (event) => update('title', event.target.value),
          placeholder: 'Example: Lab projector is flickering',
          maxLength: 140,
          required: true
        })
      }),
      E(
        'div',
        { className: 'form-grid' },
        Select({ label: 'Category', value: form.category, onChange: (value) => update('category', value), options: CATEGORIES }),
        Select({ label: 'Priority', value: form.priority, onChange: (value) => update('priority', value), options: PRIORITIES })
      ),
      Field({
        label: 'Location',
        children: E('input', {
          value: form.location,
          onChange: (event) => update('location', event.target.value),
          placeholder: 'Building, floor, room, lab, or area',
          maxLength: 120,
          required: true
        })
      }),
      Field({
        label: 'Description',
        children: E('textarea', {
          value: form.description,
          onChange: (event) => update('description', event.target.value),
          placeholder: 'What happened? Who is affected? When did it start?',
          rows: 5,
          maxLength: 1200,
          required: true
        })
      }),
      error ? E('p', { className: 'form-error' }, error) : null,
      E(
        'div',
        { className: 'form-actions' },
        E('p', { className: 'submit-hint' }, busy ? 'Saving your complaint to the system...' : 'You will see a confirmation after submission.'),
        Button({ type: 'submit', loading: busy, children: busy ? 'Submitting...' : 'Submit Issue' })
      )
    )
  );
}

function Filters({ filters, setFilters, users, isAdmin }) {
  function update(field, value) {
    setFilters((current) => ({ ...current, [field]: value }));
  }

  return E(
    'div',
    { className: 'filters' },
    Field({
      label: 'Search',
      children: E('input', {
        value: filters.search,
        onChange: (event) => update('search', event.target.value),
        placeholder: 'Search title, location, or detail'
      })
    }),
    Select({ label: 'Status', value: filters.status, onChange: (value) => update('status', value), options: STATUSES, includeAll: true }),
    Select({ label: 'Category', value: filters.category, onChange: (value) => update('category', value), options: CATEGORIES, includeAll: true }),
    Select({ label: 'Priority', value: filters.priority, onChange: (value) => update('priority', value), options: PRIORITIES, includeAll: true }),
    isAdmin
      ? E(
          Field,
          { label: 'Owner' },
          E(
            'select',
            { value: filters.assigneeId, onChange: (event) => update('assigneeId', event.target.value) },
            E('option', { value: 'All' }, 'All'),
            E('option', { value: 'Unassigned' }, 'Unassigned'),
            users
              .filter((user) => user.role === 'admin')
              .map((user) => E('option', { key: user.id, value: user.id }, user.name))
          )
        )
      : null
  );
}

function IssueBadge({ type, value }) {
  return E('span', { className: cx('badge', `${type}-${String(value).toLowerCase().replace(/\s+/g, '-')}`) }, value);
}

function IssueList({ issues, selectedId, onSelect }) {
  if (!issues.length) {
    return E(EmptyState, {
      title: 'No matching issues',
      body: 'Try changing the filters or raise a new complaint.'
    });
  }

  return E(
    'div',
    { className: 'issue-list' },
    issues.map((issue) =>
      E(
        'button',
        {
          key: issue.id,
          className: cx('issue-row', selectedId === issue.id && 'selected'),
          onClick: () => onSelect(issue.id)
        },
        E(
          'div',
          { className: 'issue-row-main' },
          E('strong', null, issue.title),
          E('span', null, `${issue.location} · Reported by ${issue.reporter?.name || 'Unknown'}`)
        ),
        E(
          'div',
          { className: 'issue-row-meta' },
          E(IssueBadge, { type: 'status', value: issue.status }),
          E(IssueBadge, { type: 'priority', value: issue.priority }),
          E('small', null, formatDate(issue.updatedAt))
        )
      )
    )
  );
}

function Timeline({ events }) {
  return E(
    'ol',
    { className: 'timeline' },
    [...events]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map((event) =>
        E(
          'li',
          { key: event.id },
          E('span', { className: 'timeline-dot' }),
          E('div', null, E('strong', null, event.action), E('p', null, event.detail), E('small', null, `${event.actorName} · ${formatDateTime(event.createdAt)}`))
        )
      )
  );
}

function Comments({ issue, api, onChanged, notify }) {
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');

    try {
      await api(`/issues/${issue.id}/comments`, { method: 'POST', body: { message } });
      setMessage('');
      notify({
        title: 'Comment posted',
        message: 'Your update was saved on this issue.'
      });
      onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return E(
    'section',
    { className: 'comments' },
    E('h3', null, 'Discussion'),
    issue.comments.length
      ? E(
          'div',
          { className: 'comment-list' },
          issue.comments.map((comment) =>
            E(
              'article',
              { key: comment.id, className: 'comment' },
              E('p', null, comment.message),
              E('small', null, `${comment.authorName} · ${formatDateTime(comment.createdAt)}`)
            )
          )
        )
      : E('p', { className: 'muted' }, 'No comments yet.'),
    E(
      'form',
      { onSubmit: submit, className: 'comment-form' },
      E('textarea', {
        value: message,
        onChange: (event) => setMessage(event.target.value),
        placeholder: 'Add a transparent update or question',
        rows: 3,
        required: true
      }),
      error ? E('p', { className: 'form-error' }, error) : null,
      Button({ type: 'submit', loading: busy, children: busy ? 'Posting...' : 'Post Comment' })
    )
  );
}

function AdminUpdatePanel({ issue, users, api, onChanged, notify }) {
  const [form, setForm] = useState({
    status: issue.status,
    priority: issue.priority,
    category: issue.category,
    assigneeId: issue.assigneeId || '',
    dueDate: issue.dueDate || '',
    resolution: issue.resolution || ''
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setForm({
      status: issue.status,
      priority: issue.priority,
      category: issue.category,
      assigneeId: issue.assigneeId || '',
      dueDate: issue.dueDate || '',
      resolution: issue.resolution || ''
    });
  }, [issue.id, issue.status, issue.priority, issue.category, issue.assigneeId, issue.dueDate, issue.resolution]);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');

    try {
      const data = await api(`/issues/${issue.id}`, { method: 'PATCH', body: form });
      notify({
        title: 'Issue update saved',
        message: `${data.issue.title} is now ${data.issue.status}.`
      });
      onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return E(
    'section',
    { className: 'admin-update' },
    E('h3', null, 'Admin Resolution Controls'),
    E(
      'form',
      { onSubmit: submit },
      E(
        'div',
        { className: 'form-grid' },
        Select({ label: 'Status', value: form.status, onChange: (value) => update('status', value), options: STATUSES }),
        Select({ label: 'Priority', value: form.priority, onChange: (value) => update('priority', value), options: PRIORITIES }),
        Select({ label: 'Category', value: form.category, onChange: (value) => update('category', value), options: CATEGORIES }),
        E(
          Field,
          { label: 'Assignee' },
          E(
            'select',
            { value: form.assigneeId, onChange: (event) => update('assigneeId', event.target.value) },
            E('option', { value: '' }, 'Unassigned'),
            users
              .filter((user) => user.role === 'admin')
              .map((user) => E('option', { key: user.id, value: user.id }, user.name))
          )
        )
      ),
      Field({
        label: 'SLA Due Date',
        children: E('input', {
          type: 'date',
          value: form.dueDate,
          onChange: (event) => update('dueDate', event.target.value)
        })
      }),
      Field({
        label: 'Resolution Notes',
        children: E('textarea', {
          value: form.resolution,
          onChange: (event) => update('resolution', event.target.value),
          placeholder: 'Document the fix, root cause, or next action',
          rows: 4
        })
      }),
      error ? E('p', { className: 'form-error' }, error) : null,
      Button({ type: 'submit', loading: busy, children: busy ? 'Saving...' : 'Save Update' })
    )
  );
}

function ReporterEditPanel({ issue, api, onChanged, notify }) {
  const [form, setForm] = useState({
    title: issue.title,
    category: issue.category,
    priority: issue.priority,
    location: issue.location,
    description: issue.description
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setForm({
      title: issue.title,
      category: issue.category,
      priority: issue.priority,
      location: issue.location,
      description: issue.description
    });
    setError('');
  }, [issue.id, issue.title, issue.category, issue.priority, issue.location, issue.description]);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');

    try {
      const data = await api(`/issues/${issue.id}`, { method: 'PATCH', body: form });
      notify({
        title: 'Changes saved',
        message: `${data.issue.id} was updated successfully.`
      });
      onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!['Open', 'Reopened'].includes(issue.status)) {
    return null;
  }

  return E(
    'section',
    { className: 'reporter-edit' },
    E('h3', null, 'Edit Open Issue'),
    E(
      'form',
      { onSubmit: submit },
      Field({
        label: 'Title',
        children: E('input', {
          value: form.title,
          onChange: (event) => update('title', event.target.value),
          maxLength: 140,
          required: true
        })
      }),
      E(
        'div',
        { className: 'form-grid' },
        Select({ label: 'Category', value: form.category, onChange: (value) => update('category', value), options: CATEGORIES }),
        Select({ label: 'Priority', value: form.priority, onChange: (value) => update('priority', value), options: PRIORITIES })
      ),
      Field({
        label: 'Location',
        children: E('input', {
          value: form.location,
          onChange: (event) => update('location', event.target.value),
          maxLength: 120,
          required: true
        })
      }),
      Field({
        label: 'Description',
        children: E('textarea', {
          value: form.description,
          onChange: (event) => update('description', event.target.value),
          rows: 4,
          maxLength: 1200,
          required: true
        })
      }),
      error ? E('p', { className: 'form-error' }, error) : null,
      Button({ type: 'submit', loading: busy, children: busy ? 'Saving...' : 'Save Changes' })
    )
  );
}

function ReporterActions({ issue, api, onChanged, notify }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function reopen() {
    setBusy(true);
    setError('');

    try {
      await api(`/issues/${issue.id}`, { method: 'PATCH', body: { status: 'Reopened' } });
      notify({
        title: 'Issue reopened',
        message: 'The issue is back in the active queue.'
      });
      onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!['Resolved', 'Closed'].includes(issue.status)) {
    return null;
  }

  return E(
    'section',
    { className: 'reporter-actions' },
    E('h3', null, 'Reporter Follow-up'),
    E('p', null, 'If the issue is not actually resolved, reopen it so the timeline remains accountable.'),
    error ? E('p', { className: 'form-error' }, error) : null,
    Button({ variant: 'secondary', onClick: reopen, loading: busy, children: busy ? 'Reopening...' : 'Reopen Issue' })
  );
}

function IssueDetails({ issue, users, user, api, onChanged, notify }) {
  if (!issue) {
    return E(EmptyState, {
      title: 'Select an issue',
      body: 'Choose a complaint from the list to inspect ownership, updates, and resolution history.'
    });
  }

  return E(
    'aside',
    { className: 'details-panel' },
    E(
      'div',
      { className: 'details-header' },
      E('div', null, E('p', { className: 'eyebrow' }, issue.id), E('h2', null, issue.title)),
      E('div', { className: 'badge-row' }, E(IssueBadge, { type: 'status', value: issue.status }), E(IssueBadge, { type: 'priority', value: issue.priority }))
    ),
    E(
      'div',
      { className: 'details-grid' },
      E('div', null, E('span', null, 'Category'), E('strong', null, issue.category)),
      E('div', null, E('span', null, 'Location'), E('strong', null, issue.location)),
      E('div', null, E('span', null, 'Reporter'), E('strong', null, issue.reporter?.name || 'Unknown')),
      E('div', null, E('span', null, 'Owner'), E('strong', null, issue.assignee?.name || 'Unassigned')),
      E('div', null, E('span', null, 'Due Date'), E('strong', null, formatDate(issue.dueDate))),
      E('div', null, E('span', null, 'Last Updated'), E('strong', null, formatDate(issue.updatedAt)))
    ),
    E('section', { className: 'description-block' }, E('h3', null, 'Description'), E('p', null, issue.description)),
    issue.resolution ? E('section', { className: 'resolution-block' }, E('h3', null, 'Resolution'), E('p', null, issue.resolution)) : null,
    user.role === 'admin'
      ? E(AdminUpdatePanel, { issue, users, api, onChanged, notify })
      : [E(ReporterEditPanel, { issue, api, onChanged, notify }), E(ReporterActions, { issue, api, onChanged, notify })],
    E(Comments, { issue, api, onChanged, notify }),
    E('section', { className: 'history-block' }, E('h3', null, 'Accountability Timeline'), E(Timeline, { events: issue.history }))
  );
}

function WorkloadSummary({ stats }) {
  const entries = Object.entries(stats.byStatus || {}).filter(([, count]) => count > 0);

  return E(
    'section',
    { className: 'panel workload' },
    E('div', { className: 'section-heading' }, E('h2', null, 'Workflow Snapshot'), E('p', null, 'Status distribution across visible issues.')),
    entries.length
      ? E(
          'div',
          { className: 'bar-list' },
          entries.map(([status, count]) =>
            E(
              'div',
              { key: status, className: 'bar-row' },
              E('span', null, status),
              E('div', { className: 'bar-track' }, E('span', { style: { width: `${Math.max(8, (count / Math.max(1, stats.total)) * 100)}%` } })),
              E('strong', null, count)
            )
          )
        )
      : E('p', { className: 'muted' }, 'No issues yet.')
  );
}

function Dashboard({ user, token, onLogout }) {
  const [active, setActive] = useState(user.role === 'admin' ? 'queue' : 'raise');
  const [issues, setIssues] = useState([]);
  const [stats, setStats] = useState({ total: 0, open: 0, resolved: 0, overdue: 0, byStatus: {} });
  const [users, setUsers] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [filters, setFilters] = useState({ search: '', status: 'All', category: 'All', priority: 'All', assigneeId: 'All' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);

  const isAdmin = user.role === 'admin';

  function notify({ title, message, type = 'success' }) {
    setToast({ id: Date.now(), title, message, type });
  }

  async function api(path, options = {}) {
    const response = await fetch(`/api${path}`, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: options.body ? JSON.stringify(options.body) : undefined
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Request failed');
    }

    return data;
  }

  async function refresh() {
    setError('');
    setLoading(true);

    try {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(filters)) {
        if (value !== undefined && value !== '') {
          params.set(key, value);
        }
      }

      const [issueData, statsData, userData] = await Promise.all([
        api(`/issues?${params.toString()}`),
        api('/stats'),
        isAdmin ? api('/users') : Promise.resolve({ users: [] })
      ]);

      setIssues(issueData.issues);
      setStats(statsData.stats);
      setUsers(userData.users);
      setSelectedId((current) => current || issueData.issues[0]?.id || '');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, [filters.search, filters.status, filters.category, filters.priority, filters.assigneeId]);

  useEffect(() => {
    if (!toast) {
      return undefined;
    }

    const timer = setTimeout(() => setToast(null), 3600);
    return () => clearTimeout(timer);
  }, [toast?.id]);

  const selectedIssue = useMemo(() => issues.find((issue) => issue.id === selectedId) || issues[0] || null, [issues, selectedId]);

  function created(issueId) {
    setActive('queue');
    if (issueId) {
      setSelectedId(issueId);
    }
    refresh();
  }

  async function logout() {
    try {
      await api('/auth/logout', { method: 'POST' });
    } finally {
      onLogout();
    }
  }

  const navItems = isAdmin
    ? [
        ['queue', 'Issue Queue'],
        ['analytics', 'Analytics']
      ]
    : [
        ['raise', 'Raise Issue'],
        ['queue', 'My Issues'],
        ['analytics', 'Transparency']
      ];

  return E(
    'div',
    { className: 'app-shell' },
    E(Toast, { toast, onDismiss: () => setToast(null) }),
    E(
      'aside',
      { className: 'sidebar' },
      E('div', { className: 'brand' }, E('span', null, 'CIT'), E('div', null, E('strong', null, 'Issue Tracker'), E('small', null, 'Campus operations'))),
      E(
        'nav',
        null,
        navItems.map(([id, label]) =>
          E(
            'button',
            { key: id, className: active === id ? 'active' : '', onClick: () => setActive(id) },
            label
          )
        )
      ),
      E('div', { className: 'profile-card' }, E('strong', null, user.name), E('span', null, user.email), E('small', null, user.role === 'admin' ? 'Administrator' : 'Reporter')),
      Button({ variant: 'ghost', onClick: logout, children: 'Logout' })
    ),
    E(
      'main',
      { className: 'main-content' },
      E(
        'header',
        { className: 'topbar' },
        E('div', null, E('p', { className: 'eyebrow' }, isAdmin ? 'Admin workspace' : 'Reporter workspace'), E('h1', null, isAdmin ? 'Resolve issues with ownership' : 'Report and track issues transparently')),
        E('div', { className: 'topbar-actions' }, Button({ variant: 'secondary', onClick: refresh, loading, children: loading ? 'Refreshing...' : 'Refresh' }))
      ),
      E(
        'section',
        { className: 'stats-grid' },
        E(StatCard, { label: 'Total', value: stats.total, hint: 'Visible issues' }),
        E(StatCard, { label: 'Active', value: stats.open, hint: 'Needs attention' }),
        E(StatCard, { label: 'Resolved', value: stats.resolved, hint: 'Resolved or closed' }),
        E(StatCard, { label: 'Overdue', value: stats.overdue, hint: 'Past SLA due date' })
      ),
      active === 'raise' ? E(IssueForm, { api, onCreated: created, notify }) : null,
      active === 'analytics' ? E(WorkloadSummary, { stats }) : null,
      active === 'queue'
        ? E(
            'section',
            { className: 'queue-layout' },
            E(
              'div',
              { className: 'panel queue-panel' },
              E('div', { className: 'section-heading' }, E('h2', null, isAdmin ? 'Issue Queue' : 'My Issues'), E('p', null, isAdmin ? 'Assign owners, update statuses, and document resolution.' : 'Follow every update and reopen unresolved work.')),
              E(Filters, { filters, setFilters, users, isAdmin }),
              error ? E('p', { className: 'form-error' }, error) : null,
              loading ? E('p', { className: 'muted' }, 'Loading issues...') : E(IssueList, { issues, selectedId: selectedIssue?.id, onSelect: setSelectedId })
            ),
            E(IssueDetails, { issue: selectedIssue, users, user, api, onChanged: refresh, notify })
          )
        : null
    )
  );
}

function App() {
  const [token, setToken] = useState(() => localStorage.getItem('cit_token') || '');
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(token));

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Session expired');
        }
        setUser(data.user);
      })
      .catch(() => {
        localStorage.removeItem('cit_token');
        setToken('');
      })
      .finally(() => setLoading(false));
  }, [token]);

  function authenticated(data) {
    localStorage.setItem('cit_token', data.token);
    setToken(data.token);
    setUser(data.user);
  }

  function logout() {
    localStorage.removeItem('cit_token');
    setToken('');
    setUser(null);
  }

  if (loading) {
    return E('div', { className: 'loading-screen' }, 'Loading workspace...');
  }

  if (!user) {
    return E(AuthScreen, { onAuthenticated: authenticated });
  }

  return E(Dashboard, { user, token, onLogout: logout });
}

createRoot(document.getElementById('root')).render(E(App));
