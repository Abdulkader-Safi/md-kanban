---
id: "saved-views-2026-09-07"
status: "done"
priority: "medium"
assignee: ""
dueDate: null
created: "2026-09-07T06:17:48.000Z"
modified: "2026-09-09T00:00:00.000Z"
labels: ["board", "filters"]
order: 24
---

# Saved filter views

Rebuilding the same filter each session wastes time. Save filter plus sort as named views.

- [x] Save current `FilterBar.vue` state as named views e.g. "Overdue", "Assigned to me", "This week"
- [x] Persist in localStorage per project, one-click apply
- [x] Verify with `vue-tsc --noEmit`

Done 2026-09-09: named views in `FilterBar.vue`, stored in localStorage per project (`md-kanban/views/v1`), one-click apply chips plus delete. `vue-tsc --noEmit` clean.
