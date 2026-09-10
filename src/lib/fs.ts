/* Local folder access via the File System Access API (Chromium).
 * Each connected folder = one project. Inside a project there can be
 * multiple work subfolders, each holding markdown task files.
 * Handles persist in IndexedDB so projects survive reloads.
 */

import { get, set } from 'idb-keyval'

export interface ScannedFile {
  relPath: string
  fileName: string
  workspace: string
  content: string
}

interface DirHandle {
  kind: 'directory'
  name: string
  values(): AsyncIterableIterator<FileSystemHandle>
  getFileHandle(name: string, opts?: { create?: boolean }): Promise<FileSystemFileHandle>
  getDirectoryHandle(name: string, opts?: { create?: boolean }): Promise<DirHandle>
  removeEntry(name: string, opts?: { recursive?: boolean }): Promise<void>
  queryPermission(opts?: { mode?: string }): Promise<PermissionState>
  requestPermission(opts?: { mode?: string }): Promise<PermissionState>
}

declare global {
  interface Window {
    showDirectoryPicker?: (opts?: { mode?: 'read' | 'readwrite' }) => Promise<DirHandle>
  }
}

const HANDLE_KEY = 'md-kanban/handles/v1'

export function supportsFS(): boolean {
  return typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function'
}

async function ensurePerm(handle: DirHandle, mode: 'read' | 'readwrite' = 'readwrite'): Promise<boolean> {
  try {
    const q = await handle.queryPermission({ mode })
    if (q === 'granted') return true
    const r = await handle.requestPermission({ mode })
    return r === 'granted'
  } catch {
    return true
  }
}

/** True when we can read without prompting (used by background refresh). */
export async function hasReadAccess(handle: DirHandle): Promise<boolean> {
  try {
    return (await handle.queryPermission({ mode: 'read' })) === 'granted'
  } catch {
    return true
  }
}

/** Ask the user for access (call from a click handler). */
export async function requestReadAccess(handle: DirHandle): Promise<boolean> {
  try {
    if ((await handle.queryPermission({ mode: 'readwrite' })) === 'granted') return true
    return (await handle.requestPermission({ mode: 'readwrite' })) === 'granted'
  } catch {
    return true
  }
}

export async function pickDirectory(): Promise<DirHandle | null> {
  if (!supportsFS()) return null
  try {
    const handle = await window.showDirectoryPicker!({ mode: 'readwrite' })
    await ensurePerm(handle, 'readwrite')
    return handle
  } catch (e) {
    // AbortError = user cancelled
    return null
  }
}

async function readFile(handle: FileSystemFileHandle): Promise<string> {
  const file = await handle.getFile()
  return await file.text()
}

/** Recursively scan a project folder for *.md files (max depth 4, skips hidden + node_modules). */
export async function scanProject(handle: DirHandle, depth = 0, prefix = ''): Promise<ScannedFile[]> {
  const out: ScannedFile[] = []
  if (depth > 4) return out
  const entries: FileSystemHandle[] = []
  try {
    for await (const h of (handle as DirHandle).values()) entries.push(h)
  } catch {
    return out
  }
  for (const entry of entries) {
    const name = entry.name
    if (name.startsWith('.') || name === 'node_modules' || name === 'dist') continue
    if (entry.kind === 'file' && name.toLowerCase().endsWith('.md')) {
      try {
        const text = await readFile(entry as FileSystemFileHandle)
        const relPath = prefix ? `${prefix}/${name}` : name
        const workspace = prefix.split('/')[0] ?? ''
        out.push({ relPath, fileName: name, workspace, content: text })
      } catch { /* skip unreadable */ }
    } else if (entry.kind === 'directory') {
      const sub = entry as unknown as DirHandle
      const nextPrefix = prefix ? `${prefix}/${name}` : name
      const nested = await scanProject(sub, depth + 1, nextPrefix)
      out.push(...nested)
    }
  }
  return out
}

async function dirFor(handle: DirHandle, dirPath: string, create = false): Promise<DirHandle> {
  let cur = handle
  if (!dirPath) return cur
  for (const part of dirPath.split('/').filter(Boolean)) {
    cur = await cur.getDirectoryHandle(part, { create })
  }
  return cur
}

export async function writeProjectFile(handle: DirHandle, relPath: string, content: string): Promise<void> {
  const parts = relPath.split('/').filter(Boolean)
  const fileName = parts.pop()!
  const dir = await dirFor(handle, parts.join('/'), true)
  const fh = await dir.getFileHandle(fileName, { create: true })
  const w = await (fh as unknown as { createWritable(): Promise<{ write(c: string): Promise<void>; close(): Promise<void> }> }).createWritable()
  await w.write(content)
  await w.close()
}

/** One file as a Blob (images in the preview). Throws when missing. */
export async function readProjectBlob(handle: DirHandle, relPath: string): Promise<Blob> {
  const parts = relPath.split('/').filter(Boolean)
  const fileName = parts.pop()!
  const dir = await dirFor(handle, parts.join('/'), false)
  return await (await dir.getFileHandle(fileName)).getFile()
}

export async function deleteProjectFile(handle: DirHandle, relPath: string): Promise<void> {
  const parts = relPath.split('/').filter(Boolean)
  const fileName = parts.pop()!
  try {
    const dir = await dirFor(handle, parts.join('/'), false)
    await dir.removeEntry(fileName)
  } catch { /* already gone */ }
}

/** Persisted handles: { [projectId]: DirHandle } */
export async function loadHandles(): Promise<Record<string, DirHandle>> {
  try {
    return (await get<Record<string, DirHandle>>(HANDLE_KEY)) ?? {}
  } catch {
    return {}
  }
}

export async function saveHandle(projectId: string, handle: DirHandle): Promise<void> {
  const all = await loadHandles()
  all[projectId] = handle
  await set(HANDLE_KEY, all)
}

export async function removeHandle(projectId: string): Promise<void> {
  const all = await loadHandles()
  delete all[projectId]
  await set(HANDLE_KEY, all)
}
