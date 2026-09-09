import type { Priority } from './types'

export interface QuickAddResult {
  title: string
  priority?: Priority
  labels: string[]
  assignee?: string
  dueDate?: string
}

const P_MAP: Record<string, Priority> = { p1: 'critical', p2: 'high', p3: 'medium', p4: 'low' }
const NAMED: Priority[] = ['critical', 'high', 'medium', 'low']
const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

function toISO(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** Resolve today/tomorrow/weekday/YYYY-MM-DD to YYYY-MM-DD. Unknown = undefined. */
export function resolveDue(token: string, now = new Date()): string | undefined {
  const t = token.toLowerCase()
  if (t === 'today') return toISO(now)
  if (t === 'tomorrow') return toISO(new Date(now.getTime() + 864e5))
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t
  const w = WEEKDAYS.indexOf(t)
  if (w >= 0) {
    const d = new Date(now)
    let diff = (w - d.getDay() + 7) % 7
    if (diff === 0) diff = 7
    return toISO(new Date(now.getTime() + diff * 864e5))
  }
  return undefined
}

/** Parse "Fix login p1 #backend @safi due:friday" into fields. */
export function parseQuickAdd(input: string, now = new Date()): QuickAddResult {
  const labels: string[] = []
  let priority: Priority | undefined
  let assignee: string | undefined
  let dueDate: string | undefined
  const words: string[] = []
  for (const raw of input.split(/\s+/)) {
    if (!raw) continue
    const low = raw.toLowerCase()
    if (P_MAP[low]) { priority = P_MAP[low]; continue }
    if ((NAMED as string[]).includes(low)) { priority = low as Priority; continue }
    if (raw.startsWith('#') && raw.length > 1) { labels.push(raw.slice(1)); continue }
    if (raw.startsWith('@') && raw.length > 1) { assignee = raw.slice(1); continue }
    if (low.startsWith('due:') && raw.length > 4) {
      const d = resolveDue(raw.slice(4), now)
      if (d) { dueDate = d; continue }
    }
    words.push(raw)
  }
  return { title: words.join(' ').trim(), priority, labels, assignee, dueDate }
}

export type CardTemplateId = 'bug' | 'feature' | 'chore'

export function cardTemplate(id: CardTemplateId, title: string): { priority: Priority; labels: string[]; body: string } {
  const t = title || 'Untitled'
  if (id === 'bug')
    return { priority: 'high', labels: ['bug'], body: `# ${t}\n\nSteps:\n- [ ] Repro\n- [ ] Fix\n- [ ] Verify\n` }
  if (id === 'feature')
    return { priority: 'medium', labels: ['feature'], body: `# ${t}\n\n- [ ] Spec\n- [ ] Build\n- [ ] Verify\n` }
  return { priority: 'low', labels: ['chore'], body: `# ${t}\n\n- [ ] Do\n- [ ] Verify\n` }
}
