// Type declarations for the Electron context bridge (electron/preload.ts).
// Only present when the app runs inside Electron.

export interface DesktopSource {
  id: string
  name: string
  thumbnail: string   // data URL
  appIcon: string | null
}

declare global {
  interface Window {
    electronAPI?: {
      isElectron: true
      getDesktopSources: () => Promise<DesktopSource[]>
      selectSource: (sourceId: string) => Promise<void>
    }
  }
}
