---
id: "drag-undo-2026-09-07"
status: "done"
priority: "high"
assignee: ""
dueDate: null
created: "2026-09-07T06:17:48.000Z"
modified: "2026-09-07T10:26:18.000Z"
labels: ["board", "ux", "drag"]
order: 18
---

# Undo after drag move

A misdrop into the wrong column is easy and annoying to fix by hand. Show a brief Undo after every drop.

- [x] Add "Moved to X, Undo" toast in `KanbanColumn.vue` / `App.vue` after `moveTask`, 5s window
- [x] Undo restores prior status and order via `updateTask`
- [x] Verify with `vue-tsc --noEmit`
