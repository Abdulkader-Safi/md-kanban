---
id: "renderer-electron-backend-2026-09-06"
status: "done"
priority: "high"
assignee: ""
dueDate: null
created: "2026-09-06T09:36:24Z"
modified: "2026-09-06T11:25:00Z"
labels: ["electron", "renderer"]
order: 2
---

# Renderer Electron backend

Add an Electron backend to `src/lib/fs.ts` behind the same interface. The store picks it when `window.mdkanban` exists. Keep the browser File System Access backend and the demo backend working as fallback.

Done: the store branches on `window.mdkanban` for init, connect, rescan, create, update, delete, and disconnect. Browser and demo paths untouched. Sidebar hides the browser-only warning in the desktop app. Build passes. Live test in the desktop app still to confirm by hand.
