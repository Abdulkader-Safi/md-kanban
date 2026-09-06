---
id: "bun-migration-2026-09-06"
status: "done"
priority: "medium"
assignee: ""
dueDate: null
created: "2026-09-06T13:36:12Z"
modified: "2026-09-06T14:00:35Z"
labels: ["tooling", "bun"]
order: 14
---

# Run all commands on bun instead of npm

Replace npm with bun across the project: install, dev, build, electron, and dist scripts plus any docs that mention npm. Delete package-lock once bun.lock is the source of truth. Confirm `bun run dist` still produces a working dmg on this machine before calling it done.

Done:
- [x] package.json scripts use `bun run`, README uses bun/bunx, package-lock deleted
- [x] `bun run build` and `bun run dist` pass, dmg mounts with watcher code and relative paths
- [x] Installed to /Applications, launched, window alive
