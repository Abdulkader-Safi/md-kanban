---
id: "preview-in-app-themed-2026-09-07"
status: "in-progress"
priority: "high"
assignee: ""
dueDate: null
created: "2026-09-07T05:42:20.000Z"
modified: "2026-09-07T05:43:51.000Z"
labels: ["board", "editor", "preview"]
order: 16
---

# Preview stays in app with project theme

The Preview tab "Open in new tab" button opens the rendered markdown in a separate OS window with hardcoded colors, outside the app theme.

- [x] Remove `window.open` preview path in `TaskEditor.vue`
- [x] Keep preview inside the app (editor pane / expand), using existing `bg-background`, `prose-md` theme tokens so light/dark match
- [x] Verify with `vue-tsc --noEmit`
