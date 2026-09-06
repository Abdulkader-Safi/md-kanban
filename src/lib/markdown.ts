import matter from 'gray-matter'
import type { Priority, StatusId, Task } from './types'

const VALID_STATUS: StatusId[] = ['backlog', 'todo', 'in-progress', 'review', 'done']
const VALID_PRIORITY: Priority[] = ['critical', 'high', 'medium', 'low']

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'task'
}

function dateStamp(d = new Date()): string {
  return d.toISOString().slice(0, 10)
}

export function makeId(title: string, d = new Date()): string {
  return `${slugify(title)}-${dateStamp(d)}`
}

export function makeFileName(title: string, d = new Date(), pattern = 'name-date'): string {
  const name = slugify(title)
  const stamp = dateStamp(d)
  const stampTime = d.toISOString().slice(0, 16).replace(/[:T]/g, '-')
  switch (pattern) {
    case 'date-name': return `${stamp}-${name}.md`
    case 'name-datetime': return `${name}-${stampTime}.md`
    case 'datetime-name': return `${stampTime}-${name}.md`
    default: return `${name}-${stamp}.md`
  }
}

function asStatus(v: unknown, fallback: StatusId = 'backlog'): StatusId {
  return typeof v === 'string' && (VALID_STATUS as string[]).includes(v) ? (v as StatusId) : fallback
}

function asPriority(v: unknown): Priority {
  return typeof v === 'string' && (VALID_PRIORITY as string[]).includes(v) ? (v as Priority) : 'medium'
}

function asStringArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x) => typeof x === 'string') as string[]
  if (typeof v === 'string' && v.length) return [v]
  return []
}

function titleFromBody(body: string, fallback: string): string {
  const m = body.match(/^#\s+(.+)$/m)
  return (m?.[1] ?? fallback).trim()
}

/**
 * Parse one markdown file into a Task.
 * Compatible with kanban-markdown-vscode-extension frontmatter:
 * id, status, priority, assignee, dueDate, created, modified, labels, order
 */
export function parseTaskFile(
  raw: string,
  meta: { project: string; workspace: string; relPath: string; fileName: string },
): Task {
  const parsed = matter(raw)
  const data = (parsed.data ?? {}) as Record<string, unknown>
  const id =
    typeof data.id === 'string' && data.id.length > 0
      ? data.id
      : meta.fileName.replace(/\.md$/, '')
  const now = new Date().toISOString()
  const body = parsed.content.trim()
  return {
    id,
    title: titleFromBody(body, id),
    body,
    status: asStatus(data.status),
    priority: asPriority(data.priority),
    assignee: typeof data.assignee === 'string' ? data.assignee : '',
    dueDate:
      typeof data.dueDate === 'string' && data.dueDate.length > 0 ? data.dueDate : null,
    created: typeof data.created === 'string' ? data.created : now,
    modified: typeof data.modified === 'string' ? data.modified : now,
    labels: asStringArray(data.labels),
    order: typeof data.order === 'number' ? data.order : 0,
    project: meta.project,
    workspace: meta.workspace,
    relPath: meta.relPath,
    fileName: meta.fileName,
  }
}

export interface NewTaskInput {
  title: string
  body?: string
  status?: StatusId
  priority?: Priority
  assignee?: string
  dueDate?: string | null
  labels?: string[]
}

/** Serialize a task back to markdown with YAML frontmatter. */
export function stringifyTaskFile(task: Task): string {
  const data = {
    id: task.id,
    status: task.status,
    priority: task.priority,
    assignee: task.assignee || '',
    dueDate: task.dueDate ?? null,
    created: task.created,
    modified: new Date().toISOString(),
    labels: task.labels,
    order: task.order,
  }
  const titleLine = task.body.match(/^#\s+.+$/m) ? '' : `# ${task.title}\n\n`
  const content = titleLine ? `${titleLine}${task.body}`.trim() + '\n' : task.body.trim() + '\n'
  const fenced = matter.stringify(content, data)
  return fenced
}

export function buildNewTask(input: NewTaskInput, meta: { project: string; workspace: string }): { task: Task; fileName: string } {
  const now = new Date()
  const iso = now.toISOString()
  const id = makeId(input.title, now)
  const body = (input.body ?? '').trim() || `# ${input.title}\n`
  const task: Task = {
    id,
    title: input.title,
    body,
    status: input.status ?? 'backlog',
    priority: input.priority ?? 'medium',
    assignee: input.assignee ?? '',
    dueDate: input.dueDate ?? null,
    created: iso,
    modified: iso,
    labels: input.labels ?? [],
    order: Date.now(),
    project: meta.project,
    workspace: meta.workspace,
    relPath: meta.workspace ? `${meta.workspace}/${makeFileName(input.title, now)}` : makeFileName(input.title, now),
    fileName: makeFileName(input.title, now),
  }
  return { task, fileName: task.fileName }
}

export const TASK_FILE_DOC = `---
id: "implement-dark-mode-toggle-2026-01-25"
status: "todo"
priority: "high"
assignee: "sarah"
dueDate: "2026-01-25"
created: "2026-01-25T10:30:00.000Z"
modified: "2026-01-25T14:20:00.000Z"
labels: ["feature", "ui"]
order: 0
---

# Implement dark mode toggle

Describe the work here. Any AI agent can read and update this file.
`
