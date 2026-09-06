/* Contract for window.mdkanban, exposed by electron/preload.ts.
 * Used by the renderer Electron backend (renderer-electron-backend card). */

export interface ElectronProject {
  id: string
  root: string
  name: string
}

export interface ElectronFile {
  relPath: string
  fileName: string
  workspace: string
  content: string
}

export interface MdkanbanApi {
  isElectron: true
  platform: string
  pickDirectory: () => Promise<ElectronProject | null>
  listProjects: () => Promise<ElectronProject[]>
  removeProject: (id: string) => Promise<void>
  scanProject: (id: string) => Promise<ElectronFile[]>
  readFile: (id: string, relPath: string) => Promise<string>
  writeFile: (id: string, relPath: string, content: string) => Promise<void>
  deleteFile: (id: string, relPath: string) => Promise<void>
}

declare global {
  interface Window {
    mdkanban?: MdkanbanApi
  }
}

export function getElectronApi(): MdkanbanApi | null {
  return typeof window !== 'undefined' && window.mdkanban?.isElectron ? window.mdkanban : null
}
