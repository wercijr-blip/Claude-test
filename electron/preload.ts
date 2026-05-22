import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true as const,

  getDesktopSources: () => ipcRenderer.invoke('meeting:get-sources'),

  selectSource: (sourceId: string) =>
    ipcRenderer.invoke('meeting:select-source', sourceId),
})
