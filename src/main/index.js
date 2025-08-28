import {
  app,
  shell,
  BrowserWindow,
  ipcMain,
  dialog,
  screen,
  Tray,
  Menu,
  nativeImage
} from 'electron'
// optional native helper to attach window to desktop on Windows
let attachWindowToDesktop = null
try {
  // require only if file exists and running on Windows
  if (process.platform === 'win32') {
    // use require to load CJS helper
    // prefer dotnet helper runner if available
    try {
      // prefer python runner if available
      try {
        attachWindowToDesktop = require('../tools/attach-py-runner').runAttach
      } catch {
        // fallback to dotnet runner
        attachWindowToDesktop = require('../tools/attach-runner').runAttach
      }
    } catch {
      // fallback to ffi-based helper
      attachWindowToDesktop = require('./win-desktop').attachWindowToDesktop
    }
  }
} catch {
  // ignore if native modules not installed
}
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

// Auto-updater (optional)
let autoUpdater = null
let updateIntervalHandle = null
try {
  // require here to avoid bundling issues in environments where it's not needed
  // electron-updater is present in package.json, but require safely
  // eslint-disable-next-line global-require
  const updater = require('electron-updater')
  autoUpdater = updater && updater.autoUpdater ? updater.autoUpdater : null
  if (autoUpdater) {
    try {
      autoUpdater.autoDownload = true
    } catch {
      /* ignore */
    }
  }
} catch (e) {
  console.debug('electron-updater not available')
}

// Auto-update helpers
function startAutoUpdatePolling(intervalMs = 60 * 1000) {
  try {
    if (!autoUpdater) return
    console.log('autoUpdater: checking for updates (initial)')
    autoUpdater.checkForUpdates().catch(() => {})
    // set interval
    if (updateIntervalHandle) clearInterval(updateIntervalHandle)
    updateIntervalHandle = setInterval(() => {
      try {
        console.log('autoUpdater: periodic check for updates')
        autoUpdater.checkForUpdates().catch(() => {})
      } catch {
        /* ignore */
      }
    }, intervalMs)
  } catch {
    console.debug('startAutoUpdatePolling failed')
  }
}

function stopAutoUpdatePolling() {
  try {
    if (updateIntervalHandle) {
      clearInterval(updateIntervalHandle)
      updateIntervalHandle = null
    }
  } catch {
    /* ignore */
  }
}

if (autoUpdater) {
  // listen for update events
  autoUpdater.on('error', (err) => console.error('autoUpdater error', err))
  autoUpdater.on('update-available', (info) => console.log('autoUpdater: update-available', info))
  autoUpdater.on('update-not-available', (info) =>
    console.log('autoUpdater: update-not-available', info)
  )
  autoUpdater.on('download-progress', (progress) =>
    console.log('autoUpdater: download-progress', progress && progress.percent)
  )
  autoUpdater.on('update-downloaded', (info) => {
    try {
      console.log('autoUpdater: update-downloaded, will quit and install now')
      // quit and install automatically
      try {
        autoUpdater.quitAndInstall()
      } catch {
        try {
          // fallback for some versions
          autoUpdater.quitAndInstall(true, true)
        } catch {
          console.error('autoUpdater.quitAndInstall failed')
        }
      }
    } catch {
      console.error('update-downloaded handler failed')
    }
  })
}

function createWindow() {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    // Make the main window borderless and transparent
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    resizable: false,
    maximizable: false,
    skipTaskbar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  // Prevent user manual resize (we'll resize programmatically from renderer)
  try {
    mainWindow.setResizable(false)
  } catch (e) {
    console.debug('setResizable failed', e)
  }

  mainWindow.on('ready-to-show', () => {
    // postpone showing until we measured content size in did-finish-load
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // Resize main window to fit content (dock) after renderer loaded
  mainWindow.webContents.on('did-finish-load', async () => {
    try {
      const size = await mainWindow.webContents.executeJavaScript(`(() => {
        try {
          const el = document.querySelector('.dock') || document.querySelector('.dock-wrap') || document.documentElement
          const r = el.getBoundingClientRect ? el.getBoundingClientRect() : { width: el.scrollWidth || el.clientWidth, height: el.scrollHeight || el.clientHeight }
          return { w: Math.max(Math.ceil(r.width) + 24, 120), h: Math.max(Math.ceil(r.height) + 16, 48) }
        } catch (e) { return { w: 320, h: 80 } }
      })()`)

      if (size && size.w && size.h) {
        mainWindow.setContentSize(size.w, size.h)
        const displays = screen.getAllDisplays()
        const display = displays[0] || screen.getPrimaryDisplay()
        const x = display.bounds.x + Math.floor((display.bounds.width - size.w) / 2)
        const y = display.bounds.y + 8
        mainWindow.setPosition(x, y)
      }
    } catch (err) {
      console.error('fit-content resize failed', err)
    }
    try {
      mainWindow.show()
    } catch (err) {
      console.error('mainWindow.show failed', err)
    }
    // Try to attach the main window to the desktop (behind other windows)
    try {
      if (attachWindowToDesktop) {
        console.log('attachWindowToDesktop: helper found for main window, calling...')
        const ok = attachWindowToDesktop(mainWindow)
        console.log('attachWindowToDesktop (main) result=', ok)
      } else {
        console.log(
          'attachWindowToDesktop: no helper available for main window; window will remain normal (not forced behind).'
        )
      }
    } catch (err) {
      console.error('attachWindowToDesktop call failed for main window', err)
    }
  })

  // return the created window to the caller
  return mainWindow
}

// Helper to open the settings window from main process
async function openSettingsWindow() {
  try {
    // reuse single settings window if already open
    if (global.settingsWindow && !global.settingsWindow.isDestroyed()) {
      try {
        global.settingsWindow.show()
        global.settingsWindow.focus()
        return { success: true }
      } catch (err) {
        console.error('focus existing settingsWindow failed', err)
      }
    }

    const { BrowserWindow } = require('electron')
    const win = new BrowserWindow({
      width: 900,
      height: 640,
      minWidth: 520,
      minHeight: 420,
      resizable: true,
      minimizable: false,
      maximizable: true,
      modal: false,
      show: true, // show immediately to avoid invisible window
      autoHideMenuBar: true,
      frame: true,
      transparent: false,
      backgroundColor: '#121212',
      title: 'XDock — Settings',
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        sandbox: false
      }
    })

    global.settingsWindow = win
    win.on('closed', () => {
      try {
        global.settingsWindow = null
      } catch (e) {
        /* ignore */
      }
    })

    try {
      win.setTitle('XDock — Settings')
    } catch {
      /* ignore */
    }

    // load URL but don't block showing the window; catch load errors
    try {
      if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
        await win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}?dockSettings=1`)
      } else {
        await win.loadURL(`file://${join(__dirname, '../renderer/index.html')}?dockSettings=1`)
      }
    } catch (loadErr) {
      console.error('loadURL for settings window failed', loadErr)
    }

    // send persisted settings if available (non-blocking)
    try {
      const fs = require('fs')
      const path = require('path')
      const userData = app.getPath('userData')
      const cfgPath = path.join(userData, 'dock-settings.json')
      if (fs.existsSync(cfgPath)) {
        fs.promises
          .readFile(cfgPath, 'utf8')
          .then((raw) => {
            try {
              const parsed = JSON.parse(raw)
              win.webContents.send('dock-settings', parsed)
            } catch (err) {
              console.error('send dock-settings to settings window failed', err)
            }
          })
          .catch((err) => console.error('read persisted dock-settings failed', err))
      }
    } catch (err) {
      console.error('load persisted dock-settings for settings window flow failed', err)
    }

    return { success: true }
  } catch (e) {
    console.error('openSettingsWindow failed', e)
    return { success: false, error: String(e) }
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.xdock')
  try {
    app.name = 'XDock'
  } catch {
    /* ignore */
  }

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))

  // Open file dialog to pick a video
  ipcMain.handle('open-video-dialog', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        { name: 'Videos', extensions: ['mp4', 'webm', 'mov', 'mkv', 'avi'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    })
    if (result.canceled || !result.filePaths || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  // Open a generic file dialog (used by dock to add apps)
  ipcMain.handle('open-file-dialog', async () => {
    try {
      const result = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [{ name: 'All Files', extensions: ['*'] }]
      })
      if (result.canceled || !result.filePaths || result.filePaths.length === 0) return null
      return result.filePaths[0]
    } catch (err) {
      console.error('open-file-dialog failed', err)
      return null
    }
  })

  // Return file icon as data URL (uses Electron app.getFileIcon)
  ipcMain.handle('get-file-icon', async (event, filePath) => {
    try {
      const pathModule = require('path')
      const fs = require('fs')

      // normalize filePath (strip file://, decodeURI)
      try {
        if (typeof filePath === 'string' && filePath.startsWith('file://')) {
          filePath = decodeURIComponent(filePath.replace(/^file:\/\//, ''))
        }
      } catch (e) {
        /* ignore */
      }

      const ext = (pathModule.extname(filePath) || '').toLowerCase()

      // If it's a Windows shortcut, try to resolve target first
      if (ext === '.lnk') {
        try {
          const info = shell.readShortcutLink(filePath)
          if (info && info.target) {
            filePath = info.target
          }
        } catch (e) {
          console.debug('readShortcutLink failed in get-file-icon', e)
        }
      }

      // If it's a .url file, parse IconFile= from it
      if (ext === '.url') {
        try {
          const content = await fs.promises.readFile(filePath, 'utf8')
          const m = content.match(/IconFile=(.*)\r?\n/i)
          if (m && m[1]) {
            const iconPath = m[1].trim()
            // if iconPath is relative, resolve against .url dir
            const resolved = pathModule.isAbsolute(iconPath)
              ? iconPath
              : pathModule.join(pathModule.dirname(filePath), iconPath)
            try {
              const nimg2 = await app.getFileIcon(resolved, { size: 'normal' })
              try {
                const buf = nimg2.toPNG()
                return `data:image/png;base64,${buf.toString('base64')}`
              } catch (e) {
                // fallback to toDataURL
                try {
                  return nimg2.toDataURL()
                } catch (ee) {
                  console.debug('url icon toDataURL failed', ee)
                }
              }
            } catch (e) {
              try {
                const alt = nativeImage.createFromPath(resolved)
                const buf = alt.toPNG()
                return buf ? `data:image/png;base64,${buf.toString('base64')}` : null
              } catch (ee) {
                console.debug('url icon load fallback failed', ee)
              }
            }
          }
        } catch (e) {
          console.debug('read .url file failed', e)
        }
      }

      // Try Electron's getFileIcon for the (possibly resolved) path
      try {
        const nimg = await app.getFileIcon(filePath, { size: 'normal' })
        try {
          const buf = nimg.toPNG()
          return `data:image/png;base64,${buf.toString('base64')}`
        } catch (e) {
          // fallback to toDataURL
          try {
            return nimg.toDataURL()
          } catch (ee) {
            console.error('toPNG/toDataURL both failed', ee)
          }
        }
      } catch (err) {
        console.debug('app.getFileIcon failed, will try nativeImage.createFromPath', err)
      }

      // Fallback: try nativeImage.createFromPath
      try {
        const alt = nativeImage.createFromPath(filePath)
        try {
          const buf = alt.toPNG()
          return buf ? `data:image/png;base64,${buf.toString('base64')}` : null
        } catch (e) {
          try {
            return alt.toDataURL()
          } catch (ee) {
            console.error('nativeImage fallback toPNG/toDataURL failed', ee)
          }
        }
      } catch (e) {
        console.error('nativeImage.createFromPath failed', e)
      }

      return null
    } catch (err) {
      console.error('get-file-icon handler failed', err)
      return null
    }
  })

  // Resolve Windows shortcut (.lnk) to its target path
  ipcMain.handle('resolve-shortcut', async (event, filePath) => {
    try {
      if (process.platform === 'win32') {
        try {
          const info = shell.readShortcutLink(filePath)
          if (info && info.target) return info.target
        } catch (e) {
          console.error('readShortcutLink failed', e)
        }
      }
      return null
    } catch (err) {
      console.error('resolve-shortcut failed', err)
      return null
    }
  })

  // Start auto-update polling if available
  try {
    if (autoUpdater) startAutoUpdatePolling(60 * 1000)
  } catch {
    /* ignore */
  }

  // Open a file/application by path
  ipcMain.handle('open-app', async (event, filePath) => {
    try {
      const res = await shell.openPath(filePath)
      if (typeof res === 'string' && res.length > 0) {
        // error string returned
        return { success: false, error: res }
      }
      return { success: true }
    } catch (e) {
      console.error('open-app failed', e)
      return { success: false, error: String(e) }
    }
  })

  // Resize and center main window (used by dock to follow its content)
  ipcMain.handle('set-window-size-and-center', async (event, size) => {
    try {
      const bw = BrowserWindow.fromWebContents(event.sender)
      if (!bw) return { success: false, error: 'no-window' }
      const w = Math.max(Math.ceil(size.w || 0), 120)
      const h = Math.max(Math.ceil(size.h || 0), 40)
      try {
        // optional position: 'top' or 'bottom'
        const position = size?.position || 'top'
        bw.setContentSize(w, h)
        const displays = screen.getAllDisplays()
        const display = displays[0] || screen.getPrimaryDisplay()
        const x = display.bounds.x + Math.floor((display.bounds.width - w) / 2)
        let y = display.bounds.y + 8
        if (position === 'bottom') {
          // place above bottom with small margin
          y = display.bounds.y + display.bounds.height - h - 8
        }
        bw.setPosition(x, y)
      } catch (e) {
        console.error('set-window-size-and-center failed', e)
      }
      return { success: true }
    } catch (err) {
      console.error('set-window-size-and-center handler failed', err)
      return { success: false, error: String(err) }
    }
  })

  // Reset dock state: remove persisted settings file and broadcast empty settings + apps
  ipcMain.handle('reset-dock', async () => {
    try {
      const fs = require('fs')
      const path = require('path')
      const userData = app.getPath('userData')
      const cfgPath = path.join(userData, 'dock-settings.json')
      try {
        if (fs.existsSync(cfgPath)) await fs.promises.unlink(cfgPath)
      } catch (_err) {
        console.error('failed to remove dock-settings.json', _err)
      }

      // Broadcast reset to all windows; renderer will clear localStorage for apps/settings
      BrowserWindow.getAllWindows().forEach((w) => {
        try {
          w.webContents.send('dock-reset')
        } catch (_err) {
          /* ignore */
        }
      })
      return { success: true }
    } catch (_err) {
      console.error('reset-dock failed', _err)
      return { success: false, error: String(_err) }
    }
  })

  // Open a small dock settings window (delegated)
  ipcMain.handle('open-dock-settings', async () => {
    try {
      return await openSettingsWindow()
    } catch (e) {
      console.error('open-dock-settings failed', e)
      return { success: false, error: String(e) }
    }
  })

  // Apply dock settings and broadcast to renderer windows; persist to userData
  ipcMain.handle('apply-dock-settings', async (event, settings) => {
    try {
      const fs = require('fs')
      const path = require('path')
      const userData = app.getPath('userData')
      const cfgPath = path.join(userData, 'dock-settings.json')
      try {
        await fs.promises.writeFile(cfgPath, JSON.stringify(settings || {}, null, 2), 'utf8')
      } catch (e) {
        console.error('write settings failed', e)
      }

      // Apply startAtLogin immediately when requested
      try {
        if (typeof settings?.startAtLogin !== 'undefined') {
          try {
            app.setLoginItemSettings({ openAtLogin: !!settings.startAtLogin })
          } catch (e) {
            console.error('setLoginItemSettings failed', e)
          }
        }
      } catch (e) {
        console.error('apply startAtLogin flow failed', e)
      }
      // broadcast
      BrowserWindow.getAllWindows().forEach((w) => {
        try {
          w.webContents.send('dock-settings', settings)
        } catch (e) {
          /* ignore */
        }
      })
      return { success: true }
    } catch (e) {
      console.error('apply-dock-settings handler failed', e)
      return { success: false, error: String(e) }
    }
  })

  // Create a wallpaper window that plays a local video file
  ipcMain.handle('create-wallpaper-window', async (event, videoPath, options = {}) => {
    try {
      // choose display (default primary)
      const displays = screen.getAllDisplays()
      const display = displays[options.displayIndex] || screen.getPrimaryDisplay()

      const win = new BrowserWindow({
        x: display.bounds.x,
        y: display.bounds.y,
        width: display.bounds.width,
        height: display.bounds.height,
        frame: false,
        transparent: true,
        resizable: false,
        movable: false,
        focusable: false,
        skipTaskbar: true,
        hasShadow: false,
        fullscreen: true,
        webPreferences: {
          preload: join(__dirname, '../preload/index.js'),
          sandbox: false
        }
      })

      // make the window ignore mouse so desktop is clickable
      win.setIgnoreMouseEvents(true)

      // Load renderer and pass video path via query
      const videoUrl = encodeURIComponent(videoPath)
      if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
        await win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}?wallpaper=1&video=${videoUrl}`)
      } else {
        await win.loadURL(
          `file://${join(__dirname, '../renderer/index.html')}?wallpaper=1&video=${videoUrl}`
        )
      }

      // After page loads, send the original path (so renderer can use fs read)
      win.webContents.on('did-finish-load', () => {
        try {
          win.webContents.send('wallpaper-video-path', videoPath)
          // Try to attach to desktop (Windows) if helper is available
          try {
            if (!attachWindowToDesktop) {
              console.log('attachWindowToDesktop: no helper available')
            } else {
              console.log('attachWindowToDesktop: helper found, calling...')
              const ok = attachWindowToDesktop(win)
              console.log('attachWindowToDesktop: result=', ok)
            }
          } catch (e) {
            console.error('attachWindowToDesktop call failed', e)
          }
        } catch (e) {
          console.error('send wallpaper-video-path', e)
        }
      })

      // Return success
      return { success: true }
    } catch (err) {
      console.error('create-wallpaper-window', err)
      return { success: false, error: String(err) }
    }
  })

  const mainWindow = createWindow()

  // Load persisted dock settings (if any) and send to the main window so renderer can apply them
  try {
    const fs = require('fs')
    const path = require('path')
    const userData = app.getPath('userData')
    const cfgPath = path.join(userData, 'dock-settings.json')
    if (fs.existsSync(cfgPath)) {
      try {
        const raw = await fs.promises.readFile(cfgPath, 'utf8')
        const parsed = JSON.parse(raw)
        try {
          // ensure we send after the initial renderer load
          mainWindow.webContents.once('did-finish-load', () => {
            try {
              mainWindow.webContents.send('dock-settings', parsed)
            } catch (err) {
              console.error('send dock-settings on startup failed', err)
            }
          })
        } catch (err) {
          console.error('apply persisted settings failed', err)
        }
      } catch (err) {
        console.error('read persisted dock-settings failed', err)
      }
    }
  } catch (err) {
    console.error('load persisted dock-settings flow failed', err)
  }

  // Create system tray icon and menu so the app is accessible from the notification area
  try {
    // prefer the bundled icon; create nativeImage if possible
    let trayIcon = null
    try {
      trayIcon = nativeImage.createFromPath(icon)
      // resize for tray if the image is large
      if (trayIcon && trayIcon.getSize) {
        const s = trayIcon.getSize()
        if (s.width > 32) trayIcon = trayIcon.resize({ width: 32, height: 32 })
      }
    } catch {
      trayIcon = null
    }
    if (!trayIcon) {
      try {
        trayIcon = nativeImage.createFromPath(join(__dirname, '../renderer/assets/electron.svg'))
      } catch {
        trayIcon = null
      }
    }

    const tray = trayIcon
      ? new Tray(trayIcon)
      : new Tray(process.platform === 'win32' ? undefined : '')

    const buildMenu = () =>
      Menu.buildFromTemplate([
        {
          label: 'Settings',
          click: async () => {
            try {
              await openSettingsWindow()
            } catch (e) {
              console.error('tray open settings failed', e)
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Afficher / Cacher',
          click: () => {
            try {
              if (mainWindow.isVisible()) mainWindow.hide()
              else {
                mainWindow.show()
                mainWindow.focus()
              }
            } catch (e) {
              console.error('tray toggle', e)
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Quitter',
          click: () => {
            app.quit()
          }
        }
      ])

    try {
      tray.setToolTip('Rocket Dock')
      tray.setContextMenu(buildMenu())
      tray.on('click', () => {
        try {
          if (mainWindow.isVisible()) mainWindow.hide()
          else {
            mainWindow.show()
            mainWindow.focus()
          }
        } catch (e) {
          console.error('tray click', e)
        }
      })

      app.on('before-quit', () => {
        try {
          tray.destroy()
        } catch {
          /* ignore */
        }
      })
    } catch (e) {
      console.error('tray setup failed', e)
    }
  } catch (err) {
    console.error('create tray failed', err)
  }

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Cleanup on quit
app.on('before-quit', () => {
  try {
    stopAutoUpdatePolling()
  } catch {
    /* ignore */
  }
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
