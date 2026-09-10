// Obsidian comments: `%% note to self %%`, inline or spanning lines. Writers
// use them for things readers must not see, so they come out before the
// preview renders. Fenced code keeps its %%. An unclosed %% hides the rest
// of the file, which is what Obsidian does too.
// ponytail: `%%` inside inline `code` still opens a comment; handle it if a
// card about Obsidian syntax ever needs it.
// Ported from GitBasedDocs dashboard/lib/render/comments.ts.
export function stripComments(md: string): string {
  if (!md.includes('%%')) return md
  const out: string[] = []
  let fence = ''
  let inComment = false

  for (const line of md.split('\n')) {
    const f = line.match(/^ {0,3}(`{3,}|~{3,})/)?.[1]
    if (!inComment && f && (!fence || (f[0] === fence[0] && f.length >= fence.length))) {
      fence = fence ? '' : f
      out.push(line)
      continue
    }
    if (fence) {
      out.push(line)
      continue
    }

    let kept = ''
    let rest = line
    let touched = inComment
    while (rest) {
      const at = rest.indexOf('%%')
      if (inComment) {
        if (at === -1) break
        rest = rest.slice(at + 2)
        inComment = false
      } else {
        if (at === -1) {
          kept += rest
          break
        }
        kept += rest.slice(0, at)
        rest = rest.slice(at + 2)
        inComment = true
        touched = true
      }
    }
    // A line that held only comment goes away, so it does not split the
    // paragraph around it in two.
    if (touched && !kept.trim()) continue
    out.push(kept)
  }
  return out.join('\n')
}
