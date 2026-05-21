import { app, BrowserWindow, ipcMain, desktopCapturer, session } from 'electron'
import path from 'path'

// ─── Config ───────────────────────────────────────────────────────────────────

const isDev = process.env['NODE_ENV'] !== 'production'
// Backend URL — in dev, the Express server runs on 3000
const BACKEND_URL = process.env['MEETING_BACKEND_URL'] ?? 'http://localhost:3000'

// The source the user has selected in the picker UI
let pendingSourceId: string | null = null

// ─── Window ───────────────────────────────────────────────────────────────────

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 960,
    height: 780,
    minWidth: 700,
    minHeight: 560,
    title: 'Gravador de Reunião',
    // titleBarStyle: 'hiddenInset', // Uncomment for macOS native look
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      // sandbox:false is required for desktopCapturer IPC
      sandbox: false,
    },
  })

  // ── intercept getDisplayMedia() and inject the user-selected source ──────
  // This is the key that makes Electron work without a manual browser picker.
  // 'loopback' captures system audio on Windows; on macOS it requires the
  // ScreenCaptureKit entitlement (see README for signing instructions).
  session.defaultSession.setDisplayMediaRequestHandler((_request, callback) => {
    if (!pendingSourceId) {
      // Fallback: let Electron show its own picker
      callback({})
      return
    }

    desktopCapturer
      .getSources({ types: ['screen', 'window'] })
      .then((sources) => {
        const source = sources.find((s) => s.id === pendingSourceId) ?? sources[0]
        pendingSourceId = null
        callback({
          video: source,
          // 'loopback' captures system audio on Windows.
          // macOS uses ScreenCaptureKit audio (loopback also works on newer Electron+macOS).
          audio: 'loopback',
        })
      })
      .catch(() => callback({}))
  })

  if (isDev) {
    void win.loadURL(`http://localhost:5173/reuniao`)
    win.webContents.openDevTools({ mode: 'detach' })
  } else {
    void win.loadFile(path.join(__dirname, '../client/index.html'), {
      hash: '/reuniao',
    })
  }

  return win
}

// ─── App lifecycle ────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// ─── IPC handlers ─────────────────────────────────────────────────────────────

// Return list of capturable sources with thumbnails
ipcMain.handle('meeting:get-sources', async () => {
  const sources = await desktopCapturer.getSources({
    types: ['screen', 'window'],
    thumbnailSize: { width: 240, height: 135 },
    fetchWindowIcons: true,
  })
  return sources.map((s) => ({
    id: s.id,
    name: s.name,
    thumbnail: s.thumbnail.toDataURL(),
    appIcon: s.appIcon?.toDataURL() ?? null,
  }))
})

// Store the selected source for the next getDisplayMedia() interception
ipcMain.handle('meeting:select-source', (_event, sourceId: string) => {
  pendingSourceId = sourceId
})

// Expose the backend URL to the renderer so it can reach /api/meeting/transcribe
ipcMain.handle('meeting:backend-url', () => BACKEND_URL)
