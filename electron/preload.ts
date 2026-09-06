import { contextBridge } from 'electron'

/* Minimal bridge for phase 1. The file API (pick, scan, read, write,
 * delete, watch) lands here in phase 2. */
contextBridge.exposeInMainWorld('mdkanban', {
  isElectron: true,
  platform: process.platform,
})
