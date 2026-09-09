---
id: "quick-add-syntax-2026-09-07"
status: "done"
priority: "medium"
assignee: ""
dueDate: null
created: "2026-09-07T06:17:48.000Z"
modified: "2026-09-09T00:00:00.000Z"
labels: ["board", "editor", "speed"]
order: 25
---

# Quick add syntax

Creating a fully tagged card takes too many clicks. Parse one line into fields like Kandown and Jotter do.

- [x] Parse e.g. "Fix login p1 #backend @safi due:friday" in `NewTaskDialog.vue` into priority, labels, assignee, due
- [x] Add card templates (bug, feature, chore) with frontmatter and checklist prefilled
- [x] Verify with `vue-tsc --noEmit`

Done 2026-09-09: new `src/lib/quick-add.ts` (`parseQuickAdd`, `resolveDue`, `cardTemplate`), wired into `NewTaskDialog.vue` with live "Will set" hint. `vue-tsc --noEmit` clean.
