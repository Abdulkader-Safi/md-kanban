export type StatusId = 'backlog' | 'todo' | 'in-progress' | 'review' | 'done'
export type Priority = 'critical' | 'high' | 'medium' | 'low'

export interface BoardColumn {
  id: StatusId
  name: string
  color: string
}

export const DEFAULT_COLUMNS: BoardColumn[] = [
  { id: 'backlog', name: 'Backlog', color: '#6b7280' },
  { id: 'todo', name: 'To Do', color: '#3b82f6' },
  { id: 'in-progress', name: 'In Progress', color: '#f59e0b' },
  { id: 'review', name: 'Review', color: '#8b5cf6' },
  { id: 'done', name: 'Done', color: '#22c55e' },
]

export interface Task {
  id: string
  title: string
  body: string
  status: StatusId
  priority: Priority
  assignee: string
  dueDate: string | null
  created: string
  modified: string
  labels: string[]
  order: number
  /** project root folder name, e.g. "my-website" */
  project: string
  /** work subfolder inside the project, e.g. "auth" or "" for root */
  workspace: string
  /** file path relative to the project root, e.g. "auth/login.md" */
  relPath: string
  fileName: string
}

export interface ProjectRoot {
  id: string
  name: string
  /** "fs" = real folder via File System Access API, "demo" = built-in sample */
  kind: 'fs' | 'demo'
  rootPath?: string
}

export interface BoardFilters {
  query: string
  priorities: Priority[]
  assignee: string
  label: string
  due: 'all' | 'overdue' | 'today' | 'week' | 'none'
}

export const PRIORITY_ORDER: Record<Priority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
}
