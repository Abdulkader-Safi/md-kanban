---
id: "package-mac-dmg-2026-09-06"
status: "in-progress"
priority: "medium"
assignee: ""
dueDate: null
created: "2026-09-06T09:36:24Z"
modified: "2026-09-06T09:55:00Z"
labels: ["electron", "packaging"]
order: 4
---

# Package macOS dmg

Set up `electron-builder` for a macOS `.dmg`. No code signing at first. Install it on this machine and confirm folders, watching, dark mode, and the agent skill workflow end to end.

Progress: `npm run dist` builds `release/MD Kanban-0.0.0-arm64.dmg` unsigned. Fixed the white screen by switching Vite to relative asset paths (`base: './'`). Still open: custom app icon, install and open the dmg on this machine, full check once the file API lands.
