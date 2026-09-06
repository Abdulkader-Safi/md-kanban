<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import UiButton from '@/components/ui/UiButton.vue'
import type { Priority, StatusId } from '@/lib/types'
import { createTask, useBoard } from '@/stores/board'

const props = defineProps<{ open: boolean; status: StatusId; workspaceHint: string }>()
const emit = defineEmits<{ close: [] }>()

const { selectedWorkspace } = useBoard()
const pressedOnBackdrop = ref(false)
function onBackdropDown(e: MouseEvent) {
  pressedOnBackdrop.value = e.target === e.currentTarget
}
function onBackdropUp(e: MouseEvent) {
  if (e.target === e.currentTarget && pressedOnBackdrop.value) emit('close')
  pressedOnBackdrop.value = false
}
const form = reactive({
  title: '',
  body: '',
  status: 'backlog' as StatusId,
  priority: 'medium' as Priority,
  assignee: '',
  dueDate: '',
  labels: '',
  workspace: '',
})

watch(
  () => props.open,
  (o) => {
    if (o) {
      form.title = ''
      form.body = ''
      form.status = props.status
      form.priority = 'medium'
      form.assignee = ''
      form.dueDate = ''
      form.labels = ''
      form.workspace = selectedWorkspace.value === 'all' ? props.workspaceHint : selectedWorkspace.value
    }
  },
)

async function submit() {
  if (!form.title.trim()) return
  await createTask(
    {
      title: form.title.trim(),
      body: form.body || `# ${form.title.trim()}\n`,
      status: form.status,
      priority: form.priority,
      assignee: form.assignee.trim(),
      dueDate: form.dueDate || null,
      labels: form.labels.split(',').map((s) => s.trim()).filter(Boolean),
    },
    form.workspace.trim(),
  )
  emit('close')
}
</script>

<template>
  <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" @mousedown="onBackdropDown" @click="onBackdropUp">
    <form @submit.prevent="submit" class="w-full max-w-lg rounded-lg border bg-background p-4 shadow-xl">
      <h3 class="text-base font-bold">New card</h3>
      <p class="mb-3 font-mono text-[11px] text-muted-foreground">Creates a markdown file with YAML frontmatter.</p>
      <input v-model="form.title" placeholder="Card title" class="mb-2 h-9 w-full rounded-md border bg-background px-3 text-sm" required />
      <textarea v-model="form.body" placeholder="Description (markdown)..." rows="4" class="mb-2 w-full rounded-md border bg-background p-2 font-mono text-[13px]" />
      <div class="grid grid-cols-2 gap-2 text-xs">
        <label class="flex flex-col gap-1">Status
          <select v-model="form.status" class="h-8 rounded-md border bg-background px-1">
            <option value="backlog">Backlog</option>
            <option value="todo">To Do</option>
            <option value="in-progress">In Progress</option>
            <option value="review">Review</option>
            <option value="done">Done</option>
          </select>
        </label>
        <label class="flex flex-col gap-1">Priority
          <select v-model="form.priority" class="h-8 rounded-md border bg-background px-1">
            <option value="critical">critical</option>
            <option value="high">high</option>
            <option value="medium">medium</option>
            <option value="low">low</option>
          </select>
        </label>
        <label class="flex flex-col gap-1">Assignee
          <input v-model="form.assignee" class="h-8 rounded-md border bg-background px-2" placeholder="name" />
        </label>
        <label class="flex flex-col gap-1">Due date
          <input v-model="form.dueDate" type="date" class="h-8 rounded-md border bg-background px-2" />
        </label>
        <label class="flex flex-col gap-1">Labels
          <input v-model="form.labels" class="h-8 rounded-md border bg-background px-2" placeholder="feature, ui" />
        </label>
        <label class="flex flex-col gap-1">Work subfolder
          <input v-model="form.workspace" class="h-8 rounded-md border bg-background px-2 font-mono" placeholder="auth (optional)" />
        </label>
      </div>
      <div class="mt-3 flex justify-end gap-2">
        <UiButton variant="ghost" size="sm" @click="emit('close')">Cancel</UiButton>
        <UiButton type="submit" size="sm">Create card</UiButton>
      </div>
      <p class="mt-1 text-[11px] text-muted-foreground">Tip: press N anywhere to create a card.</p>
    </form>
  </div>
</template>
