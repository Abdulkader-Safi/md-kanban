---
id: "reload-keeps-tasks-2026-09-06"
status: "done"
priority: "high"
assignee: ""
dueDate: null
created: "2026-09-06T11:05:12Z"
modified: "2026-09-06T11:05:12Z"
labels: ["board", "reload", "electron-test"]
order: 6
---

# Reload keeps tasks visible

Reloading the app (Ctrl+R in Electron) wiped all tasks because folder permission lapses and the empty scan replaced the board. Fixed with a snapshot of the last successful read plus a reconnect banner. Done: snapshot restore on load, failed scans never wipe cards, one rescan click goes live again.
