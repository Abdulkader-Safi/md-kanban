---
id: "markdown-extensions-preview-2026-09-10"
status: "review"
priority: "high"
assignee: "safi"
dueDate: null
created: "2026-09-10T16:16:21.000Z"
modified: "2026-09-10T16:16:21.000Z"
labels: ["board", "editor", "preview"]
order: 27
---

# Markdown extensions in the card preview

The preview used `marked` with no sanitizing, so a card could run `<img onerror>` inside the Electron app, and tables had no borders. Port the GitBasedDocs render pipeline (`dashboard/lib/render/markdown.ts`) and bring its extensions over.

- [x] `src/lib/render.ts`: remark/rehype pipeline, raw HTML through rehype-sanitize's GitHub allowlist before any of our transforms
- [x] Shiki code blocks: `title="lib/auth.ts"`, marked lines `{2}`, `// [!code ++]` and `// [!code --]`, copy button, plain text for unknown languages
- [x] Mermaid: loads only when a card has a diagram, redraws on theme flip, a broken diagram shows its error and source
- [x] KaTeX: `$E = mc^2$` and `$$...$$`; "$5 or $50" stays text
- [x] Callouts: every Obsidian type, custom titles, `[!faq]-` and `[!faq]+`
- [x] Tables with cell borders, scroll box for wide ones; task lists; footnotes
- [x] Wikilinks `[[card]]` open that card (title, file name or id); unknown ones dimmed
- [x] Images: `![[img.png|300]]` and `![alt](./img.png)` read from the project folder; new `mdkanban:read-binary` IPC serves image files only
- [x] `==highlight==`, `%%comments%%` hidden in preview and on board card excerpts
- [x] `<details>`, `<kbd>`, `<sub>`, `<sup>` allowed; scripts, iframes, forms, inline styles removed
- [x] Heading anchors and an "On this page" list
- [x] External links open in the system browser; the app window never navigates away
- [x] `bun src/lib/render.check.ts` passes, `bun run build` clean, checked in the browser build on demo cards
- [ ] Check in the desktop app with a real folder: image embeds, external links, mermaid

Shipped 2026-09-10. Renderer and editor load on first card open, so the main bundle stays at 165 kB.
