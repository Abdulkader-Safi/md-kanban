<script setup lang="ts">
import { computed, ref } from 'vue'
import UiBadge from '@/components/ui/UiBadge.vue'
import type { StatusId, Task } from '@/lib/types'
import { DEFAULT_COLUMNS } from '@/lib/types'
import { moveTaskAt, tasks, updateTask } from '@/stores/board'
import { dueTone, formatDue } from '@/lib/format'

const props = defineProps<{ task: Task; dragging?: boolean }>()
const emit = defineEmits<{
  open: [id: string]
  dragstart: [e: DragEvent, id: string]
  dragend: []
  moved: [{ id: string; from: StatusId; fromOrder: number; to: StatusId; toName: string }]
}>()

const dueLabel = computed(() => formatDue(props.task.dueDate))
const tone = computed(() => dueTone(props.task.dueDate))
const shownLabels = computed(() => props.task.labels.slice(0, 3))
const extraLabels = computed(() => Math.max(0, props.task.labels.length - 3))
const excerpt = computed(() => {
  const noTitle = props.task.body.replace(/^#\s+.+$/m, '').trim()
  return noTitle.slice(0, 140)
})

const grabbed = ref(false)
const origin = ref<{ status: StatusId; order: number } | null>(null)
const announce = ref('')
const colName = (s: StatusId) => DEFAULT_COLUMNS.find((c) => c.id === s)?.name ?? s

async function doMove(to: StatusId, toIndex?: number) {
  const from = props.task.status
  const fromOrder = props.task.order
  if (from === to && toIndex == null) return
  await moveTaskAt(props.task.id, to, toIndex)
  emit('moved', { id: props.task.id, from, fromOrder, to, toName: colName(to) })
}

async function onKey(e: KeyboardEvent) {
  const src = e.target as HTMLElement
  const el = e.currentTarget as HTMLElement
  if (src !== el && e.key !== 'Escape') return
  if (e.key === ' ' || e.key === 'Spacebar') {
    e.preventDefault()
    if (!grabbed.value) {
      grabbed.value = true
      origin.value = { status: props.task.status, order: props.task.order }
      announce.value = `Picked up ${props.task.title}. Arrow keys move, Space drops, Escape cancels.`
    } else {
      grabbed.value = false
      origin.value = null
      announce.value = `Dropped ${props.task.title} in ${colName(props.task.status)}.`
      el.blur()
    }
    return
  }
  if (!grabbed.value) return
  if (e.key === 'Escape') {
    e.preventDefault()
    const o = origin.value
    grabbed.value = false
    origin.value = null
    if (o && (o.status !== props.task.status || o.order !== props.task.order)) {
      await updateTask(props.task.id, { status: o.status, order: o.order })
      announce.value = `Move cancelled. ${props.task.title} back in ${colName(o.status)}.`
    } else {
      announce.value = 'Move cancelled.'
    }
    return
  }
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    e.preventDefault()
    const idx = DEFAULT_COLUMNS.findIndex((c) => c.id === props.task.status)
    const next = DEFAULT_COLUMNS[idx + (e.key === 'ArrowRight' ? 1 : -1)]
    if (!next) return
    await doMove(next.id)
    announce.value = `${props.task.title} moved to ${next.name}. Space drops, Escape cancels.`
    return
  }
  if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
    e.preventDefault()
    const col = tasks.value
      .filter((t) => t.project === props.task.project && t.status === props.task.status)
      .sort((a, b) => a.order - b.order)
    const i = col.findIndex((t) => t.id === props.task.id)
    const ni = Math.max(0, Math.min(col.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)))
    if (ni === i) return
    await doMove(props.task.status, ni)
    announce.value = `${props.task.title} position ${ni + 1} of ${col.length} in ${colName(props.task.status)}.`
  }
}

async function moveTo(to: StatusId) {
  if (to === props.task.status) return
  await doMove(to)
  announce.value = `${props.task.title} moved to ${colName(to)}.`
  ;(document.activeElement as HTMLElement | null)?.blur?.()
}
</script>

<template>
  <article
    draggable="true"
    tabindex="0"
    :aria-grabbed="grabbed"
    :aria-label="task.title"
    @dragstart="emit('dragstart', $event, task.id)"
    @dragend="emit('dragend')"
    @click="emit('open', task.id)"
    @keydown="onKey"
    :class="['group cursor-pointer rounded-lg border bg-card p-3 shadow-sm transition hover:shadow-md hover:border-primary/40 focus-visible:outline-2 focus-visible:outline-primary', dragging && 'card-dragging', grabbed && 'kbd-grabbed']"
  >
    <div class="flex items-start justify-between gap-2">
      <h4 class="text-sm font-semibold leading-5">{{ task.title }}</h4>
      <div class="flex shrink-0 items-center gap-1">
        <UiBadge :variant="task.priority">{{ task.priority }}</UiBadge>
        <details class="relative" @click.stop>
          <summary
            class="cursor-pointer list-none rounded px-1.5 text-sm leading-none text-muted-foreground hover:bg-accent hover:text-foreground [&::-webkit-details-marker]:hidden"
            title="Move to column"
            aria-label="Move to column"
          >⋯</summary>
          <div class="absolute right-0 z-20 w-36 rounded-md border bg-popover p-1 shadow-lg">
            <button
              v-for="c in DEFAULT_COLUMNS"
              :key="c.id"
              :disabled="c.id === task.status"
              @click.stop="moveTo(c.id)"
              class="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-accent hover:text-accent-foreground disabled:opacity-40"
            >
              <span class="h-2 w-2 rounded-full" :style="{ background: c.color }" />
              {{ c.name }}
            </button>
          </div>
        </details>
      </div>
    </div>
    <p v-if="excerpt" class="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{{ excerpt }}</p>
    <div class="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
      <span v-if="task.assignee" class="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 font-medium">@{{ task.assignee }}</span>
      <span
        v-if="dueLabel"
        :class="['inline-flex items-center rounded-full px-2 py-0.5 font-medium', tone === 'red' && 'bg-red-500/15 text-red-600', tone === 'amber' && 'bg-amber-500/15 text-amber-600', tone === 'muted' && 'bg-secondary text-secondary-foreground']"
      >
        {{ dueLabel }} · {{ task.dueDate }}
      </span>
      <span v-if="task.workspace" class="rounded bg-muted px-1.5 py-0.5 font-mono">{{ task.workspace }}</span>
    </div>
    <div v-if="task.labels.length" class="mt-2 flex flex-wrap items-center gap-1">
      <span v-for="l in shownLabels" :key="l" class="rounded-full border px-1.5 py-px text-[11px] text-muted-foreground">#{{ l }}</span>
      <span v-if="extraLabels" class="text-[11px] text-muted-foreground">+{{ extraLabels }} more</span>
    </div>
    <div class="mt-1.5 font-mono text-[10px] text-muted-foreground/70">{{ task.relPath }}</div>
    <p v-if="grabbed" class="mt-2 text-[11px] font-medium text-primary">Moving — arrows shift, Space drops, Esc cancels</p>
    <span class="sr-only" aria-live="polite">{{ announce }}</span>
  </article>
</template>
