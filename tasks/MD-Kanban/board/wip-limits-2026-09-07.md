---
id: "wip-limits-2026-09-07"
status: "todo"
priority: "medium"
assignee: ""
dueDate: null
created: "2026-09-07T06:17:48.000Z"
modified: "2026-09-07T06:17:48.000Z"
labels: ["board", "flow"]
order: 22
---

# WIP limits per column

No cap on In Progress means overload creeps in. Set a soft max per column with a visible count.

- [ ] Store per-column limit, show "3/3" in `KanbanColumn.vue` header, red when full
- [ ] Warn on drop over limit but allow with confirm
- [ ] Verify with `vue-tsc --noEmit`
