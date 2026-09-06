<script setup lang="ts">
import UiInput from '@/components/ui/UiInput.vue'
import UiBadge from '@/components/ui/UiBadge.vue'
import { allLabels, filters, resetFilters, togglePriorityFilter } from '@/stores/board'
import type { Priority } from '@/lib/types'

const priorities: Priority[] = ['critical', 'high', 'medium', 'low']
</script>

<template>
  <div class="flex flex-wrap items-center gap-2">
    <UiInput v-model="filters.query" placeholder="Search title, body, id, assignee, label..." cls="max-w-xs" />
    <div class="flex items-center gap-1">
      <button
        v-for="p in priorities"
        :key="p"
        @click="togglePriorityFilter(p)"
        :class="['rounded-full border px-2.5 py-1 text-xs font-medium transition', filters.priorities.includes(p) ? 'border-primary bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground']"
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
  </div>
</template>
