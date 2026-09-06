---
id: "main-process-file-api-2026-09-06"
status: "done"
priority: "high"
assignee: ""
dueDate: null
created: "2026-09-06T09:36:24Z"
modified: "2026-09-06T11:20:00Z"
labels: ["electron", "files"]
order: 1
---

# Main-process file API

Folder picker dialog, recursive markdown scan, file read, write, and delete in the main process. Expose it through the preload bridge as `window.mdkanban`. Save connected project folders in Electron user data so they survive restarts.

Done: `electron/store.ts` holds projects.json plus scan/read/write/delete with path-escape guard, tested against a temp dir. `electron/main.ts` exposes 7 IPC channels, `electron/preload.ts` bridges them, `src/lib/electron-api.ts` types the contract. Typecheck clean, all channels verified in the built output. Renderer wiring is the next card.
