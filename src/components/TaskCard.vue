<script setup lang="ts">
import { computed } from 'vue'
import UiBadge from '@/components/ui/UiBadge.vue'
import type { Task } from '@/lib/types'
import { dueTone, formatDue } from '@/lib/format'

const props = defineProps<{ task: Task; dragging?: boolean }>()
const emit = defineEmits<{ open: [id: string]; dragstart: [e: DragEvent, id: string] }>()

const dueLabel = computed(() => formatDue(props.task.dueDate))
const tone = computed(() => dueTone(props.task.dueDate))
const shownLabels = computed(() => props.task.labels.slice(0, 3))
const extraLabels = computed(() => Math.max(0, props.task.labels.length - 3))
const excerpt = computed(() => {
  const noTitle = props.task.body.replace(/^#\s+.+$/m, '').trim()
  return noTitle.slice(0, 140)
})
</script>

<template>
  <article
    draggable="true"
    @dragstart="emit('dragstart', $event, task.id)"
    @click="emit('open', task.id)"
    :class="['group cursor-pointer rounded-lg border bg-card p-3 shadow-sm transition hover:shadow-md hover:border-primary/40', dragging && 'card-dragging']"
  >
    <div class="flex items-start justify-between gap-2">
      <h4 class="text-sm font-semibold leading-5">{{ task.title }}</h4>
      <UiBadge :variant="task.priority">{{ task.priority }}</UiBadge>
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
  </article>
</template>
