// Runnable check for the toolbar commands: bun src/lib/md-commands.check.ts
import assert from 'node:assert/strict'
import { EditorSelection, EditorState } from '@codemirror/state'
import { block, callout, codeBlock, heading, link, mermaid, table, toggleList, wrap, type MdCommand } from './md-commands'

// Run a command on `doc`, where « and » mark the selection (or ¦ a cursor).
// Returns the new doc with the selection marked the same way.
function run(cmd: MdCommand, marked: string): string {
  const from = marked.search(/[«¦]/)
  const to = marked.includes('¦') ? from : marked.indexOf('»') - 1
  const doc = marked.replace(/[«»¦]/g, '')
  const state = EditorState.create({ doc, selection: EditorSelection.range(from, to), extensions: EditorState.allowMultipleSelections.of(true) })
  const next = state.update(cmd(state)).state
  const s = next.selection.main
  const text = next.doc.toString()
  return s.empty ? `${text.slice(0, s.from)}¦${text.slice(s.from)}` : `${text.slice(0, s.from)}«${text.slice(s.from, s.to)}»${text.slice(s.to)}`
}

const bold = wrap('**')
assert.equal(run(bold, 'a «word» b'), 'a **«word»** b')
assert.equal(run(bold, 'a **«word»** b'), 'a «word» b', 'marks outside the selection come off')
assert.equal(run(bold, 'a «**word**» b'), 'a «word» b', 'marks inside the selection come off')
assert.equal(run(bold, 'a ¦ b'), 'a **«text»** b', 'empty selection gets a selected placeholder')
assert.equal(run(wrap('_'), '**«bold»**'), '**_«bold»_**', 'italic never eats half of a bold mark')

assert.equal(run(link(), 'see «docs» here'), 'see [docs](«https://») here')
assert.equal(run(link(), '«https://x.dev»'), '[«text»](https://x.dev)')
assert.equal(run(link(true), '¦'), '![«alt»](image.png)')

assert.equal(run(heading(2), 'Ti¦tle'), '## Ti¦tle')
assert.equal(run(heading(2), '## Ti¦tle'), 'Ti¦tle', 'same level again removes it')
assert.equal(run(heading(1), '### Ti¦tle'), '# Ti¦tle', 'another level is replaced')
assert.equal(run(heading(1), '¦'), '# ¦', 'the cursor lands after the mark on an empty line')

assert.equal(run(toggleList('bullet'), '«one\ntwo»'), '«- one\n- two»')
assert.equal(run(toggleList('bullet'), '«- one\n- two»'), '«one\ntwo»')
assert.equal(run(toggleList('ordered'), '«- one\n\n- two»'), '«1. one\n\n2. two»', 'blank lines are skipped and numbering continues')
assert.equal(run(toggleList('task'), '  - it¦em'), '  - [ ] it¦em', 'indent kept, bullet swapped for a task')
assert.equal(run(toggleList('bullet'), '- [ ] it¦em'), '- it¦em', 'a task is not a bullet')
assert.equal(run(toggleList('quote'), 'sa¦id'), '> sa¦id')

assert.equal(run(codeBlock, '«x = 1\ny = 2»'), '```¦\nx = 1\ny = 2\n```')
assert.equal(run(codeBlock, 'para¦'), 'para\n\n```\n¦\n```')
assert.equal(run(table, '¦'), '| «Column» | Column |\n| --- | --- |\n|  |  |')
assert.equal(run(callout, 'text¦\nnext'), 'text\n\n> [!note] «Title»\n> Text\n\nnext')
assert.equal(run(mermaid, '¦'), '```mermaid\nflowchart TD\n  «A[Start] --> B[Done]»\n```')
assert.equal(run(block('---'), 'a\n¦'), 'a\n\n---¦', 'an empty line after text gets a blank line first')

console.log('md-commands checks ok')
