<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { tasks } from '@/stores/board'
import { DEFAULT_COLUMNS } from '@/lib/types'
import type { StatusId } from '@/lib/types'

const props = defineProps<{ open: boolean; openTaskId: string | null }>()
const emit = defineEmits<{
  close: []
  openTask: [id: string]
  createCard: [title: string]
  moveOpen: [status: StatusId]
}>()

const query = ref('')
const sel = ref(0)
const inputEl = ref<HTMLInputElement | null>(null)

watch(
  () => props.open,
  (o) => {
    if (!o) return
    query.value = ''
    sel.value = 0
    void nextTick(() => inputEl.value?.focus())
  },
)
watch(query, () => {
  sel.value = 0
})

const openTask = computed(() => tasks.value.find((t) => t.id === props.openTaskId) ?? null)

const matches = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return tasks.value.slice(0, 8)
  return tasks.value
    .filter((t) =>
      `${t.title} ${t.body} ${t.id} ${t.assignee} ${t.labels.join(' ')}`.toLowerCase().includes(q),
    )
    .slice(0, 8)
})

interface Item {
  key: string
  label: string
  hint: string
  run: () => void
}

const items = computed<Item[]>(() => {
  const q = query.value.trim()
  const ql = q.toLowerCase()
  const out: Item[] = matches.value.map((t) => ({
    key: `open-${t.id}`,
    label: t.title,
    hint: t.status,
    run: () => emit('openTask', t.id),
  }))
  if (q) {
    out.push({ key: 'create', label: `Create card "${q}"`, hint: 'new', run: () => emit('createCard', q) })
  }
  const cur = openTask.value
  if (cur) {
    for (const c of DEFAULT_COLUMNS) {
      if (c.id === cur.status) continue
      if (ql && !`${c.name} ${c.id}`.toLowerCase().includes(ql)) continue
      const sid: StatusId = c.id
      out.push({ key: `move-${sid}`, label: `Move open card to ${c.name}`, hint: sid, run: () => emit('moveOpen', sid) })
    }
  }
  return out
})

function onKey(e: KeyboardEvent) {
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    sel.value = items.value.length ? (sel.value + 1) % items.value.length : 0
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    sel.value = items.value.length ? (sel.value - 1 + items.value.length) % items.value.length : 0
  } else if (e.key === 'Enter') {
    e.preventDefault()
    items.value[Math.min(sel.value, items.value.length - 1)]?.run()
  } else if (e.key === 'Escape') {
    emit('close')
  }
}
</script>

<template>
  <div v-if="open" class="fixed inset-0 z-50 flex justify-center bg-black/40 px-4 pt-[12vh]" @mousedown.self="emit('close')">
    <div class="h-fit w-full max-w-lg rounded-lg border bg-background shadow-xl">
      <input
        ref="inputEl"
        v-model="query"
        @keydown="onKey"
        placeholder="Search cards, or type to create..."
        class="h-11 w-full rounded-t-lg border-b bg-transparent px-4 text-sm outline-none"
      />
      <div class="max-h-80 overflow-y-auto p-1">
        <button
          v-for="(it, i) in items"
          :key="it.key"
          @click="it.run()"
          @mousemove="sel = i"
          :class="['flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm', sel === i ? 'bg-accent text-accent-foreground' : 'text-foreground']"
        >
          <span class="min-w-0 flex-1 truncate">{{ it.label }}</span>
          <span class="shrink-0 font-mono text-[11px] text-muted-foreground">{{ it.hint }}</span>
        </button>
        <p v-if="!items.length" class="px-3 py-4 text-center text-sm text-muted-foreground">No matches</p>
      </div>
      <p class="border-t px-4 py-2 font-mono text-[11px] text-muted-foreground">↑↓ navigate · Enter run · Esc close</p>
    </div>
  </div>
</template>
