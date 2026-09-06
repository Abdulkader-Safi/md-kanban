---
id: "scaffold-electron-shell-2026-09-06"
status: "done"
priority: "high"
assignee: ""
dueDate: null
created: "2026-09-06T09:36:24Z"
modified: "2026-09-06T09:44:00Z"
labels: ["electron", "setup"]
order: 0
---

# Scaffold Electron shell

Set up `electron-vite` with `electron/main.ts` and `electron/preload.ts` so the app opens in a desktop window. Dev loads the Vite server, production loads the built `dist/index.html`. No file API yet, the window just shows the current board.

Done: wired manually with a Vite lib build instead of `electron-vite` (it caps at Vite 7, project is on Vite 8). `electron:dev` and `electron:build` work, window opens and stays open on the production build.
