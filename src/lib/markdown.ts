import type { Priority, StatusId, Task } from './types'

/* Browser-safe YAML frontmatter handling (no Node deps).
 * Covers the task schema: strings, null, numbers, inline string arrays.
 */

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

export function makeFileName(title: string, d = new Date()): string {
  return `${slugify(title)}-${dateStamp(d)}.md`
}

/** Split raw markdown into frontmatter block + body. */
function splitFrontmatter(raw: string): { front: string; body: string } {
  const lines = raw.replace(/^\uFEFF/, '').split('\n')
  if (lines[0]?.trim() !== '---') return { front: '', body: raw }
  let end = -1
  for (let i = 1; i < lines.length; i++) {
    if (lines[i]?.trim() === '---') {
      end = i
      break
    }
  }
  if (end < 0) return { front: '', body: raw }
  return {
    front: lines.slice(1, end).join('\n'),
    body: lines.slice(end + 1).join('\n'),
  }
}

function unquote(s: string): string {
  const t = s.trim()
  if (t.length >= 2 && t.startsWith('"') && t.endsWith('"')) {
    try {
      return JSON.parse(t) as string
    } catch {
      return t.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\')
    }
  }
  if (t.length >= 2 && t.startsWith("'") && t.endsWith("'")) {
    return t.slice(1, -1).replace(/''/g, "'")
  }
  return t
}

function parseScalar(t: string): string | number | null {
  const v = t.trim()
  if (v === '' || v === 'null' || v === '~') return null
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v)
  return unquote(v)
}

function parseInlineArray(v: string): string[] {
  const t = v.trim()
  if (!t.startsWith('[')) return t ? [unquote(t)] : []
  const inner = t.slice(1, t.lastIndexOf(']'))
  const out: string[] = []
  let cur = ''
  let quote: string | null = null
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i]
    if (quote) {
      cur += ch
      if (ch === quote && inner[i - 1] !== '\\') quote = null
    } else if (ch === '"' || ch === "'") {
      quote = ch
      cur += ch
    } else if (ch === ',') {
      const item = unquote(cur)
      if (item) out.push(item)
      cur = ''
    } else {
      cur += ch
    }
  }
  const last = unquote(cur)
  if (last) out.push(last)
  return out
}

type FrontData = Record<string, string | number | string[] | null>

function parseFront(front: string): FrontData {
  const data: FrontData = {}
  let currentKey: string | null = null
  let blockItems: string[] | null = null
  const flushBlock = () => {
    if (currentKey && blockItems) data[currentKey] = blockItems
    blockItems = null
  }
  for (const line of front.split('\n')) {
    if (!line.trim() || line.trim().startsWith('#')) continue
    const dash = line.match(/^\s*-\s+(.*)$/)
    if (dash && currentKey) {
      if (!blockItems) blockItems = []
      const item = unquote(dash[1] ?? '')
      if (item) blockItems.push(item)
      continue
    }
    const kv = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/)
    if (!kv) continue
    flushBlock()
    currentKey = kv[1]!
    const rest = (kv[2] ?? '').trim()
    if (rest === '' || rest === '[]') {
      // Could be an empty value or start of a block list; decide on next lines.
      data[currentKey] = rest === '[]' ? [] : ''
      continue
    }
    if (rest.startsWith('[')) {
      data[currentKey] = parseInlineArray(rest)
    } else {
      data[currentKey] = parseScalar(rest)
    }
  }
  flushBlock()
  // A key left as '' with block items collected is already flushed; plain '' means empty string.
  return data
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

function asText(v: unknown): string {
  if (typeof v === 'string') return v
  if (typeof v === 'number') return String(v)
  return ''
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
  const { front, body } = splitFrontmatter(raw)
  const data = parseFront(front)
  const id =
    typeof data.id === 'string' && data.id.length > 0
      ? data.id
      : meta.fileName.replace(/\.md$/, '')
  const now = new Date().toISOString()
  const content = body.trim()
  return {
    id,
    title: titleFromBody(content, id),
    body: content,
    status: asStatus(data.status),
    priority: asPriority(data.priority),
    assignee: asText(data.assignee),
    dueDate: asText(data.dueDate) || null,
    created: asText(data.created) || now,
    modified: asText(data.modified) || now,
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

function q(v: string): string {
  return JSON.stringify(v)
}

/** Serialize a task back to markdown with YAML frontmatter. */
export function stringifyTaskFile(task: Task): string {
  const front = [
    '---',
    `id: ${q(task.id)}`,
    `status: ${q(task.status)}`,
    `priority: ${q(task.priority)}`,
    `assignee: ${q(task.assignee || '')}`,
    `dueDate: ${task.dueDate ? q(task.dueDate) : 'null'}`,
    `created: ${q(task.created)}`,
    `modified: ${q(new Date().toISOString())}`,
    `labels: [${task.labels.map((l) => q(l)).join(', ')}]`,
    `order: ${task.order}`,
    '---',
    '',
  ].join('\n')
  const hasTitle = /^#\s+.+$/m.test(task.body)
  const body = (hasTitle ? task.body : `# ${task.title}\n\n${task.body}`).trim() + '\n'
  return front + body
}

export function buildNewTask(input: NewTaskInput, meta: { project: string; workspace: string }): Task {
  const now = new Date()
  const iso = now.toISOString()
  const id = makeId(input.title, now)
  const body = (input.body ?? '').trim() || `# ${input.title}\n`
  const fileName = makeFileName(input.title, now)
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
    relPath: meta.workspace ? `${meta.workspace}/${fileName}` : fileName,
    fileName,
  }
  return task
}
