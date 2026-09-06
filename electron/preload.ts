import { contextBridge, ipcRenderer } from 'electron'

/* File API bridge (phase 2). The watcher event lands here with the
 * watcher-live-refresh card. */
contextBridge.exposeInMainWorld('mdkanban', {
  isElectron: true,
  platform: process.platform,
  pickDirectory: () => ipcRenderer.invoke('mdkanban:pick-directory'),
  listProjects: () => ipcRenderer.invoke('mdkanban:list-projects'),
  removeProject: (id: string) => ipcRenderer.invoke('mdkanban:remove-project', id),
  scanProject: (id: string) => ipcRenderer.invoke('mdkanban:scan-project', id),
  readFile: (id: string, relPath: string) => ipcRenderer.invoke('mdkanban:read-file', id, relPath),
  writeFile: (id: string, relPath: string, content: string) =>
    ipcRenderer.invoke('mdkanban:write-file', id, relPath, content),
  deleteFile: (id: string, relPath: string) => ipcRenderer.invoke('mdkanban:delete-file', id, relPath),
  onProjectChanged: (cb: (id: string) => void) => {
    const listener = (_e: unknown, id: string) => cb(id)
    ipcRenderer.on('mdkanban:project-changed', listener)
    return () => ipcRenderer.removeListener('mdkanban:project-changed', listener)
  },
})
