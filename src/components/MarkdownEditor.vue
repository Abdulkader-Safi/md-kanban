<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch, type Component } from 'vue'
import { Compartment, EditorState } from '@codemirror/state'
import { drawSelection, EditorView, highlightActiveLine, keymap, placeholder } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search'
import { tags as t } from '@lezer/highlight'
import { vim, Vim } from '@replit/codemirror-vim'
import {
  IconBinaryTree, IconBlockquote, IconBold, IconCode, IconH1, IconH2, IconH3, IconHighlight, IconInfoSquareRounded,
  IconItalic, IconLink, IconList, IconListCheck, IconListNumbers, IconMathFunction, IconPhoto, IconSeparatorHorizontal,
  IconSourceCode, IconStrikethrough, IconTable,
} from '@tabler/icons-vue'
import {
  callout, codeBlock, heading, link, mathBlock, mermaid, rule, table, toggleList, wrap, type MdCommand,
} from '@/lib/md-commands'
import { vimKeys } from '@/stores/board'

const props = defineProps<{ modelValue: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const host = ref<HTMLDivElement>()
let view: EditorView | null = null

const bold = wrap('**')
const italic = wrap('_')
const code = wrap('`', '`', 'code')

interface Tool { icon: Component; label: string; cmd: MdCommand; gap?: boolean }
const isMac = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform)
const mod = isMac ? '⌘' : 'Ctrl+'
const tools: Tool[] = [
  { icon: IconH1, label: 'Heading 1', cmd: heading(1) },
  { icon: IconH2, label: 'Heading 2', cmd: heading(2) },
  { icon: IconH3, label: 'Heading 3', cmd: heading(3) },
  { icon: IconBold, label: `Bold (${mod}B)`, cmd: bold, gap: true },
  { icon: IconItalic, label: `Italic (${mod}I)`, cmd: italic },
  { icon: IconStrikethrough, label: 'Strikethrough', cmd: wrap('~~') },
  { icon: IconHighlight, label: 'Highlight', cmd: wrap('==') },
  { icon: IconCode, label: `Inline code (${mod}E)`, cmd: code },
  { icon: IconLink, label: 'Link', cmd: link(), gap: true },
  { icon: IconPhoto, label: 'Image', cmd: link(true) },
  { icon: IconList, label: 'Bulleted list', cmd: toggleList('bullet'), gap: true },
  { icon: IconListNumbers, label: 'Numbered list', cmd: toggleList('ordered') },
  { icon: IconListCheck, label: 'Checklist', cmd: toggleList('task') },
  { icon: IconBlockquote, label: 'Quote', cmd: toggleList('quote') },
  { icon: IconSourceCode, label: 'Code block', cmd: codeBlock, gap: true },
  { icon: IconTable, label: 'Table', cmd: table },
  { icon: IconInfoSquareRounded, label: 'Callout', cmd: callout },
  { icon: IconMathFunction, label: 'Math block', cmd: mathBlock },
  { icon: IconBinaryTree, label: 'Mermaid diagram', cmd: mermaid },
  { icon: IconSeparatorHorizontal, label: 'Divider', cmd: rule },
]

/* Vim keys, for this editor only, switched from the sidebar. The app's own
 * shortcuts skip keys the editor handles, so Escape never closes the card
 * while Vim is on (the X or a click outside does). */
const vimMode = new Compartment()
// Escape in normal mode is swallowed too: tapping it twice out of habit
// must not close the card.
const vimExt = () => (vimKeys.value ? [vim({ status: true }), keymap.of([{ key: 'Escape', run: () => true }])] : [])
// ponytail: cards autosave, so :w only has to be a known command.
Vim.defineEx('write', 'w', () => {})
watch(vimKeys, () => view?.dispatch({ effects: vimMode.reconfigure(vimExt()) }))

function apply(cmd: MdCommand) {
  if (!view) return
  view.dispatch(cmd(view.state))
  view.focus()
}
const bind = (cmd: MdCommand) => (v: EditorView) => {
  v.dispatch(cmd(v.state))
  return true
}

// Colours come from the app's CSS variables, so light and dark follow the
// theme toggle with no editor reconfigure.
const theme = EditorView.theme({
  '&': { height: '100%', fontSize: '13px', color: 'var(--foreground)', backgroundColor: 'var(--background)' },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', lineHeight: '1.7' },
  '.cm-content': { padding: '12px', caretColor: 'var(--foreground)' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--foreground)' },
  '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
    backgroundColor: 'var(--md-selection)',
  },
  '.cm-activeLine': { backgroundColor: 'var(--md-active-line)' },
  '.cm-selectionMatch': { backgroundColor: 'var(--md-selection)' },
  '.cm-panels': { backgroundColor: 'var(--muted)', color: 'var(--foreground)' },
  '.cm-panels.cm-panels-bottom': { borderTop: '1px solid var(--border)' },
  '.cm-textfield': { backgroundColor: 'var(--background)', border: '1px solid var(--border)', color: 'var(--foreground)' },
  '.cm-button': { backgroundImage: 'none', backgroundColor: 'var(--background)', border: '1px solid var(--border)', color: 'var(--foreground)' },
  '.cm-placeholder': { color: 'var(--muted-foreground)' },
  '.cm-fat-cursor': { backgroundColor: 'var(--md-link) !important', color: 'var(--background) !important' },
  '&:not(.cm-focused) .cm-fat-cursor': { backgroundColor: 'transparent !important', outline: '1px solid var(--md-link)' },
  '.cm-vim-panel': { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '12px', padding: '2px 12px' },
  '.cm-vim-panel input': { color: 'var(--foreground)' },
})

const highlight = HighlightStyle.define([
  { tag: t.heading1, fontWeight: '700', fontSize: '1.3em' },
  { tag: t.heading2, fontWeight: '700', fontSize: '1.15em' },
  { tag: [t.heading3, t.heading4, t.heading5, t.heading6], fontWeight: '700' },
  { tag: t.strong, fontWeight: '700' },
  { tag: t.emphasis, fontStyle: 'italic' },
  { tag: t.strikethrough, textDecoration: 'line-through' },
  { tag: [t.link, t.url], color: 'var(--md-link)' },
  { tag: t.monospace, color: 'var(--md-code)' },
  { tag: t.quote, color: 'var(--muted-foreground)' },
  // #, **, -, > and other markup marks recede.
  { tag: [t.processingInstruction, t.meta, t.contentSeparator, t.labelName], color: 'var(--muted-foreground)' },
  // Code inside fences.
  { tag: [t.keyword, t.operatorKeyword, t.modifier], color: 'var(--md-syn-keyword)' },
  { tag: [t.string, t.special(t.string), t.regexp], color: 'var(--md-syn-string)' },
  { tag: [t.number, t.bool, t.atom, t.null], color: 'var(--md-syn-number)' },
  { tag: [t.comment, t.lineComment, t.blockComment], color: 'var(--muted-foreground)', fontStyle: 'italic' },
  { tag: [t.function(t.variableName), t.function(t.propertyName), t.typeName, t.className, t.tagName], color: 'var(--md-syn-name)' },
  { tag: [t.propertyName, t.attributeName], color: 'var(--md-syn-prop)' },
])

onMounted(() => {
  view = new EditorView({
    parent: host.value!,
    state: EditorState.create({
      doc: props.modelValue,
      extensions: [
        // First, so Vim sees keys before the other keymaps.
        vimMode.of(vimExt()),
        history(),
        drawSelection(),
        highlightActiveLine(),
        highlightSelectionMatches(),
        EditorView.lineWrapping,
        // GFM, plus grammars for fenced code, loaded when a fence names them.
        // Enter continues lists and quotes (markdown's own keymap).
        markdown({ base: markdownLanguage, codeLanguages: languages }),
        syntaxHighlighting(highlight),
        placeholder('Write markdown...'),
        keymap.of([
          { key: 'Mod-b', run: bind(bold) },
          { key: 'Mod-i', run: bind(italic) },
          { key: 'Mod-e', run: bind(code) },
          ...defaultKeymap,
          ...historyKeymap,
          ...searchKeymap,
          // Tab indents list items. Escape, then Tab, still leaves the editor.
          indentWithTab,
        ]),
        theme,
        EditorView.contentAttributes.of({ 'aria-label': 'Card markdown', spellcheck: 'true' }),
        EditorView.updateListener.of((u) => {
          if (u.docChanged) emit('update:modelValue', u.state.doc.toString())
        }),
      ],
    }),
  })
})

// Outside changes (another card opened, a subtask ticked in the preview)
// replace the document; our own edits already match and are skipped.
watch(
  () => props.modelValue,
  (v) => {
    if (view && v !== view.state.doc.toString()) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: v } })
    }
  },
)

onBeforeUnmount(() => view?.destroy())
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <div role="toolbar" aria-label="Formatting" class="flex flex-wrap items-center gap-0.5 border-b px-2 py-1">
      <template v-for="tool in tools" :key="tool.label">
        <span v-if="tool.gap" class="mx-0.5 h-4 w-px bg-border" aria-hidden="true" />
        <button
          type="button"
          :title="tool.label"
          :aria-label="tool.label"
          class="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          @mousedown.prevent
          @click="apply(tool.cmd)"
        >
          <component :is="tool.icon" class="h-4 w-4" :stroke-width="1.75" />
        </button>
      </template>
    </div>
    <div ref="host" class="board-scroll min-h-[240px] flex-1 overflow-hidden" />
  </div>
</template>
