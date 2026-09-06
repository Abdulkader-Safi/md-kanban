<script setup lang="ts">
import { ref } from 'vue'
import type { BoardColumn, StatusId } from '@/lib/types'
import { visibleTasks, counts, moveTask } from '@/stores/board'
import TaskCard from '@/components/TaskCard.vue'

const props = defineProps<{ column: BoardColumn }>()
const emit = defineEmits<{ open: [id: string]; newTask: [status: StatusId] }>()

const over = ref(false)
const draggingId = ref<string | null>(null)

const cards = () => visibleTasks.value.filter((t) => t.status === props.column.id)

function onDragStart(e: DragEvent, id: string) {
  draggingId.value = id
  e.dataTransfer?.setData('text/task-id', id)
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
}
function onDrop(e: DragEvent) {
  e.preventDefault()
  over.value = false
  const id = e.dataTransfer?.getData('text/task-id') ?? draggingId.value
  draggingId.value = null
  if (id) void moveTask(id, props.column.id)
}
</script>

<template>
  <section
    @dragover.prevent="over = true"
    @dragleave="over = false"
    @drop="onDrop"
    :class="['flex w-72 shrink-0 flex-col rounded-lg border bg-muted/40', over && 'column-dragover']"
  >
    <header class="flex items-center gap-2 px-3 pt-3 pb-2">
      <span class="h-2.5 w-2.5 rounded-full" :style="{ background: column.color }" />
      <h3 class="text-sm font-semibold">{{ column.name }}</h3>
      <span class="ml-auto rounded-full bg-secondary px-2 text-xs font-medium">{{ counts[column.id] ?? 0 }}</span>
      <button @click="emit('newTask', column.id)" class="rounded px-1.5 text-lg leading-none text-muted-foreground hover:bg-accent hover:text-foreground" title="Add card">+</button>
    </header>
    <div class="board-scroll flex flex-1 flex-col gap-2 overflow-y-auto px-2 pb-3 min-h-[120px]">
      <TaskCard
        v-for="t in cards()"
        :key="t.id"
        :task="t"
        :dragging="draggingId === t.id"
        @open="emit('open', $event)"
        @dragstart="onDragStart"
      />
      <button
        @click="emit('newTask', column.id)"
        class="rounded-lg border border-dashed p-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        + Add card
      </button>
    </div>
  </section>
</template>
