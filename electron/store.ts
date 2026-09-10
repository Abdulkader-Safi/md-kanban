import { promises as fs } from 'node:fs'
import path from 'node:path'

export interface ProjectRecord {
  id: string
  /** absolute folder path */
  root: string
  /** folder name, used as the project name */
  name: string
}

export interface ScannedFile {
  relPath: string
  fileName: string
  workspace: string
  content: string
}

const SKIP_DIRS = new Set(['node_modules', 'dist', 'out', '.git'])
const MAX_DEPTH = 4

function uid(): string {
  return Math.random().toString(36).slice(2, 10)
}

function storeFile(userDataPath: string): string {
  return path.join(userDataPath, 'md-kanban-projects.json')
}

export async function loadProjects(userDataPath: string): Promise<ProjectRecord[]> {
  try {
    const raw = await fs.readFile(storeFile(userDataPath), 'utf-8')
    const arr = JSON.parse(raw) as ProjectRecord[]
    // Drop folders that no longer exist.
    const kept: ProjectRecord[] = []
    for (const p of arr) {
      try {
        const st = await fs.stat(p.root)
        if (st.isDirectory()) kept.push(p)
      } catch { /* gone */ }
    }
    return kept
  } catch {
    return []
  }
}

async function saveProjects(userDataPath: string, list: ProjectRecord[]): Promise<void> {
  await fs.mkdir(userDataPath, { recursive: true })
  await fs.writeFile(storeFile(userDataPath), JSON.stringify(list, null, 2) + '\n', 'utf-8')
}

export async function addProject(userDataPath: string, root: string): Promise<ProjectRecord> {
  const abs = path.resolve(root)
  const list = await loadProjects(userDataPath)
  const found = list.find((p) => p.root === abs)
  if (found) return found
  const record: ProjectRecord = { id: uid(), root: abs, name: path.basename(abs) || abs }
  list.push(record)
  await saveProjects(userDataPath, list)
  return record
}

export async function removeProject(userDataPath: string, id: string): Promise<void> {
  const list = await loadProjects(userDataPath)
  await saveProjects(userDataPath, list.filter((p) => p.id !== id))
}

/** Resolve a project-relative path, refusing escapes outside the root. */
export function resolveInRoot(root: string, relPath: string): string | null {
  const abs = path.resolve(root, relPath)
  if (abs !== root && !abs.startsWith(root + path.sep)) return null
  return abs
}

export async function scanProject(root: string): Promise<ScannedFile[]> {
  const out: ScannedFile[] = []
  async function walk(dir: string, rel: string, depth: number): Promise<void> {
    if (depth > MAX_DEPTH) return
    let entries
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      if (e.name.startsWith('.')) continue
      const relPath = rel ? `${rel}/${e.name}` : e.name
      const abs = path.join(dir, e.name)
      if (e.isDirectory()) {
        if (SKIP_DIRS.has(e.name)) continue
        await walk(abs, relPath, depth + 1)
      } else if (e.isFile() && e.name.toLowerCase().endsWith('.md')) {
        try {
          const content = await fs.readFile(abs, 'utf-8')
          out.push({
            relPath,
            fileName: e.name,
            workspace: rel.split('/')[0] ?? '',
            content,
          })
        } catch { /* skip unreadable */ }
      }
    }
  }
  await walk(root, '', 0)
  return out
}

export async function readProjectFile(root: string, relPath: string): Promise<string> {
  const abs = resolveInRoot(root, relPath)
  if (!abs) throw new Error('Path escapes project root')
  return await fs.readFile(abs, 'utf-8')
}

const IMAGE = /\.(png|jpe?g|gif|webp|avif|svg|bmp|ico)$/i

/** Image bytes for the preview. Anything that is not an image is refused, so
 *  a card cannot pull other files out of the folder as binary. */
export async function readProjectImage(root: string, relPath: string): Promise<Buffer> {
  const abs = resolveInRoot(root, relPath)
  if (!abs || !IMAGE.test(abs)) throw new Error('Not an image in this project')
  return await fs.readFile(abs)
}

export async function writeProjectFile(root: string, relPath: string, content: string): Promise<void> {
  const abs = resolveInRoot(root, relPath)
  if (!abs) throw new Error('Path escapes project root')
  await fs.mkdir(path.dirname(abs), { recursive: true })
  await fs.writeFile(abs, content, 'utf-8')
}

export async function deleteProjectFile(root: string, relPath: string): Promise<void> {
  const abs = resolveInRoot(root, relPath)
  if (!abs) throw new Error('Path escapes project root')
  try {
    await fs.unlink(abs)
  } catch { /* already gone */ }
}
