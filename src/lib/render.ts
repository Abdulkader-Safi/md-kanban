/* Markdown preview pipeline, ported from GitBasedDocs
 * (dashboard/lib/render/markdown.ts) and run in the renderer instead of on a
 * server. Links resolve to other cards in the same project; images come out
 * of the project folder (MarkdownPreview.vue loads them). */

import type { Element, ElementContent, Root, Text } from 'hast'
import type { Root as MdRoot, RootContent as MdNode } from 'mdast'
import rehypeAutolinkHeadings from 'rehype-autolink-headings'
import rehypeKatex from 'rehype-katex'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import rehypeSlug from 'rehype-slug'
import rehypeStringify from 'rehype-stringify'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import rehypeShiki from '@shikijs/rehype'
import { transformerMetaHighlight, transformerNotationDiff, transformerNotationHighlight } from '@shikijs/transformers'
import type { ShikiTransformer } from 'shiki'
import { unified } from 'unified'
import { SKIP, visit } from 'unist-util-visit'
import { stripComments } from './comments'

export interface RenderTask {
  id: string
  title: string
  /** Path inside the project, e.g. "auth/login-2026-09-06.md". */
  relPath: string
}

export interface RenderContext {
  /** relPath of the card being rendered. */
  pagePath: string
  /** Every card in the same project, for relative links and wikilinks. */
  tasks: RenderTask[]
}

const MD = /\.md$/i
const IMAGE = /\.(png|jpe?g|gif|webp|avif|svg|bmp|ico)$/i

// Tiny posix path helpers; node:path is not in the browser.
function normalize(p: string): string {
  const out: string[] = []
  for (const part of p.split('/')) {
    if (!part || part === '.') continue
    if (part === '..' && out.length && out[out.length - 1] !== '..') out.pop()
    else out.push(part)
  }
  return out.join('/')
}
const dirname = (p: string) => (p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '')
const basename = (p: string) => p.slice(p.lastIndexOf('/') + 1)

// A stray % in a link would make decodeURI throw and take the whole render
// down with it. Fall back to the raw text instead.
function safeDecode(s: string) {
  try {
    return decodeURI(s)
  } catch {
    return s
  }
}

function isExternal(href: string) {
  return /^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith('//')
}

// What a reader sees instead of a broken image: the name, in a box.
function missingImage(name: string): Element {
  return {
    type: 'element',
    tagName: 'span',
    properties: { className: ['asset-missing'], role: 'img', ariaLabel: `Image not found: ${name}` },
    children: [{ type: 'text', value: `Image not found: ${name}` }],
  }
}

function taskLink(task: RenderTask, label: string): Element {
  return {
    type: 'element',
    tagName: 'a',
    properties: { href: '#', dataTask: task.id, className: ['wikilink'], title: task.title },
    children: [{ type: 'text', value: label }],
  }
}

// ---------------------------------------------------------------------------
// remark-math would read "costs $5 a month, or $50" as a formula. Obsidian
// and Pandoc do not: inline math cannot start or end with a space, and the
// closing $ cannot be followed by a digit. Matches that break the rule go
// back to plain text.
function remarkDollarGuard() {
  return (tree: MdRoot, file: { value: unknown }) => {
    const src = String(file.value)
    visit(tree, 'inlineMath', (node: MdNode & { value: string }, index, parent) => {
      const start = node.position?.start.offset
      const end = node.position?.end.offset
      if (!parent || index === undefined || start === undefined || end === undefined) return
      if (/^\s|\s$/.test(node.value) || /\d/.test(src[end] ?? '')) {
        parent.children[index] = { type: 'text', value: src.slice(start, end) } as MdNode
      }
    })
  }
}

// ---------------------------------------------------------------------------
// Relative links and images. A link to another card opens that card; a link
// that climbs out of the project loses its href. Images get their project
// path in data-asset and no src: the preview reads the file and fills it in.
function rehypeLinks(ctx: RenderContext) {
  const byPath = new Map(ctx.tasks.map((t) => [t.relPath, t]))
  const dir = dirname(ctx.pagePath)
  const resolve = (href: string) => normalize(href.startsWith('/') ? href : `${dir}/${safeDecode(href)}`)

  return (tree: Root) => {
    visit(tree, 'element', (node: Element, index, parent) => {
      if (node.tagName === 'a' && typeof node.properties.href === 'string') {
        const href = node.properties.href
        if (href.startsWith('#') || node.properties.dataTask) return
        if (isExternal(href)) {
          node.properties.target = '_blank'
          node.properties.rel = ['noreferrer', 'noopener']
          return
        }
        const resolved = resolve(href.split('#')[0] ?? '')
        const task = byPath.get(resolved) ?? byPath.get(`${resolved}.md`)
        if (task) {
          node.properties.href = '#'
          node.properties.dataTask = task.id
        } else {
          // Nothing in the project to open; never navigate the app away.
          delete node.properties.href
          node.properties.className = ['wikilink-unresolved']
          node.properties.title = 'Not a card in this project'
        }
        return
      }

      if (node.tagName === 'img' && typeof node.properties.src === 'string') {
        const src = node.properties.src
        if (isExternal(src)) return
        const resolved = resolve(src)
        const alt = typeof node.properties.alt === 'string' && node.properties.alt ? node.properties.alt : basename(resolved)
        if (resolved.startsWith('..') && parent && index !== undefined) {
          parent.children[index] = missingImage(alt)
          return SKIP
        }
        delete node.properties.src
        node.properties.dataAsset = resolved
        node.properties.alt = alt
      }
    })
  }
}

// ---------------------------------------------------------------------------
// Obsidian wikilinks: [[card]], [[card|label]], [[card#Heading]], plus embeds
// ![[image.png]] and ![[image.png|300]]. A card matches by file name, path,
// id or title. Runs after sanitize on text nodes, and never inside code.
// Mermaid source (A[[sub]] --> B ==> C) and KaTeX output are not prose.
function isOpaque(node: Element) {
  const cls = node.properties.className
  return Array.isArray(cls) && (cls.includes('mermaid-diagram') || cls.includes('katex'))
}

const WIKILINK = /(!?)\[\[([^\]|#]+)(#[^\]|]+)?(?:\|([^\]]+))?\]\]/g

function rehypeWikiLinks(ctx: RenderContext) {
  const byName = new Map<string, RenderTask>()
  for (const t of ctx.tasks) {
    for (const key of [t.title, t.id, basename(t.relPath).replace(MD, ''), t.relPath.replace(MD, '')]) {
      const k = key.toLowerCase()
      if (k && !byName.has(k)) byName.set(k, t)
    }
  }
  const dir = dirname(ctx.pagePath)

  return (tree: Root) => {
    visit(tree, 'element', (node: Element) => {
      if (node.tagName === 'code' || node.tagName === 'pre' || node.tagName === 'a' || isOpaque(node)) return SKIP
      // Adjacent text nodes can split a [[link]]; merge them first.
      const merged: ElementContent[] = []
      for (const child of node.children) {
        const last = merged[merged.length - 1]
        if (child.type === 'text' && last?.type === 'text') last.value += child.value
        else merged.push(child)
      }
      node.children = merged.flatMap((child) => (child.type === 'text' ? splitWikiLinks(child, byName, dir) : [child]))
    })
  }
}

function splitWikiLinks(text: Text, byName: Map<string, RenderTask>, dir: string): ElementContent[] {
  const out: ElementContent[] = []
  let last = 0
  for (const m of text.value.matchAll(WIKILINK)) {
    const start = m.index ?? 0
    if (start > last) out.push({ type: 'text', value: text.value.slice(last, start) })
    const embed = m[1] === '!'
    const target = (m[2] ?? '').trim()
    const heading = m[3]?.slice(1).trim()
    const alias = m[4]?.trim()
    last = start + m[0].length

    // ![[diagram.png]] and ![[diagram.png|300]] or |300x200 for a size.
    // Obsidian paths are vault relative; try the project root first, then
    // next to this card. The preview takes the first one that loads.
    if (embed && IMAGE.test(target)) {
      if (normalize(target).startsWith('..')) {
        out.push(missingImage(basename(target)))
        continue
      }
      const candidates = [...new Set([normalize(target), normalize(`${dir}/${target}`)])]
      const size = alias?.match(/^(\d+)(?:x(\d+))?$/)
      const properties: Element['properties'] = {
        dataAsset: candidates.join('|'),
        alt: size || !alias ? basename(target) : alias,
      }
      if (size) {
        properties.width = Number(size[1])
        if (size[2]) properties.height = Number(size[2])
      }
      out.push({ type: 'element', tagName: 'img', properties, children: [] })
      continue
    }

    // A card embed (![[Other card]]) links to the card; we do not transclude.
    const label = (alias ?? `${target}${heading ? ` > ${heading}` : ''}`).trim()
    const task = byName.get(target.toLowerCase())
    if (task) {
      out.push(taskLink(task, label))
    } else {
      // Obsidian shows links to notes that do not exist yet dimmed.
      out.push({
        type: 'element',
        tagName: 'span',
        properties: { className: ['wikilink', 'wikilink-unresolved'], title: 'No card with this name yet' },
        children: [{ type: 'text', value: label }],
      })
    }
  }
  if (!out.length) return [text]
  if (last < text.value.length) out.push({ type: 'text', value: text.value.slice(last) })
  return out
}

// ---------------------------------------------------------------------------
// Callouts, GitHub and Obsidian style:
//   > [!NOTE]                      GitHub's five
//   > [!tip] Before you start      Obsidian type with a custom title
//   > [!faq]- Folded question      "-" starts closed, "+" starts open
// Every Obsidian type and alias maps to one of five looks. An unknown type
// becomes a note rather than leaving "[!type]" on the page.
type CalloutTone = 'note' | 'tip' | 'warning' | 'danger' | 'quote'
const CALLOUT_TONES: Record<string, CalloutTone> = {}
for (const [tone, names] of Object.entries({
  note: 'note info todo abstract summary tldr important',
  tip: 'tip hint success check done',
  warning: 'warning caution attention question help faq',
  danger: 'danger error failure fail missing bug',
  quote: 'quote cite example',
}) as [CalloutTone, string][]) {
  for (const name of names.split(' ')) CALLOUT_TONES[name] = tone
}

const CALLOUT_MARK = /^\s*\[!([\w-]+)\]([+-]?)[ \t]*([^\n]*)\n?/

function rehypeCallouts() {
  return (tree: Root) => {
    visit(tree, 'element', (node: Element) => {
      if (node.tagName !== 'blockquote') return
      const firstP = node.children.find((c): c is Element => c.type === 'element' && c.tagName === 'p')
      const firstText = firstP?.children[0]
      if (!firstP || firstText?.type !== 'text') return
      const m = firstText.value.match(CALLOUT_MARK)
      if (!m) return
      const type = (m[1] ?? '').toLowerCase()
      const tone = CALLOUT_TONES[type] ?? 'note'
      const fold = m[2]
      // ponytail: the title is the plain text after the marker on its line;
      // a title that starts with bold or a link lands in the body instead.
      const title = (m[3] ?? '').trim()

      firstText.value = firstText.value.slice(m[0].length)
      if (!firstText.value) {
        firstP.children.shift()
        const next = firstP.children[0]
        if (next?.type === 'element' && next.tagName === 'br') firstP.children.shift()
      }
      const body = node.children.filter((c) => !(c === firstP && firstP.children.length === 0))
      const label: Element = {
        type: 'element',
        tagName: fold ? 'summary' : 'div',
        properties: { className: title ? ['callout-label', 'callout-title'] : ['callout-label'] },
        children: [{ type: 'text', value: title || type.toUpperCase() }],
      }
      node.tagName = fold ? 'details' : 'div'
      node.properties = {
        className: ['callout', `callout-${tone}`],
        ...(fold ? {} : { role: 'note' }),
        ...(fold === '+' ? { open: true } : {}),
      }
      node.children = [label, { type: 'element', tagName: 'div', properties: { className: ['callout-body'] }, children: body }]
    })
  }
}

// ---------------------------------------------------------------------------
// Tables sit in a scroll box so a wide one scrolls on a narrow panel while a
// narrow one still fills the column.
function rehypeTableWrap() {
  return (tree: Root) => {
    visit(tree, 'element', (node: Element, index, parent) => {
      if (node.tagName !== 'table' || !parent || index === undefined) return
      parent.children[index] = { type: 'element', tagName: 'div', properties: { className: ['table-wrap'] }, children: [node] }
      return SKIP
    })
  }
}

// ---------------------------------------------------------------------------
// ==highlight== (Obsidian) becomes <mark>. The text right inside the == must
// not be a space, so "if a == b and c == d" in prose stays as it is. Never
// inside code, and only within one text node.
const HIGHLIGHT = /==(\S(?:[^\n]*?\S)?)==/g

function rehypeHighlights() {
  return (tree: Root) => {
    visit(tree, 'element', (node: Element) => {
      if (['code', 'pre', 'kbd', 'script', 'style'].includes(node.tagName) || isOpaque(node)) return SKIP
      node.children = node.children.flatMap((child): ElementContent[] => {
        if (child.type !== 'text' || !child.value.includes('==')) return [child]
        const out: ElementContent[] = []
        let last = 0
        for (const m of child.value.matchAll(HIGHLIGHT)) {
          const at = m.index ?? 0
          if (at > last) out.push({ type: 'text', value: child.value.slice(last, at) })
          out.push({ type: 'element', tagName: 'mark', properties: {}, children: [{ type: 'text', value: m[1] ?? '' }] })
          last = at + m[0].length
        }
        if (!out.length) return [child]
        if (last < child.value.length) out.push({ type: 'text', value: child.value.slice(last) })
        return out
      })
    })
  }
}

// ---------------------------------------------------------------------------
// ```mermaid fences become a diagram box holding the source as text. The
// preview draws it (MarkdownPreview.vue); until then the reader sees the
// source. Runs before Shiki so it is not highlighted.
function rehypeMermaid() {
  return (tree: Root) => {
    visit(tree, 'element', (node: Element, index, parent) => {
      if (node.tagName !== 'pre' || !parent || index === undefined) return
      const code = node.children[0]
      if (code?.type !== 'element' || code.tagName !== 'code') return
      const classes = (code.properties.className as string[] | undefined) ?? []
      if (!classes.includes('language-mermaid')) return
      const source = code.children.map((c) => (c.type === 'text' ? c.value : '')).join('')
      parent.children[index] = {
        type: 'element',
        tagName: 'div',
        properties: { className: ['mermaid-diagram'], role: 'img', ariaLabel: 'Diagram' },
        children: [{ type: 'text', value: source }],
      }
      return SKIP
    })
  }
}

// ---------------------------------------------------------------------------
// Shiki: VS Code grammars. A grammar loads the first time a card uses its
// language; an unknown fence language falls back to plain text.
// `title="lib/auth.ts"` in the fence meta becomes the code head label. The
// theme's inline colours come off the <pre> so it sits on our own surface.
const codeFrame: ShikiTransformer = {
  name: 'mdk:frame',
  pre(node) {
    const title = (this.options.meta as { title?: string } | undefined)?.title
    if (title) node.properties.dataTitle = title
    delete node.properties.style
  },
}

const shikiOptions = {
  theme: 'github-dark-default',
  langs: [],
  lazy: true,
  defaultLanguage: 'text',
  fallbackLanguage: 'text',
  addLanguageClass: true,
  parseMetaString: (meta: string) => {
    const title = meta.match(/title="([^"]*)"/)?.[1]
    return title ? { title } : {}
  },
  transformers: [transformerNotationDiff(), transformerNotationHighlight(), transformerMetaHighlight(), codeFrame],
}

// ---------------------------------------------------------------------------
// Fenced code: dark block with the language (or title) label and a copy
// button. The button is inert HTML; the preview wires it up.
function rehypeCodeBlocks() {
  return (tree: Root) => {
    visit(tree, 'element', (node: Element, index, parent) => {
      if (node.tagName !== 'pre' || !parent || index === undefined) return
      const code = node.children.find((c): c is Element => c.type === 'element' && c.tagName === 'code')
      // remark-rehype gives className as an array; Shiki writes `class` as a string.
      const raw = code?.properties.className ?? code?.properties.class
      const classes = Array.isArray(raw) ? raw.map(String) : typeof raw === 'string' ? raw.split(' ') : []
      const title = typeof node.properties.dataTitle === 'string' ? node.properties.dataTitle : ''
      delete node.properties.dataTitle
      const lang = title || (classes.find((c) => c.startsWith('language-'))?.slice('language-'.length) ?? 'text')

      parent.children[index] = {
        type: 'element',
        tagName: 'div',
        properties: { className: ['code-block'] },
        children: [
          {
            type: 'element',
            tagName: 'div',
            properties: { className: ['code-head'] },
            children: [
              { type: 'element', tagName: 'span', properties: { className: ['code-lang'] }, children: [{ type: 'text', value: lang }] },
              { type: 'element', tagName: 'button', properties: { type: 'button', className: ['code-copy'], dataCopy: '' }, children: [{ type: 'text', value: 'Copy' }] },
            ],
          },
          node,
        ],
      }
      return SKIP
    })
  }
}

// ---------------------------------------------------------------------------
// rehype-raw rebuilds the tree and drops `data`, which is where a fence's
// meta (title="..." {2}) lives. Park it in an attribute across raw and
// sanitize (which allows exactly that one on <code>), then put it back.
function rehypeParkMeta() {
  return (tree: Root) => {
    visit(tree, 'element', (node: Element) => {
      const meta = (node.data as { meta?: string } | undefined)?.meta
      if (node.tagName === 'code' && meta) node.properties.dataMeta = meta
    })
  }
}

function rehypeRestoreMeta() {
  return (tree: Root) => {
    visit(tree, 'element', (node: Element) => {
      const meta = node.properties.dataMeta
      if (node.tagName !== 'code' || typeof meta !== 'string') return
      node.data = { ...node.data, meta } as Element['data']
      delete node.properties.dataMeta
    })
  }
}

const sanitizeSchema = {
  ...defaultSchema,
  attributes: { ...defaultSchema.attributes, code: [...(defaultSchema.attributes?.code ?? []), 'dataMeta'] },
}

// ---------------------------------------------------------------------------
// Raw HTML in the markdown is parsed (rehype-raw) and then cut down by
// rehype-sanitize's GitHub allowlist: <details>, <kbd>, <sub> and friends
// survive; <script>, <iframe>, style and on* attributes do not. Sanitize runs
// before any of our own transforms, so everything we add after it is
// trusted markup and a card never gets to add attributes. This matters more
// here than on the web: the preview runs inside the Electron app.
export async function renderMarkdown(markdown: string, ctx: RenderContext): Promise<string> {
  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath)
    .use(remarkDollarGuard)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeParkMeta)
    .use(rehypeRaw)
    .use(rehypeSanitize, sanitizeSchema)
    .use(rehypeRestoreMeta)
    .use(rehypeSlug)
    .use(rehypeAutolinkHeadings, {
      behavior: 'append',
      properties: { className: ['heading-anchor'], ariaLabel: 'Link to this section' },
      content: { type: 'text', value: '#' },
    })
    // `trust` stays off: no \href or \includegraphics from a card.
    .use(rehypeKatex, { strict: 'ignore', output: 'htmlAndMathml' })
    .use(rehypeMermaid)
    .use(rehypeShiki, shikiOptions)
    .use(rehypeWikiLinks, ctx)
    .use(rehypeCallouts)
    .use(rehypeHighlights)
    .use(rehypeTableWrap)
    .use(rehypeCodeBlocks)
    .use(rehypeLinks, ctx)
    .use(rehypeStringify)
    .process(stripComments(markdown))
  return String(file)
}

export interface OutlineItem {
  id: string
  text: string
  depth: 2 | 3
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }
function decodeEntities(s: string) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) =>
    e[0] === '#'
      ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1)))
      : (ENTITIES[e.toLowerCase()] ?? m),
  )
}

// h2 and h3 of rendered HTML, for the "On this page" list. Reads our own
// renderer's output (id from rehype-slug, anchor from autolink), not
// arbitrary HTML.
export function outline(html: string): OutlineItem[] {
  const items: OutlineItem[] = []
  for (const m of html.matchAll(/<h([23]) id="([^"]+)"[^>]*>([\s\S]*?)<\/h\1>/g)) {
    const text = (m[3] ?? '')
      .replace(/<a class="heading-anchor"[\s\S]*?<\/a>/g, '')
      .replace(/<[^>]+>/g, '')
      .trim()
    if (text) items.push({ id: m[2] ?? '', text: decodeEntities(text), depth: Number(m[1]) as 2 | 3 })
  }
  return items
}
