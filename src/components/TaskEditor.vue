<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { marked } from 'marked'
import { Bot, Trash2, X } from 'lucide-vue-next'
import UiButton from '@/components/ui/UiButton.vue'
import type { Priority, StatusId, Task } from '@/lib/types'
import { DEFAULT_COLUMNS } from '@/lib/types'
import { deleteTask, tasks, updateTask } from '@/stores/board'
import { stringifyTaskFile } from '@/lib/markdown'

const props = defineProps<{ taskId: string | null }>()
const emit = defineEmits<{ close: [] }>()

const task = computed(() => tasks.value.find((t) => t.id === props.taskId) ?? null)

const form = reactive({
  title: '',
  status: 'backlog' as StatusId,
  priority: 'medium' as Priority,
  assignee: '',
  dueDate: '',
  labels: '',
  body: '',
})

watch(
  () => task.value?.id ?? null,
  (id) => {
    const t = task.value
    if (!t || !id) return
    form.title = t.title
    form.status = t.status
    form.priority = t.priority
    form.assignee = t.assignee
    form.dueDate = t.dueDate ?? ''
    form.labels = t.labels.join(', ')
    form.body = t.body
  },
  { immediate: true },
)

/* Close only when press AND release both land on the backdrop, so
 * drag-selecting text out of the panel does not close the editor. */
const pressedOnBackdrop = ref(false)
function onBackdropDown(e: MouseEvent) {
  pressedOnBackdrop.value = e.target === e.currentTarget
}
function onBackdropUp(e: MouseEvent) {
  if (e.target === e.currentTarget && pressedOnBackdrop.value) emit('close')
  pressedOnBackdrop.value = false
}

const previewHtml = computed(() => marked.parse(form.body || '') as string)

let saveTimer: ReturnType<typeof setTimeout> | undefined
function autosave() {
  if (!task.value) return
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    void updateTask(task.value!.id, {
      title: form.title,
      status: form.status,
      priority: form.priority,
      assignee: form.assignee,
      dueDate: form.dueDate || null,
      labels: form.labels.split(',').map((s) => s.trim()).filter(Boolean),
      body: form.body,
    } satisfies Partial<Task>)
  }, 500)
}

function copyAIPrompt() {
  if (!task.value) return
  const t = task.value
  const prompt = `Work on this kanban task.\n\nFile: ${t.project}/${t.relPath}\nTitle: ${t.title}\nStatus: ${t.status}\nPriority: ${t.priority}\nAssignee: ${t.assignee || 'unassigned'}\nLabels: ${t.labels.join(', ') || 'none'}\n\n${t.body}\n\nRules: read the file, implement the work, then update the same markdown file (move status, update body checkboxes). Keep YAML frontmatter keys intact.`
  void navigator.clipboard.writeText(prompt)
}

async function onDelete() {
  if (!task.value) return
  if (!confirm(`Delete "${task.value.title}"? This removes the markdown file.`)) return
  await deleteTask(task.value.id)
  emit('close')
}

function rawPreview(): string {
  if (!task.value) return ''
  return stringifyTaskFile({ ...task.value, title: form.title, body: form.body })
}
</script>

<template>
  <div v-if="task" class="fixed inset-0 z-40 flex justify-end bg-black/30" @mousedown="onBackdropDown" @click="onBackdropUp">
    <div class="flex h-full w-full max-w-2xl flex-col border-l bg-background shadow-xl">
      <header class="flex items-center gap-2 border-b p-3">
        <div class="min-w-0">
          <div class="truncate font-mono text-[11px] text-muted-foreground">{{ task.project }}/{{ task.relPath }}</div>
          <input v-model="form.title" @input="autosave" class="w-full bg-transparent text-lg font-bold outline-none" />
        </div>
        <UiButton variant="ghost" size="icon" @click="emit('close')" class="ml-auto"><X class="h-4 w-4" /></UiButton>
      </header>

      <div class="grid grid-cols-2 gap-2 border-b p-3 text-xs sm:grid-cols-4">
        <label class="flex flex-col gap-1">Status
          <select v-model="form.status" @change="autosave" class="h-8 rounded-md border bg-background px-1">
            <option v-for="c in DEFAULT_COLUMNS" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
        </label>
        <label class="flex flex-col gap-1">Priority
          <select v-model="form.priority" @change="autosave" class="h-8 rounded-md border bg-background px-1">
            <option value="critical">critical</option>
            <option value="high">high</option>
            <option value="medium">medium</option>
            <option value="low">low</option>
          </select>
        </label>
        <label class="flex flex-col gap-1">Assignee
          <input v-model="form.assignee" @input="autosave" class="h-8 rounded-md border bg-background px-2" placeholder="name" />
        </label>
        <label class="flex flex-col gap-1">Due date
          <input v-model="form.dueDate" @change="autosave" type="date" class="h-8 rounded-md border bg-background px-2" />
        </label>
        <label class="col-span-2 flex flex-col gap-1 sm:col-span-4">Labels (comma separated)
          <input v-model="form.labels" @input="autosave" class="h-8 rounded-md border bg-background px-2" placeholder="feature, ui" />
        </label>
      </div>

      <div class="grid flex-1 grid-cols-1 gap-0 overflow-hidden sm:grid-cols-2">
        <textarea v-model="form.body" @input="autosave" spellcheck="false" class="board-scroll min-h-[240px] flex-1 resize-none border-r bg-background p-3 font-mono text-[13px] leading-6 outline-none" />
        <div class="board-scroll prose-md hidden overflow-y-auto p-4 sm:block" v-html="previewHtml" />
      </div>

      <footer class="flex items-center gap-2 border-t p-3">
        <UiButton variant="outline" size="sm" @click="copyAIPrompt"><Bot class="h-4 w-4" /> Copy AI prompt</UiButton>
        <span class="text-[11px] text-muted-foreground">Autosaves to the markdown file.</span>
        <UiButton variant="destructive" size="sm" @click="onDelete" class="ml-auto"><Trash2 class="h-4 w-4" /> Delete</UiButton>
      </footer>
      <details class="border-t p-3">
        <summary class="cursor-pointer text-xs text-muted-foreground">Raw markdown file</summary>
        <pre class="board-scroll mt-2 max-h-48 overflow-auto rounded bg-muted p-2 font-mono text-[11px]">{{ rawPreview() }}</pre>
      </details>
    </div>
  </div>
</template>
