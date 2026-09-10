import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { fileURLToPath } from 'node:url'
import { promises as fsPromises, watch, type FSWatcher } from 'node:fs'
import path from 'node:path'
import {
  addProject,
  deleteProjectFile,
  loadProjects,
  readProjectFile,
  readProjectImage,
  removeProject,
  scanProject,
  writeProjectFile,
} from './store.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

async function rootFor(userData: string, id: string): Promise<string | null> {
  const list = await loadProjects(userData)
  return list.find((p) => p.id === id)?.root ?? null
}

/* Live watcher: push mdkanban:project-changed to the renderer when a
 * markdown file changes on disk. Debounced so agent edit bursts rescan once.
 * Watches stay up once created. New subfolders get watched when they appear,
 * so there is no re-walk gap where edits go missing. */
const watchers = new Map<string, FSWatcher[]>()
const watchTimers = new Map<string, NodeJS.Timeout>()
const watchPending = new Map<string, Promise<void>>()
const WATCH_DEBOUNCE_MS = 300
const WATCH_SKIP = new Set(['node_modules', 'dist', 'out', '.git'])

function notifyWindows(projectId: string): void {
  for (const win of BrowserWindow.getAllWindows()) {
    try {
      win.webContents.send('mdkanban:project-changed', projectId)
    } catch { /* window gone */ }
  }
}

function scheduleNotify(projectId: string): void {
  const pending = watchTimers.get(projectId)
  if (pending) clearTimeout(pending)
  watchTimers.set(
    projectId,
    setTimeout(() => {
      watchTimers.delete(projectId)
      notifyWindows(projectId)
    }, WATCH_DEBOUNCE_MS),
  )
}

async function collectDirs(root: string): Promise<string[]> {
  const dirs = [root]
  async function walk(dir: string, depth: number): Promise<void> {
    if (depth > 4) return
    let entries
    try {
      entries = await fsPromises.readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      if (!e.isDirectory() || e.name.startsWith('.') || WATCH_SKIP.has(e.name)) continue
      const abs = path.join(dir, e.name)
      dirs.push(abs)
      await walk(abs, depth + 1)
    }
  }
  await walk(root, 0)
  return dirs
}

function closeWatch(projectId: string): void {
  for (const w of watchers.get(projectId) ?? []) {
    try {
      w.close()
    } catch { /* already closed */ }
  }
  watchers.delete(projectId)
}

/** Watch one folder. New subfolders found through rename events get watched
 *  too, so the set grows without ever tearing everything down. */
function watchDir(projectId: string, dir: string): void {
  const list = watchers.get(projectId)
  if (!list) return // removed while setting up
  try {
    const watcher = watch(dir, (event, file) => {
      const name = typeof file === 'string' ? file : ''
      if (event === 'rename' && name) {
        const abs = path.join(dir, name)
        fsPromises
          .stat(abs)
          .then((st) => {
            if (st.isDirectory() && !name.startsWith('.') && !WATCH_SKIP.has(name)) watchDir(projectId, abs)
          })
          .catch(() => {})
      }
      if (name && !name.toLowerCase().endsWith('.md') && event !== 'rename') return
      scheduleNotify(projectId)
    })
    watcher.on('error', () => {})
    list.push(watcher)
  } catch { /* unreadable dir */ }
}

async function ensureWatch(projectId: string, root: string): Promise<void> {
  if (watchers.has(projectId)) return
  const pending = watchPending.get(projectId)
  if (pending) {
    await pending.catch(() => {})
    return
  }
  const run = (async () => {
    watchers.set(projectId, [])
    const dirs = await collectDirs(root)
    if (!watchers.has(projectId)) return // removed while walking
    for (const dir of dirs) watchDir(projectId, dir)
    if ((watchers.get(projectId) ?? []).length === 0) watchers.delete(projectId)
  })().finally(() => {
    watchPending.delete(projectId)
  })
  watchPending.set(projectId, run)
  await run.catch(() => {})
}

async function ensureAllWatches(userData: string): Promise<void> {
  const list = await loadProjects(userData)
  for (const p of list) {
    if (!watchers.has(p.id)) {
      await ensureWatch(p.id, p.root).catch(() => {})
    }
  }
}

function registerFileApi(): void {
  const userData = app.getPath('userData')

  ipcMain.handle('mdkanban:pick-directory', async () => {
    const res = await dialog.showOpenDialog({ properties: ['openDirectory'] })
    if (res.canceled || res.filePaths.length === 0) return null
    const rec = await addProject(userData, res.filePaths[0]!)
    await ensureWatch(rec.id, rec.root).catch(() => {})
    return rec
  })

  ipcMain.handle('mdkanban:list-projects', async () => {
    const list = await loadProjects(userData)
    await ensureAllWatches(userData).catch(() => {})
    return list
  })

  ipcMain.handle('mdkanban:remove-project', async (_e, id: string) => {
    closeWatch(id)
    const pending = watchTimers.get(id)
    if (pending) clearTimeout(pending)
    watchTimers.delete(id)
    await removeProject(userData, id)
  })

  ipcMain.handle('mdkanban:scan-project', async (_e, id: string) => {
    const root = await rootFor(userData, id)
    if (!root) return []
    if (!watchers.has(id)) await ensureWatch(id, root).catch(() => {})
    return await scanProject(root)
  })

  ipcMain.handle('mdkanban:read-file', async (_e, id: string, relPath: string) => {
    const root = await rootFor(userData, id)
    if (!root) throw new Error('Unknown project')
    return await readProjectFile(root, relPath)
  })

  ipcMain.handle('mdkanban:read-binary', async (_e, id: string, relPath: string) => {
    const root = await rootFor(userData, id)
    if (!root) throw new Error('Unknown project')
    return await readProjectImage(root, relPath)
  })

  ipcMain.handle('mdkanban:write-file', async (_e, id: string, relPath: string, content: string) => {
    const root = await rootFor(userData, id)
    if (!root) throw new Error('Unknown project')
    await writeProjectFile(root, relPath, content)
  })

  ipcMain.handle('mdkanban:delete-file', async (_e, id: string, relPath: string) => {
    const root = await rootFor(userData, id)
    if (!root) throw new Error('Unknown project')
    await deleteProjectFile(root, relPath)
  })
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: 'MD Kanban',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  // Links in a card preview open in the system browser. The app window
  // itself never navigates away from the board.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^(https?|mailto):/i.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (e, url) => {
    if (url !== win.webContents.getURL()) e.preventDefault()
  })

  const devUrl = process.env.ELECTRON_RENDERER_URL
  if (devUrl) {
    void win.loadURL(devUrl)
  } else {
    void win.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

void app.whenReady().then(() => {
  registerFileApi()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
