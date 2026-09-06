<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { KanbanSquare, Plus } from 'lucide-vue-next'
import UiButton from '@/components/ui/UiButton.vue'
import ProjectSidebar from '@/components/ProjectSidebar.vue'
import FilterBar from '@/components/FilterBar.vue'
import KanbanBoard from '@/components/KanbanBoard.vue'
import TaskEditor from '@/components/TaskEditor.vue'
import NewTaskDialog from '@/components/NewTaskDialog.vue'
import { error, initBoard, loading, projects, selectedProjectId, tasks, useBoard, visibleTasks } from '@/stores/board'
import type { StatusId } from '@/lib/types'

const { columns } = useBoard()
const openTaskId = ref<string | null>(null)
const showNew = ref(false)
const newStatus = ref<StatusId>('backlog')

const activeProject = computed(() => projects.value.find((p) => p.id === selectedProjectId.value))

function openNew(status: string) {
  newStatus.value = status as StatusId
  showNew.value = true
}

onMounted(() => {
  void initBoard()
  window.addEventListener('keydown', (e) => {
    const tag = (e.target as HTMLElement)?.tagName
    if ((e.key === 'n' || e.key === 'N') && tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') {
      e.preventDefault()
      openNew('backlog')
    }
    if (e.key === 'Escape') {
      openTaskId.value = null
      showNew.value = false
    }
  })
})
</script>

<template>
  <div class="flex h-screen flex-col bg-background text-foreground">
    <header class="flex items-center gap-3 border-b px-4 py-2.5">
      <span class="flex items-center gap-2 font-bold"><KanbanSquare class="h-5 w-5" /> MD Kanban</span>
      <span class="hidden text-xs text-muted-foreground sm:block">local markdown board · {{ tasks.length }} cards · {{ projects.length }} projects</span>
      <span v-if="activeProject" class="rounded-full bg-secondary px-2.5 py-0.5 font-mono text-xs">{{ activeProject.name }}</span>
      <UiButton size="sm" @click="openNew('backlog')" class="ml-auto"><Plus class="h-4 w-4" /> New card <kbd class="ml-1 rounded bg-black/20 px-1 text-[10px]">N</kbd></UiButton>
    </header>

    <div class="flex min-h-0 flex-1">
      <ProjectSidebar class="hidden md:flex" />
      <main class="flex min-w-0 flex-1 flex-col gap-3 p-3">
        <FilterBar />
        <div v-if="loading" class="rounded-lg border p-6 text-sm text-muted-foreground">Loading folders...</div>
        <div v-else-if="error" class="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm">{{ error }}</div>
        <div v-else-if="!visibleTasks.length" class="flex flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-10 text-center">
          <p class="font-semibold">No cards match</p>
          <p class="max-w-sm text-sm text-muted-foreground">Connect a project folder, pick a different project or work folder, or create your first card. Cards are plain markdown files your AI agent can read and edit.</p>
          <UiButton size="sm" @click="openNew('backlog')">Create first card</UiButton>
        </div>
        <KanbanBoard v-else :columns="columns" @open="openTaskId = $event" @newTask="openNew" />
      </main>
    </div>

    <TaskEditor :taskId="openTaskId" @close="openTaskId = null" />
    <NewTaskDialog :open="showNew" :status="newStatus" workspaceHint="" @close="showNew = false" />
  </div>
</template>
