# UI Wireframes

These wireframes describe the implemented screens.

## Login / Signup

```text
+---------------------------------------------------+-----------------------+
| Campus image hero                                 | Login / Signup card   |
|                                                   |                       |
| Campus Issue Tracker                             | Email                 |
| Raise complaints, assign owners, track SLA        | Password              |
|                                                   | Submit                |
| [Categories] [Workflow states] [Timeline]         | Demo account buttons  |
+---------------------------------------------------+-----------------------+
```

## Reporter Dashboard

```text
+------------+-------------------------------------------------------------+
| Sidebar    | Header: Report and track issues transparently               |
|            | [Total] [Active] [Resolved] [Overdue]                       |
| Raise      |                                                             |
| My Issues  | Raise Complaint Form                                        |
| Transparency | title, category, priority, location, description          |
+------------+-------------------------------------------------------------+
```

## Admin Queue

```text
+------------+-------------------------------------------------------------+
| Sidebar    | Header: Resolve issues with ownership                       |
|            | [Total] [Active] [Resolved] [Overdue]                       |
| Issue Queue|                                                             |
| Analytics  | Filters + Issue List              Issue Details Panel       |
|            | - title/status/priority          - owner                    |
|            | - reporter/location              - due date                 |
|            |                                  - resolution controls       |
|            |                                  - comments                 |
|            |                                  - accountability timeline   |
+------------+-------------------------------------------------------------+
```

## Responsive Layout

On smaller screens, the sidebar becomes a top section and the queue/detail columns stack vertically.
