---
id: "editor-preview-tabs-2026-09-06"
status: "done"
priority: "high"
assignee: ""
dueDate: null
created: "2026-09-06T16:39:07Z"
modified: "2026-09-06T16:45:00Z"
labels: ["board", "editor", "readability"]
order: 7
---

# Editor shows one pane at a time with Markdown / Preview tabs

The detail sidebar squeezes markdown source and rendered preview side by side, so both are too narrow to read (see screenshot T-70 card).

- [x] Replace side-by-side panes in `TaskEditor.vue` with a single full-width pane
- [x] Add Markdown / Preview tab switch, default to Markdown, remember last choice
- [x] Verify with `vue-tsc --noEmit`
