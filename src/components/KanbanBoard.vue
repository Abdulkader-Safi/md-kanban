<script setup lang="ts">
import type { BoardColumn } from '@/lib/types'
import KanbanColumn from '@/components/KanbanColumn.vue'

defineProps<{ columns: BoardColumn[] }>()
const emit = defineEmits<{ open: [id: string]; newTask: [status: string] }>()
</script>

<template>
  <div class="board-scroll flex flex-1 items-stretch gap-3 overflow-x-auto pb-2">
    <KanbanColumn
      v-for="c in columns"
      :key="c.id"
      :column="c"
      @open="emit('open', $event)"
      @newTask="emit('newTask', $event)"
    />
  </div>
</template>
