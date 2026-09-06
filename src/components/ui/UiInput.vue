<script setup lang="ts">
import { cn } from '@/lib/utils'
const model = defineModel<string>({ default: '' })
defineProps<{ placeholder?: string; type?: string; cls?: string }>()
</script>

<template>
  <input
    v-model="model"
    :type="type ?? 'text'"
    :placeholder="placeholder"
    :class="cn('flex h-9 w-full rounded-md border border-border bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40', cls)"
  />
</template>
