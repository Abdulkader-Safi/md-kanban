---
id: "watcher-steady-fix-2026-09-06"
status: "done"
priority: "high"
assignee: ""
dueDate: null
created: "2026-09-06T13:36:12Z"
modified: "2026-09-06T13:36:12Z"
labels: ["electron", "watcher", "bugfix"]
order: 13
---

# Watcher misses edits under burst load

Follow-up to watcher-live-refresh. Live update worked sometimes and missed others. Cause: every change re-walked the tree and tore all watches down, leaving blind gaps where edits went missing. Overlapping re-walks could also pile up.

Done:
- [x] Watches stay up once created, notify only debounces and broadcasts
- [x] New subfolders get watched when they appear through rename events
- [x] Concurrent setup calls share one in-flight run instead of interleaving
- [x] `npm run dist` rebuilds clean, dmg timestamped 2026-09-06
