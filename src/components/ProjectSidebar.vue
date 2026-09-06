<script setup lang="ts">
import { computed } from 'vue'
import { IconFolderOpen, IconLayoutGrid, IconPlugOff, IconRefresh } from '@tabler/icons-vue'
import UiButton from '@/components/ui/UiButton.vue'
import {
  connectFolder,
  disconnectProject,
  rescanAll,
  rescanProject,
  useBoard,
  workspaces,
} from '@/stores/board'

const { projects, tasks, selectedProjectId, selectedWorkspace, loading, fsSupported, autoRefresh, lastCheck, isElectron } = useBoard()

const openCount = computed(() => {
  const map: Record<string, number> = {}
  for (const t of tasks.value) {
    if (t.status === 'done') continue
    map[t.project] = (map[t.project] ?? 0) + 1
  }
  return map
})

const lastCheckLabel = computed(() =>
  lastCheck.value ? lastCheck.value.toLocaleTimeString() : 'never',
)

function selectProject(id: string | 'all') {
  selectedProjectId.value = id
  selectedWorkspace.value = 'all'
}
</script>

<template>
  <aside class="flex w-60 shrink-0 flex-col gap-3 overflow-y-auto border-r border-sidebar-border bg-sidebar text-sidebar-foreground p-3">
    <UiButton @click="connectFolder()" size="sm" class="w-full">
      <IconFolderOpen class="h-4 w-4" /> Connect folder
    </UiButton>
    <p v-if="!fsSupported && !isElectron" class="rounded-md bg-amber-500/10 p-2 text-[11px] leading-4 text-amber-700 dark:text-amber-300">
      This browser cannot open folders directly. Use Chrome or Edge for folder access. Demo projects work everywhere.
    </p>

    <div class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Projects</div>
    <button
      @click="selectProject('all')"
      :class="['flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm', selectedProjectId === 'all' ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground' : 'hover:bg-sidebar-accent/50']"
    >
      <IconLayoutGrid class="h-4 w-4" /> All projects
    </button>
    <div v-for="p in projects" :key="p.id" class="group">
      <button
        @click="selectProject(p.id)"
        :class="['flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm', selectedProjectId === p.id ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground' : 'hover:bg-sidebar-accent/50']"
      >
        <span class="truncate">{{ p.name }}</span>
        <span class="ml-auto rounded bg-secondary px-1 text-[10px] text-secondary-foreground" :title="p.kind">{{ openCount[p.name] ?? 0 }}</span>
      </button>
      <div v-if="selectedProjectId === p.id" class="mt-1 flex gap-1 px-2">
        <button v-if="p.kind === 'fs'" @click="rescanProject(p.id, { askPerm: true })" class="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground" title="Rescan folder">
          <IconRefresh class="h-3 w-3" /> rescan
        </button>
        <button @click="disconnectProject(p.id)" class="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-destructive" title="Remove project">
          <IconPlugOff class="h-3 w-3" /> remove
        </button>
      </div>
    </div>

    <div v-if="workspaces.length" class="mt-2">
      <div class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Work folders</div>
      <button
        @click="selectedWorkspace = 'all'"
        :class="['mt-1 flex w-full rounded-md px-2 py-1 text-left font-mono text-xs', selectedWorkspace === 'all' ? 'bg-sidebar-accent font-semibold text-sidebar-accent-foreground' : 'hover:bg-sidebar-accent/50']"
      >
        all
      </button>
      <button
        v-for="w in workspaces"
        :key="w"
        @click="selectedWorkspace = w"
        :class="['flex w-full rounded-md px-2 py-1 text-left font-mono text-xs', selectedWorkspace === w ? 'bg-sidebar-accent font-semibold text-sidebar-accent-foreground' : 'hover:bg-sidebar-accent/50']"
      >
        {{ w }}
      </button>
    </div>

    <div class="mt-auto flex flex-col gap-2 border-t pt-2">
      <UiButton variant="outline" size="sm" @click="rescanAll({ askPerm: true })" :disabled="loading">
        <IconRefresh class="h-3.5 w-3.5" /> Rescan all
      </UiButton>
      <label class="flex cursor-pointer items-center gap-2 text-[11px] text-muted-foreground">
        <input type="checkbox" v-model="autoRefresh" class="h-3.5 w-3.5 accent-[rgb(var(--sidebar-accent))]" />
        Auto-refresh folders
      </label>
      <p class="font-mono text-[10px] text-muted-foreground/70">checked {{ lastCheckLabel }}</p>
      <p class="text-[11px] leading-4 text-muted-foreground">
        Each folder is a project. Subfolders group work. Every card is a markdown file with YAML frontmatter.
      </p>
    </div>
  </aside>
</template>
