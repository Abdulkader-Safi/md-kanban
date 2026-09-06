import { computed, reactive, ref } from 'vue'
import { get, set } from 'idb-keyval'
import type { BoardFilters, Priority, ProjectRoot, StatusId, Task } from '@/lib/types'
import { DEFAULT_COLUMNS } from '@/lib/types'
import { buildNewTask, parseTaskFile, stringifyTaskFile, type NewTaskInput } from '@/lib/markdown'
import { deleteProjectFile, loadHandles, pickDirectory, removeHandle, saveHandle, scanProject, supportsFS, writeProjectFile } from '@/lib/fs'
import { demoTasks } from '@/lib/demo'

const META_KEY = 'md-kanban/projects-meta/v1'
const DEMO_TASKS_KEY = 'md-kanban/demo-tasks/v1'

interface ProjectMeta {
  id: string
  name: string
  kind: 'fs' | 'demo'
}

function uid(): string {
  return Math.random().toString(36).slice(2, 10)
}

const projects = ref<ProjectRoot[]>([])
const tasks = ref<Task[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const fsSupported = supportsFS()

const selectedProjectId = ref<string | 'all'>('all')
const selectedWorkspace = ref<string | 'all'>('all')

const filters = reactive<BoardFilters>({
  query: '',
  priorities: [],
  assignee: '',
  label: '',
  due: 'all',
})

const handles: Record<string, any> = {}

export function useBoard() {
  return {
    projects,
    tasks,
    loading,
    error,
    fsSupported,
    filters,
    selectedProjectId,
    selectedWorkspace,
    columns: DEFAULT_COLUMNS,
  }
}

async function persistMeta() {
  const meta: ProjectMeta[] = projects.value.map((p) => ({ id: p.id, name: p.name, kind: p.kind }))
  await set(META_KEY, meta)
}

async function loadMeta(): Promise<ProjectMeta[]> {
  try {
    return (await get<ProjectMeta[]>(META_KEY)) ?? []
  } catch {
    return []
  }
}

function taskMatchesProject(t: Task): boolean {
  const pid = selectedProjectId.value
  if (pid === 'all') return true
  const proj = projects.value.find((p) => p.id === pid)
  if (!proj) return true
  if (t.project !== proj.name) return false
  if (selectedWorkspace.value !== 'all' && t.workspace !== selectedWorkspace.value) return false
  return true
}

function isOverdue(due: string | null): boolean {
  if (!due) return false
  return new Date(due + 'T23:59:59').getTime() < Date.now()
}
function isToday(due: string | null): boolean {
  if (!due) return false
  return due === new Date().toISOString().slice(0, 10)
}
function isThisWeek(due: string | null): boolean {
  if (!due) return false
  const diff = new Date(due).getTime() - Date.now()
  return diff >= 0 && diff < 7 * 864e5
}

export const visibleTasks = computed(() => {
  const q = filters.query.trim().toLowerCase()
  return tasks.value
    .filter(taskMatchesProject)
    .filter((t) => {
      if (q && !(t.title + ' ' + t.body + ' ' + t.id + ' ' + t.assignee + ' ' + t.labels.join(' ')).toLowerCase().includes(q)) return false
      if (filters.priorities.length && !filters.priorities.includes(t.priority)) return false
      if (filters.assignee && t.assignee.toLowerCase() !== filters.assignee.toLowerCase()) return false
      if (filters.label && !t.labels.includes(filters.label)) return false
      if (filters.due === 'overdue' && !isOverdue(t.dueDate)) return false
      if (filters.due === 'today' && !isToday(t.dueDate)) return false
      if (filters.due === 'week' && !isThisWeek(t.dueDate)) return false
      if (filters.due === 'none' && t.dueDate) return false
      return true
    })
    .sort((a, b) => a.order - b.order)
})

export const workspaces = computed(() => {
  const pid = selectedProjectId.value
  const names = new Set<string>()
  tasks.value.forEach((t) => {
    if (pid !== 'all') {
      const proj = projects.value.find((p) => p.id === pid)
      if (!proj || t.project !== proj.name) return
    }
    if (t.workspace) names.add(t.workspace)
  })
  return [...names].sort()
})

export const allLabels = computed(() => {
  const s = new Set<string>()
  tasks.value.filter(taskMatchesProject).forEach((t) => t.labels.forEach((l) => s.add(l)))
  return [...s].sort()
})

export const counts = computed(() => {
  const map: Record<string, number> = {}
  for (const t of visibleTasks.value) map[t.status] = (map[t.status] ?? 0) + 1
  return map
})

export async function initBoard() {
  loading.value = true
  error.value = null
  try {
    const meta = await loadMeta()
    const stored = await loadHandles()
    Object.assign(handles, stored)
    if (meta.length === 0) {
      // First run: load demo projects so the board is not empty
      projects.value = [
        { id: 'demo-website', name: 'website-redesign', kind: 'demo' },
        { id: 'demo-mobile', name: 'mobile-app', kind: 'demo' },
      ]
      tasks.value = await loadDemoTasks()
      await persistMeta()
    } else {
      projects.value = meta.map((m) => ({ id: m.id, name: m.name, kind: m.kind }))
      await rescanAll()
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load board'
  } finally {
    loading.value = false
  }
}

async function loadDemoTasks(): Promise<Task[]> {
  try {
    const saved = await get<string>(DEMO_TASKS_KEY)
    if (saved) {
      const arr = JSON.parse(saved) as Array<{ raw: string; project: string; workspace: string; relPath: string; fileName: string }>
      return arr.map((s) => parseTaskFile(s.raw, s))
    }
  } catch { /* fall through */ }
  return demoTasks()
}

async function persistDemoTasks() {
  const demo = tasks.value.filter((t) => projects.value.find((p) => p.name === t.project)?.kind === 'demo')
  const arr = demo.map((t) => ({ raw: stringifyTaskFile(t), project: t.project, workspace: t.workspace, relPath: t.relPath, fileName: t.fileName }))
  await set(DEMO_TASKS_KEY, JSON.stringify(arr))
}

export async function connectFolder() {
  const handle = await pickDirectory()
  if (!handle) return
  const id = uid()
  const name = handle.name || `project-${id}`
  handles[id] = handle
  await saveHandle(id, handle)
  projects.value.push({ id, name, kind: 'fs' })
  await persistMeta()
  await rescanProject(id)
  selectedProjectId.value = id
}

export async function rescanProject(projectId: string) {
  const proj = projects.value.find((p) => p.id === projectId)
  if (!proj || proj.kind !== 'fs') return
  const handle = handles[projectId]
  if (!handle) {
    error.value = `Folder handle for "${proj.name}" is missing. Reconnect the folder.`
    return
  }
  loading.value = true
  try {
    const files = await scanProject(handle)
    const parsed = files.map((f) =>
      parseTaskFile(f.content, { project: proj.name, workspace: f.workspace, relPath: f.relPath, fileName: f.fileName }),
    )
    tasks.value = [...tasks.value.filter((t) => t.project !== proj.name), ...parsed]
  } finally {
    loading.value = false
  }
}

export async function rescanAll() {
  const lists: Task[] = []
  const demo = await loadDemoTasks()
  lists.push(...demo.filter((t) => projects.value.some((p) => p.kind === 'demo' && p.name === t.project)))
  for (const p of projects.value.filter((x) => x.kind === 'fs')) {
    const handle = handles[p.id]
    if (!handle) continue
    try {
      const files = await scanProject(handle)
      files.forEach((f) => lists.push(parseTaskFile(f.content, { project: p.name, workspace: f.workspace, relPath: f.relPath, fileName: f.fileName })))
    } catch { /* keep going */ }
  }
  tasks.value = lists
}

export async function disconnectProject(projectId: string) {
  const proj = projects.value.find((p) => p.id === projectId)
  if (!proj) return
  if (proj.kind === 'fs') await removeHandle(projectId)
  delete handles[projectId]
  projects.value = projects.value.filter((p) => p.id !== projectId)
  tasks.value = tasks.value.filter((t) => t.project !== proj.name)
  if (selectedProjectId.value === projectId) {
    selectedProjectId.value = 'all'
    selectedWorkspace.value = 'all'
  }
  await persistMeta()
}

export async function createTask(input: NewTaskInput, workspace = '') {
  const pid = selectedProjectId.value
  let proj = projects.value.find((p) => p.id === pid) ?? projects.value[0]
  if (!proj) throw new Error('No project connected')
  const ws = workspace || (selectedWorkspace.value === 'all' ? '' : selectedWorkspace.value)
  const { task } = buildNewTask(input, { project: proj.name, workspace: ws })
  if (proj.kind === 'fs') {
    await writeProjectFile(handles[proj.id], task.relPath, stringifyTaskFile(task))
  } else {
    tasks.value.push(task)
    await persistDemoTasks()
  }
  // optimistic update for fs too, then rescan quietly
  if (proj.kind === 'fs') {
    tasks.value.push(task)
  }
  return task
}

export async function updateTask(id: string, patch: Partial<Task> & { title?: string; body?: string }) {
  const idx = tasks.value.findIndex((t) => t.id === id)
  if (idx < 0) return
  const next: Task = { ...tasks.value[idx], ...patch, modified: new Date().toISOString() }
  if (patch.title && !patch.body) {
    next.body = next.body.replace(/^#\s+.+$/m, `# ${patch.title}`)
  }
  tasks.value[idx] = next
  const proj = projects.value.find((p) => p.name === next.project)
  if (!proj) return
  if (proj.kind === 'fs') {
    await writeProjectFile(handles[proj.id], next.relPath, stringifyTaskFile(next))
  } else {
    await persistDemoTasks()
  }
}

export async function moveTask(id: string, status: StatusId) {
  const t = tasks.value.find((x) => x.id === id)
  if (!t || t.status === status) return
  const columnTasks = tasks.value.filter((x) => x.project === t.project && x.status === status)
  const maxOrder = columnTasks.reduce((m, x) => Math.max(m, x.order), 0)
  await updateTask(id, { status, order: maxOrder + 1 })
}

export async function deleteTask(id: string) {
  const t = tasks.value.find((x) => x.id === id)
  if (!t) return
  tasks.value = tasks.value.filter((x) => x.id !== id)
  const proj = projects.value.find((p) => p.name === t.project)
  if (!proj) return
  if (proj.kind === 'fs') {
    await deleteProjectFile(handles[proj.id], t.relPath)
  } else {
    await persistDemoTasks()
  }
}

export function togglePriorityFilter(p: Priority) {
  const i = filters.priorities.indexOf(p)
  if (i >= 0) filters.priorities.splice(i, 1)
  else filters.priorities.push(p)
}

export function resetFilters() {
  filters.query = ''
  filters.priorities = []
  filters.assignee = ''
  filters.label = ''
  filters.due = 'all'
}
