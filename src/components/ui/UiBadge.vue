<script setup lang="ts">
import { computed } from 'vue'
import { cva } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium leading-4 transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        outline: 'text-foreground',
        critical: 'border-transparent bg-red-500/15 text-red-600 dark:text-red-400',
        high: 'border-transparent bg-orange-500/15 text-orange-600 dark:text-orange-400',
        medium: 'border-transparent bg-blue-500/15 text-blue-600 dark:text-blue-400',
        low: 'border-transparent bg-slate-500/15 text-slate-600 dark:text-slate-400',
      },
    },
    defaultVariants: { variant: 'default' },
  },
)

const props = withDefaults(
  defineProps<{ variant?: 'default' | 'secondary' | 'outline' | 'critical' | 'high' | 'medium' | 'low' }>(),
  { variant: 'default' },
)
const cls = computed(() => cn(badgeVariants({ variant: props.variant })))
</script>

<template>
  <span :class="cls"><slot /></span>
</template>
