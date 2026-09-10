# MD Kanban skill

---

name: md-kanban
description: Manage MD Kanban markdown task boards. Use whenever the user asks to track work, check project status, break work into tasks, add or move or finish a task, or mentions the kanban board, task folders, or what is done vs not done. Covers reading, creating, updating, moving, and deleting markdown task files.
---

# MD Kanban

MD Kanban tracks projects as folders of markdown task files. Each file is one task. The board in the browser reads these files, so anything you change here shows up there.

## Folder layout

- Each project is one folder, for example `website-redesign/`.
- Inside a project, subfolders group related work, for example `auth/`, `billing/`. Files at the project root have no work group.
- Every task is one `*.md` file. Scan folders recursively. Skip hidden folders, `node_modules`, and `dist`.

```
website-redesign/
  auth/
    login-form-2026-09-06.md
    signup-flow-2026-09-06.md
  billing/
    pricing-page-2026-09-06.md
```

## File format

Every file has YAML frontmatter followed by a markdown body. Keep all frontmatter keys when editing.

```markdown
---
id: "login-form-2026-09-06"
status: "todo"
priority: "high"
assignee: "safi"
dueDate: "2026-09-10"
created: "2026-09-06T10:30:00.000Z"
modified: "2026-09-06T14:20:00.000Z"
labels: ["feature", "auth"]
order: 1
---

# Rebuild login form

Task description, checkboxes, notes.
```

Field rules:

- `status`: `backlog`, `todo`, `in-progress`, `review`, or `done`. Moving a card across the board means changing this field.
- `priority`: `critical`, `high`, `medium`, or `low`.
- `id`: slug plus date, unique inside the project.
- `dueDate`: `YYYY-MM-DD` or null.
- `labels`: list of short tags.
- `order`: number for sorting inside a column. New cards go last, so use the current highest plus 1.
- `created`: set once. `modified`: refresh to the current UTC time on every edit.
- The first `#` heading matches the task title.

## Writing the body

The card preview renders more than plain markdown. Use these where they help; the file stays readable as text either way.

| Write                                                                     | Preview shows                                                                  | Rendered by                        |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ---------------------------------- |
| `\| a \| b \|` tables, `- [ ]` checklists, `[^1]` footnotes, `~~strike~~` | GitHub-style tables with borders, checkboxes, footnotes                        | remark-gfm                         |
| ` ```ts title="lib/auth.ts" {2,4-5} `                                     | Coloured code with a file name label and lines 2, 4 and 5 marked               | Shiki                              |
| `old() // [!code --]` and `new() // [!code ++]` inside a fence            | Red and green diff lines, the comment removed                                  | Shiki transformers                 |
| ` ```mermaid ` fence                                                      | A diagram that follows light and dark mode; a broken one shows its error       | Mermaid                            |
| `$E = mc^2$` inline, `$$ ... $$` on its own lines                         | Typeset math. `$5 or $50` stays plain text                                     | KaTeX                              |
| `> [!note]`, `> [!tip] Title`, `> [!faq]- Folded`                         | Coloured callout box; `-` starts folded, `+` starts open                       | MD Kanban (`src/lib/render.ts`)    |
| `[[Card title]]`, `[[card-id\|label]]`, `[text](./other-card.md)`         | A link that opens that card. Matches title, file name or id, same project only | MD Kanban (`src/lib/render.ts`)    |
| `![[diagram.png\|300]]`, `![alt](./img/shot.png)`                         | The image, read from the project folder                                        | MD Kanban (`src/lib/render.ts`)    |
| `==key point==`                                                           | Highlighted text                                                               | MD Kanban (`src/lib/render.ts`)    |
| `%% private note %%`                                                      | Nothing. Hidden in the preview and on the board card                           | MD Kanban (`src/lib/render.ts`)    |
| `<details>`, `<kbd>`, `<sub>`, `<sup>`                                    | As in HTML                                                                     | rehype-sanitize (GitHub allowlist) |
| `## Heading`                                                              | Anchor link; h2 and h3 fill an "On this page" list                             | rehype-slug                        |

Rules for these:

- Link related cards with `[[Card title]]` instead of pasting file paths.
- Put blockers in `> [!warning]` and open questions in `> [!faq]-` so they stand out.
- Supported callout types: note, info, todo, abstract, summary, tldr, important, tip, hint, success, check, done, warning, caution, attention, question, help, faq, danger, error, failure, fail, missing, bug, quote, cite, example. Unknown types show as a note.
- Image paths are relative to the card file. `![[name.png]]` also tries the project root.
- `%%` comments are hidden from people, not from the file. Never put secrets in them. Two `%%` anywhere, even inside backticks, hide the text between them.
- Scripts, iframes, forms and `style` attributes are stripped, so do not rely on them.
- `- [ ]` items anywhere in the body count toward the card's subtask badge.

## Adding a task

1. Pick the right project folder and work subfolder. Create the subfolder when it does not exist yet.
2. Name the file `<slug>-YYYY-MM-DD.md`, for example `password-reset-2026-09-06.md`.
3. Fill in every frontmatter key. Default `status` to `todo` unless the user says otherwise. Default `priority` to `medium`.
4. Write a short body with enough detail that another agent could pick up the work.

## Updating and moving a task

- Edit the body, title, priority, assignee, due date, or labels directly. Always refresh `modified`.
- To move a card, change `status` only. Do not touch anything else unless asked.
- When the user says a task is done, set `status` to `done` and note what was completed in the body.

## Deleting a task

Remove the file only when the user explicitly asks for deletion.

## Status check

When the user asks what is going on, what is done, or what is left:

1. List all `*.md` task files under the project folder or folders.
2. Group them by `status`.
3. Report counts per column, what moved to `done` recently (check `modified`), and what is overdue (`dueDate` before today with `status` not `done`).

## Planning work

When the user describes a piece of work to track, break it into small tasks, one file each. Put each file in the work subfolder it belongs to. Confirm the task list with the user before creating more than three files.
