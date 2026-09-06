import { computed, reactive, ref, watch } from 'vue'
import { get, set } from 'idb-keyval'
import type { BoardFilters, Priority, ProjectRoot, StatusId, Task } from '@/lib/types'
import { DEFAULT_COLUMNS } from '@/lib/types'
import { buildNewTask, parseTaskFile, stringifyTaskFile, type NewTaskInput } from '@/lib/markdown'
import { deleteProjectFile, hasReadAccess, loadHandles, pickDirectory, removeHandle, requestReadAccess, saveHandle, scanProject, supportsFS, writeProjectFile } from '@/lib/fs'
import { demoTasks } from '@/lib/demo'

const META_KEY = 'md-kanban/projects-meta/v1'
const DEMO_TASKS_KEY = 'md-kanban/demo-tasks/v1'
const PREFS_KEY = 'md-kanban/prefs/v1'
const POLL_MS = 5000

interface ProjectMeta {
  id: string
  name: string
  kind: 'fs' | 'demo'
}

function uid(): string {
  return Math.random().toString(36).slice(2, 10)
}

const projects = ref<ProjectRoot[]>([])
export { projects }
const tasks = ref<Task[]>([])
export { tasks }
const loading = ref(false)
export { loading }
const error = ref<string | null>(null)
export { error }
const fsSupported = supportsFS()

const selectedProjectId = ref<string | 'all'>('all')
export { selectedProjectId }
const selectedWorkspace = ref<string | 'all'>('all')
export { selectedWorkspace }

const filters = reactive<BoardFilters>({
  query: '',
  priorities: [],
  assignee: '',
  label: '',
  due: 'all',
})
export { filters }

/** UI prefs that survive restarts: selection + auto-refresh. */
interface Prefs {
  projectId: string | 'all'
  workspace: string | 'all'
  autoRefresh: boolean
}

function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (raw) return { projectId: 'all', workspace: 'all', autoRefresh: true, ...JSON.parse(raw) }
  } catch { /* ignore */ }
  return { projectId: 'all', workspace: 'all', autoRefresh: true }
}

const autoRefresh = ref(true)
export { autoRefresh }

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
    autoRefresh,
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

function savePrefs() {
  try {
    const prefs: Prefs = {
      projectId: selectedProjectId.value,
      workspace: selectedWorkspace.value,
      autoRefresh: autoRefresh.value,
    }
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
  } catch { /* ignore */ }
}

watch([selectedProjectId, selectedWorkspace, autoRefresh], savePrefs)

let pollTimer: ReturnType<typeof setInterval> | null = null
let polling = false

/** Background refresh: re-read folders every few seconds so agent edits
 *  appear with no clicks. Never touches the selected project. */
async function pollOnce() {
  if (polling || document.hidden || !autoRefresh.value) return
  polling = true
  try {
    for (const p of projects.value.filter((x) => x.kind === 'fs')) {
      if (!handles[p.id]) continue
      try {
        await rescanProject(p.id, { quiet: true })
      } catch { /* keep old tasks on failure */ }
    }
  } finally {
    polling = false
  }
}

function startPoller() {
  if (pollTimer != null) return
  pollTimer = setInterval(() => void pollOnce(), POLL_MS)
}

export async function initBoard() {
  loading.value = true
  error.value = null
  try {
    const prefs = loadPrefs()
    autoRefresh.value = prefs.autoRefresh
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
      // Show the last known tasks instantly while the live scan runs.
      // On reload the browser drops folder permission, so the live scan may
      // fail. The snapshot keeps the board full until one rescan click.
      tasks.value = [...(await loadDemoTasks()), ...(await loadFsSnapshot())]
    }
    // Restore the previously selected project when it still exists.
    if (prefs.projectId !== 'all' && projects.value.some((p) => p.id === prefs.projectId)) {
      selectedProjectId.value = prefs.projectId
      selectedWorkspace.value = prefs.workspace
    }
    // Show the last known tasks instantly, then go live quietly.
    // On reload the browser drops folder permission, so the live scan may
    // fail. The snapshot keeps the board full until one rescan click.
    if (meta.length === 0) {
      tasks.value = [...(await loadDemoTasks()), ...(await loadFsSnapshot())]
    }
    await rescanAll({ quiet: true })
    startPoller()
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

const FS_TASKS_KEY = 'md-kanban/fs-tasks/v1'

interface StoredTask {
  raw: string
  project: string
  workspace: string
  relPath: string
  fileName: string
}

/** Snapshot of the last successful folder reads. Restores the board after
 *  a reload while folder permission is still missing. */
async function persistFsSnapshot() {
  try {
    const fsTasks = tasks.value.filter((t) => projects.value.some((p) => p.kind === 'fs' && p.name === t.project))
    const arr: StoredTask[] = fsTasks.map((t) => ({ raw: stringifyTaskFile(t), project: t.project, workspace: t.workspace, relPath: t.relPath, fileName: t.fileName }))
    await set(FS_TASKS_KEY, JSON.stringify(arr))
  } catch { /* ignore */ }
}

async function loadFsSnapshot(): Promise<Task[]> {
  try {
    const saved = await get<string>(FS_TASKS_KEY)
    if (!saved) return []
    const arr = JSON.parse(saved) as StoredTask[]
    const known = new Set(projects.value.filter((p) => p.kind === 'fs').map((p) => p.name))
    return arr
      .filter((s) => known.has(s.project))
      .map((s) => parseTaskFile(s.raw, s))
  } catch {
    return []
  }
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

export interface RescanOptions {
  /** Skip the loading spinner (background refresh). */
  quiet?: boolean
  /** Ask the browser for folder permission when needed (use from click handlers). */
  askPerm?: boolean
}

async function checkAccess(projectId: string, askPerm: boolean): Promise<any | null> {
  const handle = handles[projectId]
  if (!handle) return null
  const ok = askPerm ? await requestReadAccess(handle) : await hasReadAccess(handle)
  return ok ? handle : null
}

export async function rescanProject(projectId: string, opts: RescanOptions = {}) {
  const { quiet = false, askPerm = false } = opts
  const proj = projects.value.find((p) => p.id === projectId)
  if (!proj || proj.kind !== 'fs') return
  const handle = await checkAccess(projectId, askPerm)
  if (!handle) {
    if (!quiet) {
      error.value = handles[projectId]
        ? `Browser lost access to "${proj.name}". Click rescan to grant it again.`
        : `Folder handle for "${proj.name}" is missing. Reconnect the folder.`
    }
    return
  }
  if (!quiet) {
    loading.value = true
    error.value = null
  }
  try {
    const files = await scanProject(handle)
    const existing = tasks.value.filter((t) => t.project === proj.name)
    if (files.length === 0 && existing.length > 0) return // failed scan, keep old tasks
    const parsed = files.map((f) =>
      parseTaskFile(f.content, { project: proj.name, workspace: f.workspace, relPath: f.relPath, fileName: f.fileName }),
    )
    tasks.value = [...tasks.value.filter((t) => t.project !== proj.name), ...parsed]
    await persistFsSnapshot()
  } finally {
    if (!quiet) loading.value = false
  }
}

export async function rescanAll(opts: RescanOptions = {}) {
  const { quiet = false, askPerm = false } = opts
  if (!quiet) {
    loading.value = true
    error.value = null
  }
  try {
    const lists: Task[] = []
    const failed: string[] = []
    const demo = await loadDemoTasks()
    lists.push(...demo.filter((t) => projects.value.some((p) => p.kind === 'demo' && p.name === t.project)))
    for (const p of projects.value.filter((x) => x.kind === 'fs')) {
      const handle = await checkAccess(p.id, askPerm)
      if (!handle) {
        lists.push(...tasks.value.filter((t) => t.project === p.name)) // keep old tasks
        failed.push(p.name)
        continue
      }
      try {
        const files = await scanProject(handle)
        const existing = tasks.value.filter((t) => t.project === p.name)
        if (files.length === 0 && existing.length > 0) {
          lists.push(...existing) // failed scan, keep old tasks
          failed.push(p.name)
          continue
        }
        files.forEach((f) => lists.push(parseTaskFile(f.content, { project: p.name, workspace: f.workspace, relPath: f.relPath, fileName: f.fileName })))
      } catch {
        lists.push(...tasks.value.filter((t) => t.project === p.name)) // keep old tasks
        failed.push(p.name)
      }
    }
    tasks.value = lists
    if (failed.length === 0) {
      await persistFsSnapshot()
    } else if (!quiet) {
      error.value = `Showing saved tasks for ${failed.join(', ')}. Click rescan to reconnect the folders.`
    }
  } finally {
    if (!quiet) loading.value = false
  }
  // Note: rescan never changes the selected project or work folder.
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
