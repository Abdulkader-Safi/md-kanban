<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import 'katex/dist/katex.min.css'
import { outline, renderMarkdown, type RenderContext } from '@/lib/render'
import { readProjectAsset } from '@/stores/board'

const props = defineProps<{ source: string; ctx: RenderContext; project: string }>()
const emit = defineEmits<{ openTask: [id: string] }>()

const root = ref<HTMLDivElement>()
const html = ref('')
const items = computed(() => outline(html.value))

// Each render gets a number; a slower older one never overwrites a newer one.
let latest = 0
watch(
  () => [props.source, props.ctx] as const,
  async ([source, ctx]) => {
    const mine = ++latest
    const out = await renderMarkdown(source, ctx)
    if (mine === latest) html.value = out
  },
  { immediate: true },
)

watch(html, async () => {
  await nextTick()
  void loadImages()
  drawMermaid()
})

// --- images ----------------------------------------------------------------
// The renderer leaves project images as <img data-asset="a|b">: candidate
// paths, first match wins. Blob URLs are kept for the life of the preview so
// a re-render (every autosave) does not re-read the file.
const urls = new Map<string, Promise<string | null>>()
function assetUrl(path: string) {
  let url = urls.get(path)
  if (!url) {
    url = readProjectAsset(props.project, path).then((b) => (b ? URL.createObjectURL(b) : null))
    urls.set(path, url)
  }
  return url
}

async function loadImages() {
  for (const img of root.value?.querySelectorAll<HTMLImageElement>('img[data-asset]') ?? []) {
    let src: string | null = null
    for (const path of (img.dataset.asset ?? '').split('|')) {
      src = await assetUrl(path)
      if (src) break
    }
    if (!img.isConnected) return
    if (src) {
      img.src = src
      continue
    }
    const box = document.createElement('span')
    box.className = 'asset-missing'
    box.setAttribute('role', 'img')
    box.textContent = `Image not found: ${img.alt}`
    box.setAttribute('aria-label', box.textContent)
    img.replaceWith(box)
  }
}

// --- mermaid -----------------------------------------------------------------
// The library (large) loads only when a card has a diagram, runs in strict
// mode (labels sanitized, no click handlers), and redraws when the theme flips.
let drawn = 0
async function drawMermaid() {
  const boxes = [...(root.value?.querySelectorAll<HTMLElement>('.mermaid-diagram') ?? [])]
  if (!boxes.length) return
  for (const box of boxes) box.dataset.source ??= box.textContent ?? ''
  const mine = ++drawn
  const { default: mermaid } = await import('mermaid')
  if (mine !== drawn) return
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    // Our own message replaces a failed diagram; stop mermaid from also
    // appending its error graphic to <body>.
    suppressErrorRendering: true,
    theme: document.documentElement.classList.contains('dark') ? 'dark' : 'neutral',
    fontFamily: getComputedStyle(root.value ?? document.body).fontFamily,
  })
  for (const [i, box] of boxes.entries()) {
    const source = box.dataset.source ?? ''
    try {
      // parse throws on bad syntax without touching the DOM.
      await mermaid.parse(source)
      const { svg } = await mermaid.render(`mdk-mermaid-${i}-${Date.now()}`, source)
      if (mine !== drawn) return
      const scroll = document.createElement('div')
      scroll.className = 'mermaid-scroll'
      // Strict mode runs the SVG through DOMPurify before returning it.
      scroll.innerHTML = svg
      box.replaceChildren(scroll)
      box.dataset.state = 'drawn'
    } catch (e) {
      if (mine !== drawn) return
      // Show why it failed and the source, never an empty box.
      const why = document.createElement('p')
      why.className = 'mermaid-error'
      why.textContent = `Diagram could not be drawn: ${e instanceof Error ? e.message.split('\n')[0] : 'syntax error'}`
      const pre = document.createElement('pre')
      pre.textContent = source
      box.replaceChildren(why, pre)
      box.dataset.state = 'error'
    }
  }
}
const themeWatch = new MutationObserver(() => void drawMermaid())
themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })

// --- clicks ------------------------------------------------------------------
// Card links open the card, in-page anchors scroll the preview (never the
// window location), and copy buttons copy their block.
async function onClick(e: MouseEvent) {
  const el = e.target as HTMLElement
  const card = el.closest<HTMLAnchorElement>('a[data-task]')
  if (card) {
    e.preventDefault()
    emit('openTask', card.dataset.task!)
    return
  }
  const anchor = el.closest<HTMLAnchorElement>('a[href^="#"]')
  if (anchor) {
    e.preventDefault()
    const id = decodeURIComponent(anchor.getAttribute('href')!.slice(1))
    const target = root.value?.querySelector(`[id="${CSS.escape(id)}"], [id="${CSS.escape(`user-content-${id}`)}"]`)
    target?.scrollIntoView({ block: 'start', behavior: 'smooth' })
    return
  }
  const copy = el.closest<HTMLButtonElement>('button[data-copy]')
  if (copy) {
    const code = copy.closest('.code-block')?.querySelector('pre')?.textContent ?? ''
    try {
      await navigator.clipboard.writeText(code)
      copy.textContent = 'Copied'
      setTimeout(() => (copy.textContent = 'Copy'), 1500)
    } catch {
      // Clipboard blocked; leave the label alone rather than claim a copy.
    }
  }
}

onBeforeUnmount(async () => {
  latest = drawn = -1
  themeWatch.disconnect()
  for (const url of urls.values()) {
    const u = await url
    if (u) URL.revokeObjectURL(u)
  }
})
</script>

<template>
  <div ref="root" @click="onClick">
    <details v-if="items.length > 1" class="mb-3 border px-3 py-2 text-sm">
      <summary class="cursor-pointer text-xs font-medium text-muted-foreground">On this page</summary>
      <ul class="mt-2 space-y-1">
        <li v-for="it in items" :key="it.id" :class="it.depth === 3 && 'pl-4'">
          <a :href="`#${it.id}`" class="text-muted-foreground hover:text-foreground hover:underline">{{ it.text }}</a>
        </li>
      </ul>
    </details>
    <!-- html comes only from renderMarkdown, which sanitizes raw HTML before
         any of its own transforms (see src/lib/render.check.ts). -->
    <div class="prose-md" v-html="html" />
  </div>
</template>
