<script setup lang="ts">
import { computed, ref } from 'vue'
import type { BoardColumn, StatusId } from '@/lib/types'
import { moveTaskAt, tasks, visibleTasks } from '@/stores/board'
import TaskCard from '@/components/TaskCard.vue'

const props = defineProps<{ column: BoardColumn }>()
const emit = defineEmits<{ open: [id: string]; newTask: [status: StatusId]; moved: [{ id: string; from: StatusId; fromOrder: number; to: StatusId; toName: string }] }>()

const over = ref(false)
const draggingId = ref<string | null>(null)
const dropIndex = ref<number>(0)
const listEl = ref<HTMLElement | null>(null)

const cards = computed(() => visibleTasks.value.filter((t) => t.status === props.column.id))

function onDragStart(e: DragEvent, id: string) {
  draggingId.value = id
  e.dataTransfer?.setData('text/task-id', id)
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
}

function onDragOver(e: DragEvent) {
  e.preventDefault()
  over.value = true
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
  const list = listEl.value
  if (list) {
    const rect = list.getBoundingClientRect()
    // vertical autoscroll inside the column
    if (e.clientY < rect.top + 48) list.scrollTop -= 10
    else if (e.clientY > rect.bottom - 48) list.scrollTop += 10
    // landing index from pointer height
    const els = list.querySelectorAll('article')
    let idx = els.length
    for (let i = 0; i < els.length; i++) {
      const r = els[i].getBoundingClientRect()
      if (e.clientY < r.top + r.height / 2) {
        idx = i
        break
      }
    }
    dropIndex.value = idx
  }
  // horizontal autoscroll for the board strip
  const board = document.querySelector('main > div.board-scroll')
  if (board instanceof HTMLElement) {
    if (e.clientX < 96) board.scrollLeft -= 14
    else if (e.clientX > window.innerWidth - 96) board.scrollLeft += 14
  }
}

async function onDrop(e: DragEvent) {
  e.preventDefault()
  over.value = false
  const id = e.dataTransfer?.getData('text/task-id') ?? draggingId.value
  draggingId.value = null
  if (!id) return
  const t = tasks.value.find((x) => x.id === id)
  if (!t) return
  let idx = dropIndex.value
  const cur = cards.value.findIndex((x) => x.id === id)
  if (t.status === props.column.id && cur >= 0) {
    if (cur === idx || cur + 1 === idx) return
    if (cur < idx) idx -= 1
  }
  const col = cards.value.filter((x) => x.id !== id)
  const from = t.status
  const fromOrder = t.order
  await moveTaskAt(id, props.column.id, idx > col.length ? undefined : idx)
  emit('moved', { id, from, fromOrder, to: props.column.id, toName: props.column.name })
}
</script>

<template>
  <section
    @dragover="onDragOver"
    @dragleave="over = false"
    @drop="onDrop"
    :class="['flex w-72 shrink-0 flex-col rounded-lg border bg-muted/40', over && 'column-dragover']"
    :aria-label="column.name"
  >
    <header class="flex items-center gap-2 px-3 pt-3 pb-2">
      <span class="h-2.5 w-2.5 rounded-full" :style="{ background: column.color }" />
      <h3 class="text-sm font-semibold">{{ column.name }}</h3>
      <span class="ml-auto rounded-full bg-secondary px-2 text-xs font-medium">{{ cards.length }}</span>
      <button @click="emit('newTask', column.id)" class="rounded px-1.5 text-lg leading-none text-muted-foreground hover:bg-accent hover:text-foreground" title="Add card">+</button>
    </header>
    <div ref="listEl" class="board-scroll flex flex-1 flex-col gap-2 overflow-y-auto px-2 pb-3 min-h-[120px]">
      <template v-for="(t, i) in cards" :key="t.id">
        <div v-if="over && dropIndex === i" class="drop-slot" aria-hidden="true" />
        <TaskCard
          :task="t"
          :dragging="draggingId === t.id"
          @open="emit('open', $event)"
          @dragstart="onDragStart"
          @dragend="draggingId = null"
          @moved="emit('moved', $event)"
        />
      </template>
      <div v-if="over && dropIndex >= cards.length" class="drop-slot" aria-hidden="true" />
      <button
        @click="emit('newTask', column.id)"
        class="rounded-lg border border-dashed p-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        + Add card
      </button>
    </div>
  </section>
</template>
