<script setup lang="ts">
import { ref, watch } from 'vue'
import UiInput from '@/components/ui/UiInput.vue'
import UiBadge from '@/components/ui/UiBadge.vue'
import { allLabels, filters, resetFilters, selectedProjectId, togglePriorityFilter } from '@/stores/board'
import type { BoardFilters, Priority } from '@/lib/types'

const priorities: Priority[] = ['critical', 'high', 'medium', 'low']

const VIEWS_KEY = 'md-kanban/views/v1'
type ViewMap = Record<string, Record<string, BoardFilters>>

function readViews(): ViewMap {
  try {
    return JSON.parse(localStorage.getItem(VIEWS_KEY) ?? '{}') as ViewMap
  } catch { return {} }
}
function projectViews(): Record<string, BoardFilters> {
  return readViews()[selectedProjectId.value] ?? {}
}

const views = ref<string[]>(Object.keys(projectViews()))
watch(selectedProjectId, () => { views.value = Object.keys(projectViews()) })

function persistViews(map: ViewMap) {
  try { localStorage.setItem(VIEWS_KEY, JSON.stringify(map)) } catch { /* private mode */ }
}

function saveView() {
  const name = prompt('Save current filters as view:')?.trim()
  if (!name) return
  const map = readViews()
  const key = selectedProjectId.value
  map[key] = { ...(map[key] ?? {}), [name]: { ...filters, priorities: [...filters.priorities] } }
  persistViews(map)
  views.value = Object.keys(map[key]!)
}

function applyView(name: string) {
  const v = projectViews()[name]
  if (!v) return
  filters.query = v.query
  filters.priorities = [...v.priorities]
  filters.assignee = v.assignee
  filters.label = v.label
  filters.due = v.due
}

function deleteView(name: string) {
  const map = readViews()
  const key = selectedProjectId.value
  if (!map[key]?.[name]) return
  delete map[key]![name]
  persistViews(map)
  views.value = Object.keys(map[key] ?? {})
}
</script>

<template>
  <div class="flex flex-col gap-1.5">
  <div class="flex flex-wrap items-center gap-2">
    <UiInput v-model="filters.query" placeholder="Search title, body, id, assignee, label..." cls="max-w-xs" />
    <div class="flex items-center gap-1">
      <button
        v-for="p in priorities"
        :key="p"
        @click="togglePriorityFilter(p)"
        :class="['h-8 border px-2.5 text-xs font-medium transition', filters.priorities.includes(p) ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground']"
      >
        {{ p }}
      </button>
    </div>
    <input v-model="filters.assignee" placeholder="assignee" class="h-8 w-28 rounded-md border border-border bg-background px-2 text-xs" />
    <select v-model="filters.label" class="h-8 rounded-md border border-border bg-background px-2 text-xs">
      <option value="">all labels</option>
      <option v-for="l in allLabels" :key="l" :value="l">#{{ l }}</option>
    </select>
    <select v-model="filters.due" class="h-8 rounded-md border border-border bg-background px-2 text-xs">
      <option value="all">any due</option>
      <option value="overdue">overdue</option>
      <option value="today">today</option>
      <option value="week">this week</option>
      <option value="none">no date</option>
    </select>
    <button @click="resetFilters()" class="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground">reset</button>
    <UiBadge variant="secondary">{{ filters.query ? 'filtered' : 'all' }}</UiBadge>
    <button @click="saveView()" class="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground" title="Save current filters as a named view">save view</button>
  </div>
  <div v-if="views.length" class="flex flex-wrap items-center gap-1.5">
    <span
      v-for="v in views"
      :key="v"
      class="inline-flex items-center gap-1 border px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground"
    >
      <button @click="applyView(v)" :title="`Apply view ${v}`">{{ v }}</button>
      <button @click="deleteView(v)" class="hover:text-destructive" :title="`Delete view ${v}`" aria-label="Delete view">×</button>
    </span>
  </div>
  </div>
</template>
