---
id: "board-overscroll-2026-09-08"
status: "done"
priority: "high"
assignee: ""
dueDate: null
created: "2026-09-08T04:45:11.000Z"
modified: "2026-09-08T04:59:28.000Z"
labels: ["board", "bug", "layout"]
order: 0
---
# Fix board vertical overscroll past view area

Board view scrolls vertically past its content since the last two updates (subtask badge, list view toggle). Cards slide up under the window title bar and a large empty area sits below the board strip. The far-right window scrollbar moves, so the scroll is at window level, not inside a column.

- [x] Repro in desktop app and `vite` web: confirm which container grows past the viewport (main column, board strip, or column list)
- [x] Root cause: `TaskCard.vue` live-region `span.sr-only` is `absolute` with no positioned ancestor, so it anchored to the viewport from deep inside list content and stretched the document. Fixed with one `relative` class on the card.
- [x] Fix so the board fills the viewport with no window-level vertical scroll; only columns scroll internally (`overflow-y-auto`) and the strip pans horizontally
- [x] Check list view too, then verify with `vue-tsc --noEmit`
