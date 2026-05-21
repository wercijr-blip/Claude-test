import { contextBridge, ipcRenderer } from 'electron'

export interface DesktopSource {
  id: string
  name: string
  thumbnail: string
  appIcon: string | null
}

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true as const,

  // List all capturable windows and screens
  getDesktopSources: (): Promise<DesktopSource[]> =>
    ipcRenderer.invoke('meeting:get-sources'),

  // Tell the main process which source to use for the next getDisplayMedia() call
  selectSource: (sourceId: string): Promise<void> =>
    ipcRenderer.invoke('meeting:select-source', sourceId),
})
