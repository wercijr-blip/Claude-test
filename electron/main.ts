import { app, BrowserWindow, ipcMain, session } from 'electron'
import { desktopCapturer } from 'electron'
import * as path from 'path'

let mainWindow: BrowserWindow | null = null
let pendingSourceId: string | null = null
const isDev = process.env['NODE_ENV'] === 'development'

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  // Intercept getDisplayMedia to inject the selected desktop source with loopback audio
  session.defaultSession.setDisplayMediaRequestHandler((_request, callback) => {
    if (pendingSourceId) {
      desktopCapturer.getSources({ types: ['window', 'screen'] }).then((sources) => {
        const source = sources.find((s) => s.id === pendingSourceId)
        if (source) {
          callback({ video: source, audio: 'loopback' })
        } else {
          callback({})
        }
        pendingSourceId = null
      })
    } else {
      callback({})
    }
  })

  if (isDev) {
    void mainWindow.loadURL('http://localhost:5173')
  } else {
    void mainWindow.loadFile(path.join(__dirname, '../src/index.html'))
  }
}

ipcMain.handle('meeting:get-sources', async () => {
  const sources = await desktopCapturer.getSources({
    types: ['window', 'screen'],
    thumbnailSize: { width: 320, height: 180 },
    fetchWindowIcons: true,
  })
  return sources.map((s) => ({
    id: s.id,
    name: s.name,
    thumbnailDataURL: s.thumbnail.toDataURL(),
  }))
})

ipcMain.handle('meeting:select-source', (_event, sourceId: string) => {
  pendingSourceId = sourceId
})

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
