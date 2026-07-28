import { app, BrowserWindow } from 'electron'
import path from 'node:path'

// Permite BGM e áudios iniciarem sem gesto do usuário
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')

const isDev = Boolean(process.env.VITE_DEV_SERVER_URL)

function createWindow() {
  const win = new BrowserWindow({
    width: 960,
    height: 720,
    minWidth: 720,
    minHeight: 560,
    title: 'Bradley Typing',
    backgroundColor: '#e8eef6',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    void win.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    void win.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
