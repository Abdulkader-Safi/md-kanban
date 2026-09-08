---
id: "keyboard-drag-polish-2026-09-07"
status: "done"
priority: "high"
assignee: ""
dueDate: null
created: "2026-09-07T06:17:48.000Z"
modified: "2026-09-08T04:31:52.000Z"
labels: ["board", "ux", "a11y", "drag"]
order: 26
---

# Keyboard move plus drag polish

Drag is mouse only today and long boards trap cards. Add a keyboard path and honest drop feedback.

- [x] Keyboard move: focus card, Space picks up, arrows move across columns, Space drops, Esc cancels, with live announcement
- [x] Drop slot: card shaped gap at landing spot plus column highlight in `KanbanColumn.vue`
- [x] Autoscroll: board pans and column scrolls while holding a card; add "Move to" menu as non-drag fallback
- [x] Verify with `vue-tsc --noEmit`
