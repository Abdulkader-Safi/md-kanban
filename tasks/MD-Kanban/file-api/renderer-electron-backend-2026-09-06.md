---
id: "renderer-electron-backend-2026-09-06"
status: "backlog"
priority: "high"
assignee: ""
dueDate: null
created: "2026-09-06T09:36:24Z"
modified: "2026-09-06T09:36:24Z"
labels: ["electron", "renderer"]
order: 2
---

# Renderer Electron backend

Add an Electron backend to `src/lib/fs.ts` behind the same interface. The store picks it when `window.mdkanban` exists. Keep the browser File System Access backend and the demo backend working as fallback.
