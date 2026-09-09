export function formatDue(due: string | null): string {
  if (!due) return ''
  const today = new Date().toISOString().slice(0, 10)
  if (due < today) {
    const days = Math.max(1, Math.round((Date.now() - new Date(due).getTime()) / 864e5))
    return `${days}d overdue`
  }
  if (due === today) return 'Today'
  const tomorrow = new Date(Date.now() + 864e5).toISOString().slice(0, 10)
  if (due === tomorrow) return 'Tomorrow'
  const days = Math.round((new Date(due).getTime() - Date.now()) / 864e5)
  if (days <= 30) return `${days}d`
  return due
}

export function dueTone(due: string | null): 'red' | 'amber' | 'muted' {
  if (!due) return 'muted'
  const today = new Date().toISOString().slice(0, 10)
  if (due < today) return 'red'
  if (due === today) return 'amber'
  return 'muted'
}
