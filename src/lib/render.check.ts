// Runnable check for the preview renderer: bun src/lib/render.check.ts
// Ported from GitBasedDocs dashboard/lib/render/markdown.check.ts.
import assert from 'node:assert/strict'
import { stripComments } from './comments'
import { outline, renderMarkdown, type RenderContext } from './render'

const ctx: RenderContext = {
  pagePath: 'auth/login-2026-09-06.md',
  tasks: [
    { id: 'login-2026-09-06', title: 'Rebuild login form', relPath: 'auth/login-2026-09-06.md' },
    { id: 'tokens-2026-09-07', title: 'Token refresh', relPath: 'auth/tokens-2026-09-07.md' },
    { id: 'setup-2026-09-01', title: 'Project setup', relPath: 'setup-2026-09-01.md' },
  ],
}
const r = (md: string, c: RenderContext = ctx) => renderMarkdown(md, c)

// --- script and event-handler injection never reaches the app ---------------
for (const evil of [
  '<script>alert(1)</script>',
  'hello <script>alert(1)</script> world',
  '<img src="x" onerror="alert(1)">',
  '<a href="javascript:alert(1)">x</a>',
  '[x](javascript:alert(1))',
  '<iframe src="https://evil.test"></iframe>',
  '<div onclick="alert(1)">x</div>',
  '<a href="#" data-task="setup-2026-09-01">spoofed</a>',
]) {
  const html = await r(evil)
  assert.ok(!/<script/i.test(html), `script tag leaked: ${evil} -> ${html}`)
  assert.ok(!/\bon\w+=/i.test(html), `event handler leaked: ${evil} -> ${html}`)
  assert.ok(!/javascript:/i.test(html), `javascript: url leaked: ${evil} -> ${html}`)
  assert.ok(!/<iframe/i.test(html), `iframe leaked: ${evil} -> ${html}`)
  assert.ok(!/data-task/.test(html), `raw HTML set our own attribute: ${evil} -> ${html}`)
}

// --- links to other cards open them ------------------------------------------
assert.match(await r('[t](./tokens-2026-09-07.md)'), /<a href="#" data-task="tokens-2026-09-07">t<\/a>/)
assert.match(await r('[s](../setup-2026-09-01)'), /data-task="setup-2026-09-01"/)
assert.match(await r('[s](/setup-2026-09-01.md)'), /data-task="setup-2026-09-01"/, 'a leading / is the project root')
// an unknown relative link never navigates the app away
assert.doesNotMatch(await r('[x](../../secret.md)'), /href=/)
assert.doesNotMatch(await r('[x](nope.md)'), /href=/)
const ext = await r('[gh](https://github.com)')
assert.match(ext, /target="_blank"/)
assert.match(ext, /rel="noreferrer noopener"/)
assert.match(await r('[a](#setup)'), /href="#setup"/)
assert.match(await r('[bad](100%.md) and ![bad](50%.png)'), /bad/, 'a stray % must not crash the render')

// --- images are read from the project folder, never fetched by path ---------
assert.match(await r('![d](./img/diagram.png)'), /<img alt="d" data-asset="auth\/img\/diagram.png">/)
assert.match(await r('![](img/a%20b.png)'), /data-asset="auth\/img\/a b.png"/)
assert.doesNotMatch(await r('![x](../../../etc/passwd.png)'), /<img|data-asset/)
assert.match(await r('![x](https://example.com/a.png)'), /src="https:\/\/example.com\/a.png"/)

// --- Obsidian wikilinks ---------------------------------------------------------
assert.match(await r('see [[Token refresh]]'), /<a href="#" data-task="tokens-2026-09-07" class="wikilink" title="Token refresh">Token refresh<\/a>/)
assert.match(await r('see [[tokens-2026-09-07|the refresh card]]'), /data-task="tokens-2026-09-07"[^>]*>the refresh card</)
assert.match(await r('see [[project setup#Steps]]'), /data-task="setup-2026-09-01"[^>]*>project setup > Steps</)
assert.match(await r('try [[not a card]] now'), /<span class="wikilink wikilink-unresolved"[^>]*>not a card<\/span>/)
assert.match(await r('`[[Token refresh]]`'), /<code>\[\[Token refresh\]\]<\/code>/, 'never inside code')
assert.match(await r('![[Screen Shot.png]]'), /<img data-asset="Screen Shot.png\|auth\/Screen Shot.png" alt="Screen Shot.png">/)
assert.match(await r('![[diagram.png|300x200]]'), /width="300" height="200"/)
assert.match(await r('![[../../x.png]]'), /Image not found: x.png/)
assert.match(await r('![[Token refresh]]'), /class="wikilink"/, 'a card embed links to the card')
assert.doesNotMatch(await r('![[Token refresh]]'), /!</, 'the ! is consumed, not left dangling')

// --- callouts --------------------------------------------------------------------
const note = await r('> [!NOTE]\n> Tokens are scoped to one project.')
assert.match(note, /<div class="callout callout-note" role="note">/)
assert.match(note, /<div class="callout-label">NOTE<\/div>/)
assert.doesNotMatch(note, /\[!NOTE\]/)
assert.match(await r('> [!bug]\n> it breaks'), /callout callout-danger/)
assert.match(await r('> [!whatever]\n> x'), /callout callout-note/, 'unknown type falls back to a note')
const titled = await r('> [!tip] Before you start\n> Install bun.')
assert.match(titled, /<div class="callout-label callout-title">Before you start<\/div>/)
assert.match(titled, /<p>Install bun\.<\/p>/)
assert.match(await r('> [!faq]- Why?\n> Because.'), /<details class="callout callout-warning"><summary class="callout-label callout-title">Why\?<\/summary>/)
assert.match(await r('> [!faq]+ Open\n> x'), /<details class="callout callout-warning" open>/)
assert.match(await r('> just a quote'), /<blockquote>/)

// --- code blocks -------------------------------------------------------------------
const code = await r('```bash\ncurl https://x.dev\n```')
assert.match(code, /<div class="code-block">/)
assert.match(code, /<span class="code-lang">bash<\/span>/)
assert.match(code, /<button type="button" class="code-copy" data-copy="">Copy<\/button>/)
assert.match(code, /<span style="color:#[0-9A-F]{6}">curl<\/span>/, 'Shiki colours tokens')
assert.doesNotMatch(code, /<pre[^>]*style=/)
assert.match(await r('```notalanguage\nx\n```'), /class="code-block"/, 'unknown language falls back to text')
const meta = await r('```ts title="lib/auth.ts" {2}\nconst a = 1\nconst b = 2\n```')
assert.match(meta, /<span class="code-lang">lib\/auth\.ts<\/span>/)
assert.equal(meta.match(/class="line highlighted"/g)?.length, 1)
const diff = await r('```js\nold() // [!code --]\nnew() // [!code ++]\n```')
assert.match(diff, /class="line diff remove"/)
assert.match(diff, /class="line diff add"/)
assert.doesNotMatch(diff, /\[!code/)
assert.doesNotMatch(await r('```html\n<script>alert(1)</script>\n```'), /<script>/)

// --- mermaid -----------------------------------------------------------------------
{
  const m = await r('```mermaid\ngraph TD\n  A[[Sub]] ==> B{Ok?}\n  B -->|<b>yes</b>| C\n```')
  assert.match(m, /<div class="mermaid-diagram" role="img" aria-label="Diagram">graph TD/)
  assert.match(m, /A\[\[Sub\]\] ==> B\{Ok\?\}/, 'no wikilinks or highlights inside a diagram')
  assert.match(m, /&#x3C;b>yes/, 'a < in a label stays escaped')
  assert.doesNotMatch(m, /<b>|code-block|<mark>/)
}

// --- math --------------------------------------------------------------------------
{
  assert.match(await r('Energy is $E = mc^2$ here.'), /<span class="katex">/)
  assert.match(await r('$$\n\\int_0^1 x\\,dx\n$$'), /class="katex-display"/)
  const money = await r('The plan costs $5 a month, or $50 a year.')
  assert.doesNotMatch(money, /katex/)
  assert.doesNotMatch(await r('$\\href{javascript:alert(1)}{x}$'), /href="javascript/)
  assert.match(await r('$\\frac{1}{$ ok'), /katex-error|<p>/)
}

// --- comments, highlights, safe inline HTML ---------------------------------------
{
  assert.equal(stripComments('keep %%secret%% this'), 'keep  this')
  assert.equal(stripComments('a\n%%\nhidden\nlines\n%%\nb'), 'a\nb')
  assert.equal(stripComments('```\n%% not a comment %%\n```'), '```\n%% not a comment %%\n```')
  const page = await r('Visible. %%internal: the password is hunter2%% Still visible.')
  assert.doesNotMatch(page, /hunter2|%%/)

  assert.match(await r('This is ==important== text.'), /This is <mark>important<\/mark> text\./)
  assert.doesNotMatch(await r('if a == b and c == d'), /<mark>/)
  assert.doesNotMatch(await r('`x ==y== z`'), /<mark>/)

  const html = await r('<details><summary>More</summary>\n\nHidden *text*.\n\n</details>\n\nPress <kbd>Ctrl</kbd>, H<sub>2</sub>O, x<sup>2</sup>')
  assert.match(html, /<details><summary>More<\/summary>/)
  assert.match(html, /<em>text<\/em>/)
  assert.match(html, /<kbd>Ctrl<\/kbd>/)
  assert.match(html, /<sub>2<\/sub>/)
  assert.match(html, /<sup>2<\/sup>/)
  assert.doesNotMatch(await r('<div style="position:fixed" onclick="x()">hi</div>'), /style=|onclick/)
  assert.doesNotMatch(await r('<form action="/x"><input name="p" type="password"></form>'), /<form|type="password"/)
  assert.doesNotMatch(await r('<style>body{display:none}</style>'), /<style/)
}

// --- headings, tables, task lists, footnotes ----------------------------------------
assert.match(await r('## Getting a token'), /<h2 id="getting-a-token">[\s\S]*class="heading-anchor"/)
assert.match(await r('| a | b |\n|---|---|\n| 1 | 2 |'), /<div class="table-wrap"><table>/)
assert.match(await r('- [x] done\n- [ ] todo'), /type="checkbox"/)
assert.match(await r('Text[^1]\n\n[^1]: The note.'), /class="footnotes"[\s\S]*The note\./)

assert.deepEqual(outline(await r('# Top\n\n## Install `bun`\n\n### Step *one*\n\n## Install `bun`\n\n#### deep\n\n## Q&A <3')), [
  { id: 'install-bun', text: 'Install bun', depth: 2 },
  { id: 'step-one', text: 'Step one', depth: 3 },
  { id: 'install-bun-1', text: 'Install bun', depth: 2 },
  { id: 'qa-3', text: 'Q&A <3', depth: 2 },
])

console.log('render checks ok')
