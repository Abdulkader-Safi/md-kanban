---
id: "keyboard-drag-polish-2026-09-07"
status: "todo"
priority: "high"
assignee: ""
dueDate: null
created: "2026-09-07T06:17:48.000Z"
modified: "2026-09-07T06:17:48.000Z"
labels: ["board", "ux", "a11y", "drag"]
order: 26
---

# Keyboard move plus drag polish

Drag is mouse only today and long boards trap cards. Add a keyboard path and honest drop feedback.

- [ ] Keyboard move: focus card, Space picks up, arrows move across columns, Space drops, Esc cancels, with live announcement
- [ ] Drop slot: card shaped gap at landing spot plus column highlight in `KanbanColumn.vue`
- [ ] Autoscroll: board pans and column scrolls while holding a card; add "Move to" menu as non-drag fallback
- [ ] Verify with `vue-tsc --noEmit`
