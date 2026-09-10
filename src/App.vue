<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { IconFolders, IconLayoutKanban, IconMoon, IconPlus, IconSun } from '@tabler/icons-vue'
import UiButton from '@/components/ui/UiButton.vue'
import ProjectSidebar from '@/components/ProjectSidebar.vue'
import FilterBar from '@/components/FilterBar.vue'
import KanbanColumn from '@/components/KanbanColumn.vue'
import CommandPalette from '@/components/CommandPalette.vue'
import TaskEditor from '@/components/TaskEditor.vue'
import NewTaskDialog from '@/components/NewTaskDialog.vue'
import { createTask, error, initBoard, loading, moveTask, projects, selectedProjectId, tasks, updateTask, useBoard, visibleTasks } from '@/stores/board'
import { formatDue } from '@/lib/format'
import type { StatusId } from '@/lib/types'

const { columns } = useBoard()
const statusName = (s: StatusId) => columns.find((c) => c.id === s)?.name ?? s
const openTaskId = ref<string | null>(null)
const showNew = ref(false)
const showPalette = ref(false)
const showProjects = ref(false)
const newStatus = ref<StatusId>('backlog')
const view = ref<'board' | 'list'>(
  typeof localStorage !== 'undefined' && localStorage.getItem('md-kanban/view') === 'list' ? 'list' : 'board',
)
function setView(v: 'board' | 'list') {
  view.value = v
  try {
    localStorage.setItem('md-kanban/view', v)
  } catch { /* private mode */ }
}
const isDark = ref(document.documentElement.classList.contains('dark'))

function toggleTheme() {
  isDark.value = !isDark.value
  document.documentElement.classList.toggle('dark', isDark.value)
  localStorage.setItem('md-kanban/theme', isDark.value ? 'dark' : 'light')
}

const activeProject = computed(() => projects.value.find((p) => p.id === selectedProjectId.value))

function openNew(status: string) {
  newStatus.value = status as StatusId
  showNew.value = true
}

interface MoveToast { id: string; from: StatusId; fromOrder: number; to: StatusId; toName: string }
const moveToast = ref<MoveToast | null>(null)
let moveTimer: ReturnType<typeof setTimeout> | undefined
function onMoved(m: MoveToast) {
  moveToast.value = m
  clearTimeout(moveTimer)
  moveTimer = setTimeout(() => { moveToast.value = null }, 5000)
}
async function undoMove() {
  const m = moveToast.value
  if (!m) return
  clearTimeout(moveTimer)
  moveToast.value = null
  await updateTask(m.id, { status: m.from, order: m.fromOrder })
}

async function onPaletteOpen(id: string) {
  showPalette.value = false
  openTaskId.value = id
}
async function onPaletteCreate(title: string) {
  showPalette.value = false
  const t = await createTask(
    { title, body: `# ${title}\n`, status: 'backlog', priority: 'medium', assignee: '', dueDate: null, labels: [] },
  )
  openTaskId.value = t.id
}
async function onPaletteMove(status: StatusId) {
  const id = openTaskId.value
  if (!id) return
  showPalette.value = false
  const t = tasks.value.find((x) => x.id === id)
  if (!t || t.status === status) return
  await moveTask(id, status)
  onMoved({ id, from: t.status, fromOrder: t.order, to: status, toName: columns.find((c) => c.id === status)?.name ?? status })
}

onMounted(() => {
  void initBoard()
  window.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
      e.preventDefault()
      showPalette.value = !showPalette.value
      return
    }
    // A key the editor already handled (Escape closing its search panel)
    // stops here. The editor is contenteditable, so it counts as typing.
    if (e.defaultPrevented) return
    const target = e.target as HTMLElement | null
    const typing = !!target && (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable)
    if ((e.key === 'n' || e.key === 'N') && !typing) {
      e.preventDefault()
      openNew('backlog')
    }
    if (e.key === 'Escape') {
      if (showPalette.value) {
        showPalette.value = false
        return
      }
      openTaskId.value = null
      showNew.value = false
    }
  })
})
</script>

<template>
  <div class="flex h-screen flex-col bg-background text-foreground">
    <header class="flex items-center gap-3 border-b px-4 py-2.5">
      <span class="flex items-center gap-2 font-bold"><IconLayoutKanban class="h-5 w-5" /> MD Kanban</span>
      <span class="hidden text-xs text-muted-foreground sm:block">local markdown board · {{ tasks.length }} cards · {{ projects.length }} projects</span>
      <span v-if="activeProject" class="bg-secondary px-2.5 py-0.5 font-mono text-xs">{{ activeProject.name }}</span>
      <UiButton variant="outline" size="sm" @click="showProjects = true" class="md:hidden"><IconFolders class="h-4 w-4" /></UiButton>
      <UiButton variant="outline" size="sm" @click="showPalette = true" class="ml-auto">Search <kbd class="rounded bg-black/20 px-1 text-[10px]">⌘K</kbd></UiButton>
      <UiButton variant="ghost" size="icon" @click="toggleTheme" :title="isDark ? 'Light mode' : 'Dark mode'">
        <IconSun v-if="isDark" class="h-4 w-4" /><IconMoon v-else class="h-4 w-4" />
      </UiButton>
      <UiButton size="sm" @click="openNew('backlog')"><IconPlus class="h-4 w-4" /> New card <kbd class="ml-1 rounded bg-black/20 px-1 text-[10px]">N</kbd></UiButton>
    </header>

    <div class="flex min-h-0 flex-1">
      <ProjectSidebar class="hidden md:flex" />
      <div v-if="showProjects" class="fixed inset-0 z-40 flex bg-black/30 md:hidden" @click.self="showProjects = false">
        <ProjectSidebar class="h-full" />
      </div>
      <main class="flex min-w-0 flex-1 flex-col gap-3 p-3">
        <div class="flex items-center gap-2">
          <FilterBar class="min-w-0 flex-1" />
          <div class="ml-auto flex shrink-0 items-center rounded-md border p-0.5 text-xs" role="tablist" aria-label="View">
            <button
              role="tab"
              :aria-selected="view === 'board'"
              @click="setView('board')"
              :class="['rounded px-2.5 py-1 font-medium', view === 'board' ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground']"
            >Board</button>
            <button
              role="tab"
              :aria-selected="view === 'list'"
              @click="setView('list')"
              :class="['rounded px-2.5 py-1 font-medium', view === 'list' ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground']"
            >List</button>
          </div>
        </div>
        <div v-if="loading" class="rounded-lg border p-6 text-sm text-muted-foreground">Loading folders...</div>
        <div v-else-if="error" class="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm">{{ error }}</div>
        <div v-else-if="!visibleTasks.length" class="flex flex-1 flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-10 text-center">
          <p class="font-semibold">No cards match</p>
          <p class="max-w-sm text-sm text-muted-foreground">Connect a project folder, pick a different project or work folder, or create your first card. Cards are plain markdown files your AI agent can read and edit.</p>
          <UiButton size="sm" @click="openNew('backlog')">Create first card</UiButton>
        </div>
        <div v-else-if="view === 'list'" class="board-scroll min-h-0 flex-1 overflow-auto rounded-lg border">
          <table class="w-full border-collapse text-sm">
            <thead class="sticky top-0 bg-muted">
              <tr class="text-left text-xs text-muted-foreground">
                <th class="px-3 py-2 font-medium">Title</th>
                <th class="px-3 py-2 font-medium">Status</th>
                <th class="px-3 py-2 font-medium">Priority</th>
                <th class="px-3 py-2 font-medium">Due</th>
                <th class="px-3 py-2 font-medium">Assignee</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="t in visibleTasks"
                :key="t.id"
                tabindex="0"
                @click="openTaskId = t.id"
                @keydown.enter="openTaskId = t.id"
                class="cursor-pointer border-t hover:bg-accent/50 focus-visible:outline-2 focus-visible:outline-primary"
              >
                <td class="max-w-md truncate px-3 py-1.5 font-medium" :title="t.title">{{ t.title }}</td>
                <td class="whitespace-nowrap px-3 py-1.5 text-xs text-muted-foreground">{{ statusName(t.status) }}</td>
                <td class="whitespace-nowrap px-3 py-1.5 text-xs">{{ t.priority }}</td>
                <td class="whitespace-nowrap px-3 py-1.5 text-xs text-muted-foreground">{{ formatDue(t.dueDate) || '—' }}</td>
                <td class="whitespace-nowrap px-3 py-1.5 text-xs text-muted-foreground">{{ t.assignee ? `@${t.assignee}` : '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else class="board-scroll flex flex-1 items-stretch gap-3 overflow-x-auto pb-2">
          <KanbanColumn
            v-for="c in columns"
            :key="c.id"
            :column="c"
            @open="openTaskId = $event"
            @newTask="openNew"
            @moved="onMoved"
          />
        </div>
      </main>
    </div>

    <div v-if="moveToast" role="status" aria-live="polite" class="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-lg border bg-background px-4 py-2 text-sm shadow-xl">
      <span>Moved to {{ moveToast.toName }}</span>
      <UiButton size="sm" variant="outline" @click="undoMove">Undo</UiButton>
    </div>

    <TaskEditor :taskId="openTaskId" @close="openTaskId = null" @open="openTaskId = $event" />
    <NewTaskDialog :open="showNew" :status="newStatus" workspaceHint="" @close="showNew = false" />
    <CommandPalette
      :open="showPalette"
      :openTaskId="openTaskId"
      @close="showPalette = false"
      @openTask="onPaletteOpen"
      @createCard="onPaletteCreate"
      @moveOpen="onPaletteMove"
    />
  </div>
</template>
