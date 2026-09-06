---
id: "ponytail-audit-cuts-2026-09-06"
status: "done"
priority: "medium"
assignee: ""
dueDate: null
created: "2026-09-06T11:31:23Z"
modified: "2026-09-06T11:34:24Z"
labels: ["cleanup", "ponytail"]
order: 12
---

# Apply ponytail audit cuts

Full-repo over-engineering audit returned 14 findings, net minus 70 lines, 15 files, 2 deps. Apply them in order:

- [x] Delete `vue-router` and `reka-ui` deps (never imported)
- [x] Delete generated icon intermediates in `build/` (keep `app-icon.svg` + `icon.icns`)
- [x] Delete scaffold leftovers (`public/icons.svg`, `src/assets/*`)
- [x] Delete `TASK_FILE_DOC`, `clearHandles`, `PRIORITY_ORDER`, `rootPath?`, `UiCard.vue`
- [x] Shrink `makeFileName` pattern switch to one format
- [x] Route browser `rescanProject` through `applyScanned`
- [x] Inline `KanbanBoard.vue` into App, drop `electron()` wrapper, simplify `buildNewTask` return
- [x] Rebuild and confirm the board still works

Done: all cuts applied, build passes, parser round-trip verified, preview serves 200.
