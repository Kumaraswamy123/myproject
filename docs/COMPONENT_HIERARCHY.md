# Component Hierarchy

The frontend is implemented in `frontend/src/app.js` using React components.

```text
App
  AuthScreen
    Field
    Button
  Dashboard
    Sidebar/Profile/Nav
    StatCard
    IssueForm
      Field
      Select
      Button
    WorkloadSummary
    Filters
      Field
      Select
    IssueList
      IssueBadge
    IssueDetails
      IssueBadge
      AdminUpdatePanel
        Field
        Select
      ReporterEditPanel
        Field
        Select
      ReporterActions
      Comments
      Timeline
      EmptyState
```

## State Ownership

| Component | State |
| --- | --- |
| `App` | token, logged-in user, session loading |
| `AuthScreen` | login/signup form fields |
| `Dashboard` | active view, filters, issues, stats, users, selected issue |
| `IssueForm` | complaint form |
| `AdminUpdatePanel` | admin resolution form |
| `Comments` | comment draft |

## Route/Screen Structure

The app is a single-page interface with role-based screens:

- Reporter: Raise Issue, My Issues, Transparency
- Admin: Issue Queue, Analytics

All data is loaded through the API with the bearer token stored in browser local storage.
