---
id: "archive-all-done-2026-09-07"
status: "done"
priority: "medium"
assignee: ""
dueDate: null
created: "2026-09-07T06:17:48.000Z"
modified: "2026-09-09T00:00:00.000Z"
labels: ["board", "cleanup"]
order: 19
---

# Archive all done

Done piles up and hides signal. One button moves finished cards out of the way, matching Cairn and KamKan.

- [x] Add "Archive all done" per board, moving `status = done` files to an `archive/` work folder
- [x] Keep agent-readable markdown format, update board snapshot after move
- [x] Verify with `vue-tsc --noEmit`

Done 2026-09-09: `archiveAllDone()` in `stores/board.ts` moves done cards to `archive/` (write new + delete old on fs/Electron, in-memory + snapshot for demo), `archive/` hidden from board unless selected. Archive button in done column header with confirm. `vue-tsc --noEmit` clean.
