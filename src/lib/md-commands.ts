/* Markdown formatting commands for the editor toolbar and shortcuts.
 * Each takes an EditorState and returns the transaction to dispatch, so
 * they run (and are checked) without a DOM. Checks: bun src/lib/md-commands.check.ts */

import { EditorSelection, type EditorState, type Line, type TransactionSpec } from '@codemirror/state'

export type MdCommand = (state: EditorState) => TransactionSpec

const spec = (s: TransactionSpec): TransactionSpec => ({ ...s, scrollIntoView: true, userEvent: 'input.format' })

/** Wrap each selection in marks, or take the marks off when already there.
 *  An empty selection gets a placeholder, selected so typing replaces it. */
export function wrap(before: string, after = before, placeholder = 'text'): MdCommand {
  return (state) =>
    spec(
      state.changeByRange((range) => {
        const text = state.sliceDoc(range.from, range.to)
        const outside =
          range.from >= before.length &&
          state.sliceDoc(range.from - before.length, range.from) === before &&
          state.sliceDoc(range.to, range.to + after.length) === after
        if (outside) {
          return {
            changes: [
              { from: range.from - before.length, to: range.from },
              { from: range.to, to: range.to + after.length },
            ],
            range: EditorSelection.range(range.from - before.length, range.to - before.length),
          }
        }
        if (text.length >= before.length + after.length && text.startsWith(before) && text.endsWith(after)) {
          const inner = text.slice(before.length, text.length - after.length)
          return { changes: { from: range.from, to: range.to, insert: inner }, range: EditorSelection.range(range.from, range.from + inner.length) }
        }
        const inner = text || placeholder
        const start = range.from + before.length
        return {
          changes: { from: range.from, to: range.to, insert: before + inner + after },
          range: EditorSelection.range(start, start + inner.length),
        }
      }),
    )
}

/** [label](url) around the selection. A selected URL becomes the target. */
export function link(image = false): MdCommand {
  const bang = image ? '!' : ''
  return (state) =>
    spec(
      state.changeByRange((range) => {
        const text = state.sliceDoc(range.from, range.to)
        const isUrl = /^(https?:\/\/|\.{0,2}\/)\S*$/.test(text)
        const label = isUrl ? (image ? 'alt' : 'text') : text || (image ? 'alt' : 'text')
        const url = isUrl ? text : image ? 'image.png' : 'https://'
        const insert = `${bang}[${label}](${url})`
        // Select whatever still needs typing: the label for a pasted URL,
        // the URL for selected words.
        const labelAt = range.from + bang.length + 1
        const urlAt = labelAt + label.length + 2
        const sel = text && !isUrl ? EditorSelection.range(urlAt, urlAt + url.length) : EditorSelection.range(labelAt, labelAt + label.length)
        return { changes: { from: range.from, to: range.to, insert }, range: sel }
      }),
    )
}

function selectedLines(state: EditorState): Line[] {
  const seen = new Map<number, Line>()
  for (const r of state.selection.ranges) {
    const last = state.doc.lineAt(r.to).number
    for (let n = state.doc.lineAt(r.from).number; n <= last; n++) seen.set(n, state.doc.line(n))
  }
  const lines = [...seen.values()]
  const content = lines.filter((l) => l.text.trim())
  return content.length ? content : lines
}

/** Changes at line starts. A cursor sits after anything inserted there; a
 *  selected range grows to take the new marks in. */
function lineChanges(state: EditorState, changes: { from: number; to: number; insert: string }[]): TransactionSpec {
  const set = state.changes(changes)
  const ranges = state.selection.ranges.map((r) =>
    r.empty ? EditorSelection.cursor(set.mapPos(r.head, 1)) : EditorSelection.range(set.mapPos(r.from, -1), set.mapPos(r.to, 1)),
  )
  return spec({ changes: set, selection: EditorSelection.create(ranges, state.selection.mainIndex) })
}

const HEADING = /^#{1,6}\s+/

/** Set the selected lines to heading `level`; the same level again removes it. */
export function heading(level: number): MdCommand {
  const mark = `${'#'.repeat(level)} `
  return (state) => {
    const lines = selectedLines(state)
    const on = lines.every((l) => l.text.startsWith(mark) && !l.text.startsWith(`${mark.trim()}#`))
    return lineChanges(
      state,
      lines.map((l) => ({ from: l.from, to: l.from + (l.text.match(HEADING)?.[0].length ?? 0), insert: on ? '' : mark })),
    )
  }
}

export type ListKind = 'bullet' | 'ordered' | 'task' | 'quote'
const KIND: Record<ListKind, RegExp> = {
  task: /^\s*[-*+] \[[ xX]\] /,
  bullet: /^\s*[-*+] (?!\[[ xX]\] )/,
  ordered: /^\s*\d+[.)] /,
  quote: /^\s*> ?/,
}
const ANY_MARK = /^(\s*)(?:[-*+] \[[ xX]\] |[-*+] |\d+[.)] |> ?)?/

/** Turn the selected lines into a list (or quote). If they already are that
 *  kind, take it off. Another kind of list is swapped, keeping the indent. */
export function toggleList(kind: ListKind): MdCommand {
  return (state) => {
    const lines = selectedLines(state)
    const on = lines.every((l) => KIND[kind].test(l.text))
    let n = 0
    return lineChanges(
      state,
      lines.map((l) => {
        const m = l.text.match(ANY_MARK)!
        const indent = m[1] ?? ''
        const mark = kind === 'ordered' ? `${++n}. ` : kind === 'task' ? '- [ ] ' : kind === 'bullet' ? '- ' : '> '
        return { from: l.from, to: l.from + m[0].length, insert: indent + (on ? '' : mark) }
      }),
    )
  }
}

/** Insert a block on its own lines below the cursor line (or on it, when it
 *  is empty), with blank lines around it. `select` is a [start, end] range
 *  inside `text` to select afterwards. */
export function block(text: string, select: [number, number] = [text.length, text.length]): MdCommand {
  return (state) => {
    const line = state.doc.lineAt(state.selection.main.head)
    const empty = !line.text.trim()
    const pre = empty ? (line.number > 1 && state.doc.line(line.number - 1).text.trim() ? '\n' : '') : '\n\n'
    const next = line.number < state.doc.lines ? state.doc.line(line.number + 1) : null
    const post = next?.text.trim() ? '\n' : ''
    const from = empty ? line.from : line.to
    const at = from + pre.length
    return spec({
      changes: { from, to: line.to, insert: pre + text + post },
      selection: EditorSelection.range(at + select[0], at + select[1]),
    })
  }
}

/** Fence the selected lines, or insert an empty fence. */
export const codeBlock: MdCommand = (state) => {
  const r = state.selection.main
  if (r.empty) return block('```\n\n```', [4, 4])(state)
  const first = state.doc.lineAt(r.from)
  const last = state.doc.lineAt(r.to)
  return spec({
    changes: [
      { from: first.from, insert: '```\n' },
      { from: last.to, insert: '\n```' },
    ],
    selection: EditorSelection.cursor(first.from + 3),
  })
}

const TABLE = '| Column | Column |\n| --- | --- |\n|  |  |'
const CALLOUT = '> [!note] Title\n> Text'
const MERMAID = '```mermaid\nflowchart TD\n  A[Start] --> B[Done]\n```'

export const table = block(TABLE, [2, 8])
export const callout = block(CALLOUT, [10, 15])
export const mathBlock = block('$$\n\n$$', [3, 3])
export const mermaid = block(MERMAID, [26, 46])
export const rule = block('---')
