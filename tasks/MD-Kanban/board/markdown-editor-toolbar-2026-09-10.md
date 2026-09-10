---
id: "markdown-editor-toolbar-2026-09-10"
status: "review"
priority: "high"
assignee: "safi"
dueDate: null
created: "2026-09-10T16:16:21.000Z"
modified: "2026-09-10T16:16:21.000Z"
labels: ["board", "editor"]
order: 28
---

# Markdown editor with formatting toolbar

The Markdown tab was a plain textarea. Replace it with a real editor that keeps the file text exactly as written, so agents and people can both edit it.

- [x] CodeMirror 6 in `src/components/MarkdownEditor.vue`: markdown colouring, code colouring inside fences, line wrap, search, Enter continues lists
- [x] Toolbar: H1 to H3, bold, italic, strikethrough, highlight, inline code, link, image, three list types, quote, code block, table, callout, math, mermaid, divider
- [x] Shortcuts: Cmd+B, Cmd+I, Cmd+E
- [x] Commands in `src/lib/md-commands.ts` toggle on and off; `bun src/lib/md-commands.check.ts` passes
- [x] Colours from the app's CSS variables, so light and dark follow the theme toggle
- [x] Global `N` and `Escape` shortcuts skip keys typed in the editor (it is contenteditable, the old TEXTAREA check missed it)
- [x] Autosave flushes before the card closes or switches; a close within 500 ms used to drop the last edit
- [ ] Use it for a day in the desktop app
