---
id: "watcher-live-refresh-2026-09-06"
status: "backlog"
priority: "medium"
assignee: ""
dueDate: null
created: "2026-09-06T09:36:24Z"
modified: "2026-09-06T09:36:24Z"
labels: ["electron", "watcher"]
order: 3
---

# Watcher live refresh

Watch connected folders and push change events to the renderer. Debounce rapid bursts from agent edits, then rescan quietly. Goal: agent writes a file, board updates with no manual rescan.
