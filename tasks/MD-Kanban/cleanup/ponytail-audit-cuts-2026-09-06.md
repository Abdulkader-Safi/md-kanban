---
id: "ponytail-audit-cuts-2026-09-06"
status: "todo"
priority: "medium"
assignee: ""
dueDate: null
created: "2026-09-06T11:31:23Z"
modified: "2026-09-06T11:31:23Z"
labels: ["cleanup", "ponytail"]
order: 12
---

# Apply ponytail audit cuts

Full-repo over-engineering audit returned 14 findings, net minus 70 lines, 15 files, 2 deps. Apply them in order:

- [ ] Delete `vue-router` and `reka-ui` deps (never imported)
- [ ] Delete generated icon intermediates in `build/` (keep `app-icon.svg` + `icon.icns`)
- [ ] Delete scaffold leftovers (`public/icons.svg`, `src/assets/*`)
- [ ] Delete `TASK_FILE_DOC`, `clearHandles`, `PRIORITY_ORDER`, `rootPath?`, `UiCard.vue`
- [ ] Shrink `makeFileName` pattern switch to one format
- [ ] Route browser `rescanProject` through `applyScanned`
- [ ] Inline `KanbanBoard.vue` into App, drop `electron()` wrapper, simplify `buildNewTask` return
- [ ] Rebuild and confirm the board still works
