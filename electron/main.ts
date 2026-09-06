import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import {
  addProject,
  deleteProjectFile,
  loadProjects,
  readProjectFile,
  removeProject,
  scanProject,
  writeProjectFile,
} from './store.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

async function rootFor(userData: string, id: string): Promise<string | null> {
  const list = await loadProjects(userData)
  return list.find((p) => p.id === id)?.root ?? null
}

function registerFileApi(): void {
  const userData = app.getPath('userData')

  ipcMain.handle('mdkanban:pick-directory', async () => {
    const res = await dialog.showOpenDialog({ properties: ['openDirectory'] })
    if (res.canceled || res.filePaths.length === 0) return null
    return await addProject(userData, res.filePaths[0]!)
  })

  ipcMain.handle('mdkanban:list-projects', async () => {
    return await loadProjects(userData)
  })

  ipcMain.handle('mdkanban:remove-project', async (_e, id: string) => {
    await removeProject(userData, id)
  })

  ipcMain.handle('mdkanban:scan-project', async (_e, id: string) => {
    const root = await rootFor(userData, id)
    if (!root) return []
    return await scanProject(root)
  })

  ipcMain.handle('mdkanban:read-file', async (_e, id: string, relPath: string) => {
    const root = await rootFor(userData, id)
    if (!root) throw new Error('Unknown project')
    return await readProjectFile(root, relPath)
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
