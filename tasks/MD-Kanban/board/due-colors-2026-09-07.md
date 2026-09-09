---
id: "due-colors-2026-09-07"
status: "done"
priority: "medium"
assignee: ""
dueDate: null
created: "2026-09-07T06:17:48.000Z"
modified: "2026-09-09T00:00:00.000Z"
labels: ["board", "card", "dates"]
order: 21
---

# Due date colors

Due dates read as plain text today. Color overdue red and today orange on card and picker.

- [x] Add overdue / today styling in `TaskCard.vue` using existing `dueDate` checks in `stores/board.ts`
- [x] Show countdown text e.g. "2d overdue", "Today"
- [x] Verify with `vue-tsc --noEmit`

Done 2026-09-09: styling already in `TaskCard.vue` (red/amber tones), polished `formatDue` to return "Nd overdue" for past dates. `vue-tsc --noEmit` clean.
