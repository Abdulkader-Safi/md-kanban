import type { Task } from './types'
import { parseTaskFile } from './markdown'

const now = new Date().toISOString()

function md(front: string, body: string): string {
  return `---\n${front}\n---\n\n${body}\n`
}

const SEEDS: Array<{ project: string; workspace: string; relPath: string; fileName: string; raw: string }> = [
  {
    project: 'website-redesign',
    workspace: 'auth',
    relPath: 'auth/login-form-2026-09-06.md',
    fileName: 'login-form-2026-09-06.md',
    raw: md(
      `id: "login-form-2026-09-06"\nstatus: "todo"\npriority: "high"\nassignee: "safi"\ndueDate: null\ncreated: "${now}"\nmodified: "${now}"\nlabels: ["feature", "auth"]\norder: 1`,
      '# Rebuild login form\n\nValidate email, show inline errors, wire up the new auth endpoint.',
    ),
  },
  {
    project: 'website-redesign',
    workspace: 'auth',
    relPath: 'auth/signup-flow-2026-09-06.md',
    fileName: 'signup-flow-2026-09-06.md',
    raw: md(
      `id: "signup-flow-2026-09-06"\nstatus: "in-progress"\npriority: "critical"\nassignee: "safi"\ndueDate: null\ncreated: "${now}"\nmodified: "${now}"\nlabels: ["feature", "auth"]\norder: 0`,
      '# Signup flow\n\n- [x] Draft copy\n- [ ] Wire invite codes\n- [ ] Empty state',
    ),
  },
  {
    project: 'website-redesign',
    workspace: 'billing',
    relPath: 'billing/pricing-page-2026-09-06.md',
    fileName: 'pricing-page-2026-09-06.md',
    raw: md(
      `id: "pricing-page-2026-09-06"\nstatus: "backlog"\npriority: "medium"\nassignee: ""\ndueDate: null\ncreated: "${now}"\nmodified: "${now}"\nlabels: ["ui"]\norder: 2`,
      '# Pricing page\n\nCompare monthly vs yearly. Needs design tokens first.',
    ),
  },
  {
    project: 'mobile-app',
    workspace: 'onboarding',
    relPath: 'onboarding/welcome-screens-2026-09-06.md',
    fileName: 'welcome-screens-2026-09-06.md',
    raw: md(
      `id: "welcome-screens-2026-09-06"\nstatus: "review"\npriority: "medium"\nassignee: "lina"\ndueDate: null\ncreated: "${now}"\nmodified: "${now}"\nlabels: ["mobile"]\norder: 0`,
      '# Welcome screens\n\nThree-step intro with skip. Check contrast on step 2.',
    ),
  },
  {
    project: 'mobile-app',
    workspace: 'onboarding',
    relPath: 'onboarding/push-permissions-2026-09-06.md',
    fileName: 'push-permissions-2026-09-06.md',
    raw: md(
      `id: "push-permissions-2026-09-06"\nstatus: "done"\npriority: "low"\nassignee: "lina"\ndueDate: null\ncreated: "${now}"\nmodified: "${now}"\nlabels: ["mobile"]\norder: 0`,
      '# Push permissions\n\nAsk after first value moment, not on launch.',
    ),
  },
]

export function demoTasks(): Task[] {
  return SEEDS.map((s) =>
    parseTaskFile(s.raw, {
      project: s.project,
      workspace: s.workspace,
      relPath: s.relPath,
      fileName: s.fileName,
    }),
  )
}
