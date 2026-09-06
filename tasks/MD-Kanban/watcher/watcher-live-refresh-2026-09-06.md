---
id: "watcher-live-refresh-2026-09-06"
status: "done"
priority: "medium"
assignee: ""
dueDate: null
created: "2026-09-06T09:36:24Z"
modified: "2026-09-06T12:34:47Z"
labels: ["electron", "watcher"]
order: 3
---

# Watcher live refresh

Watch connected folders and push change events to the renderer. Debounce rapid bursts from agent edits, then rescan quietly. Goal: agent writes a file, board updates with no manual rescan.

Done:
- [x] Main watches each project folder with `node:fs` `watch`, debounced 300ms, re-walks on notify for new subfolders
- [x] Preload exposes `onProjectChanged`, main sends `mdkanban:project-changed` to all windows
- [x] Renderer subscribes once in `initBoard` and rescans that project quietly, honors autoRefresh and hidden tab
- [x] Poll fallback fixed to cover Electron too, browser polling unchanged
- [x] `npm run build` and `npm run electron:build` pass, `fs.watch` smoke test returns WATCH-OK
