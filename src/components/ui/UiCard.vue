<script setup lang="ts">
import { cn } from '@/lib/utils'
defineProps<{ cls?: string }>()
</script>

<template>
  <div :class="cn('rounded-lg border bg-card text-card-foreground shadow-sm', cls)"><slot /></div>
</template>
