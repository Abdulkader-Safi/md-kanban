---
id: "list-view-2026-09-07"
status: "done"
priority: "medium"
assignee: ""
dueDate: null
created: "2026-09-07T06:17:48.000Z"
modified: "2026-09-08T04:39:39.000Z"
labels: ["board", "view"]
order: 23
---

# List view next to board

Kanban truncates titles past 50 cards. Add a dense one-row-per-task list over the same files.

- [x] Add board / list toggle in `App.vue` reusing `visibleTasks` from `stores/board.ts`
- [x] Rows show title, status, priority, due, assignee; click opens `TaskEditor.vue`
- [x] Verify with `vue-tsc --noEmit`
