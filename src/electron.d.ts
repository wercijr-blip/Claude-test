interface DesktopSource {
  id: string
  name: string
  thumbnailDataURL: string
}

interface Window {
  electronAPI?: {
    isElectron: true
    getDesktopSources: () => Promise<DesktopSource[]>
    selectSource: (sourceId: string) => Promise<void>
  }
}
