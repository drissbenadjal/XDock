import { contextBridge } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  openVideoDialog: async () => {
    try {
      return await electronAPI.ipcRenderer.invoke('open-video-dialog')
    } catch (e) {
      console.error(e)
      return null
    }
  },
  createWallpaperWindow: async (videoPath, options = {}) => {
    try {
      return await electronAPI.ipcRenderer.invoke('create-wallpaper-window', videoPath, options)
    } catch (e) {
      console.error(e)
      return { success: false, error: String(e) }
    }
  },
  getFileIcon: async (filePath) => {
    try {
      return await electronAPI.ipcRenderer.invoke('get-file-icon', filePath)
    } catch (e) {
      console.error('getFileIcon', e)
      return null
    }
  },
  resolveShortcut: async (filePath) => {
    try {
      return await electronAPI.ipcRenderer.invoke('resolve-shortcut', filePath)
    } catch (e) {
      console.error('resolveShortcut', e)
      return null
    }
  },
  openFileDialog: async () => {
    try {
      return await electronAPI.ipcRenderer.invoke('open-file-dialog')
    } catch (e) {
      console.error('openFileDialog', e)
      return null
    }
  },
  openApp: async (filePath) => {
    try {
      return await electronAPI.ipcRenderer.invoke('open-app', filePath)
    } catch (e) {
      console.error('openApp', e)
      return { success: false, error: String(e) }
    }
  }
}

// open dock settings window
api.openDockSettings = async () => {
  try {
    console.log('preload: openDockSettings called')
    return await electronAPI.ipcRenderer.invoke('open-dock-settings')
  } catch (e) {
    console.error('openDockSettings', e)
    return null
  }
}

// Allow renderer to request window resize + center
api.setWindowSize = async (w, h, position = 'top') => {
  try {
    return await electronAPI.ipcRenderer.invoke('set-window-size-and-center', { w, h, position })
  } catch (e) {
    console.error('setWindowSize', e)
    return { success: false, error: String(e) }
  }
}

// read file and return data URL (useful for renderer preview when origin is http)
const fs = require('fs')
const path = require('path')
const mimeByExt = (ext) => {
  const map = {
    mp4: 'video/mp4',
    webm: 'video/webm',
    mov: 'video/quicktime',
    mkv: 'video/x-matroska',
    avi: 'video/x-msvideo'
  }
  return map[ext.replace(/\./g, '').toLowerCase()] || 'application/octet-stream'
}

api.readFileAsDataUrl = async (filePath) => {
  try {
    const b = await fs.promises.readFile(filePath)
    const ext = path.extname(filePath).slice(1)
    const mime = mimeByExt(ext)
    return `data:${mime};base64,${b.toString('base64')}`
  } catch (e) {
    console.error('readFileAsDataUrl', e)
    return null
  }
}

// read file as utf8 text (useful for parsing .url files)
api.readFileText = async (filePath) => {
  try {
    const s = await fs.promises.readFile(filePath, { encoding: 'utf8' })
    return s
  } catch (e) {
    console.error('readFileText', e)
    return null
  }
}

api.onWallpaperVideoPath = (cb) => {
  try {
    electronAPI.ipcRenderer.on('wallpaper-video-path', (event, p) => cb(p))
  } catch (e) {
    console.error(e)
  }
}

api.applyDockSettings = async (settings) => {
  try {
    return await electronAPI.ipcRenderer.invoke('apply-dock-settings', settings)
  } catch (e) {
    console.error('applyDockSettings', e)
    return null
  }
}

api.applyDockApps = async (apps) => {
  try {
    return await electronAPI.ipcRenderer.invoke('apply-dock-apps', apps)
  } catch (e) {
    console.error('applyDockApps', e)
    return null
  }
}

api.onDockApps = (cb) => {
  try {
    electronAPI.ipcRenderer.on('dock-apps', (event, apps) => cb(apps))
  } catch (e) {
    console.error('onDockApps', e)
  }
}

api.windowControl = async (action) => {
  try {
    return await electronAPI.ipcRenderer.invoke('window-control', action)
  } catch (e) {
    console.error('windowControl', e)
    return null
  }
}

api.onDockSettings = (cb) => {
  try {
    electronAPI.ipcRenderer.on('dock-settings', (event, s) => cb(s))
  } catch (e) {
    console.error('onDockSettings', e)
  }
}

api.onDockReset = (cb) => {
  try {
    electronAPI.ipcRenderer.on('dock-reset', () => cb())
  } catch (e) {
    console.error('onDockReset', e)
  }
}

// Reset dock to defaults (remove persisted apps and settings)
api.resetDock = async () => {
  try {
    return await electronAPI.ipcRenderer.invoke('reset-dock')
  } catch (e) {
    console.error('resetDock', e)
    return null
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  window.electron = electronAPI
  window.api = api
}
