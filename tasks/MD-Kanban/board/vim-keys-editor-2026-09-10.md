---
id: "vim-keys-editor-2026-09-10"
status: "review"
priority: "medium"
assignee: "safi"
dueDate: null
created: "2026-09-10T16:16:21.000Z"
modified: "2026-09-10T16:16:21.000Z"
labels: ["board", "editor"]
order: 29
---

# Vim keys in the card editor

Vim support for the markdown editor only, not the rest of the app.

- [x] `@replit/codemirror-vim` behind a compartment in `MarkdownEditor.vue`, with the mode line (`--NORMAL--`, `--INSERT--`)
- [x] "Vim keys in editor" checkbox in the sidebar under Auto-refresh folders, saved in prefs (`vimKeys` in `md-kanban/prefs/v1`)
- [x] Escape never closes the card while Vim is on; close with the X or a click outside
- [x] `:w` is a known command (cards autosave)
- [x] Checked in the browser build: `i`, typing, Escape to normal, `n` does not open New card
- [ ] Watch for a card closing while typing in Vim insert mode (seen once in testing, did not reproduce)
