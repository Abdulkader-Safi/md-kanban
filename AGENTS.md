# AGENTS.md — MD Kanban board files

This repo (and any project folder connected to MD Kanban) tracks work as plain markdown task files. Any AI agent can read, write, add, update, move, and delete them.

## Where tasks live

- Each connected folder is one **project**.
- Inside a project, subfolders group **work** (e.g. `auth/`, `billing/`). Files at the root have no work group.
- Every task is one `*.md` file with YAML frontmatter. Scan recursively (skip hidden dirs, `node_modules`, `dist`).

## File format

```markdown
---
id: "login-form-2026-09-06"
status: "todo"
priority: "high"
assignee: "safi"
dueDate: "2026-09-10"
created: "2026-09-06T10:30:00.000Z"
modified: "2026-09-06T14:20:00.000Z"
labels: ["feature", "auth"]
order: 1
---

# Rebuild login form

Task description, checkboxes, notes.
```

Rules:

- `status`: `backlog` | `todo` | `in-progress` | `review` | `done`. Moving a card = changing this field.
- `priority`: `critical` | `high` | `medium` | `low`.
- `id`: slug + date, unique per project. New files: `<slug>-YYYY-MM-DD.md`.
- Keep all frontmatter keys when editing. Always refresh `modified` to current UTC ISO time.
- First `#` heading should match the task title.
- `order`: number for sorting inside a column. New cards go last (highest + 1).

## Allowed operations

- **Read**: list tasks, report status, summarize what is done vs not done.
- **Add**: create a new `.md` file in the right project/work subfolder.
- **Update**: edit body, title, priority, assignee, due date, labels.
- **Move**: change `status` to move across the board.
- **Delete**: remove the file only when the user explicitly asks.

## Status check recipe

1. List all `*.md` task files under the project folder(s).
2. Group by `status`.
3. Report counts per column plus anything `done` since the last check, and anything overdue (`dueDate` before today and status not `done`).
