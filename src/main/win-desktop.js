// Helper to attach an Electron BrowserWindow to the Windows desktop (WorkerW/Progman)
// Uses ffi-napi/ref-napi to call a few user32 APIs.
// WARNING: requires native modules (ffi-napi/ref-napi) and electron-rebuild for your Electron version.
const ffi = require('ffi-napi')
const ref = require('ref-napi')

const user32 = ffi.Library('user32', {
  FindWindowA: ['long', ['string', 'string']],
  FindWindowExA: ['long', ['long', 'long', 'string', 'string']],
  SendMessageA: ['long', ['long', 'uint32', 'long', 'long']],
  SetParent: ['long', ['long', 'long']],
  EnumWindows: ['bool', ['pointer', 'long']],
  GetClassNameA: ['int', ['long', 'char *', 'int']]
})

const refAlloc = (size) => Buffer.alloc(size)

function findWorkerW() {
  try {
    const progman = user32.FindWindowA('Progman', null)
    // Send 0x052C to Progman. This creates a WorkerW behind the desktop icons.
    user32.SendMessageA(progman, 0x052c, 0, 0)

    const buf = refAlloc(256)
    let found = 0

    const enumProc = ffi.Callback('bool', ['long', 'long'], function (hwnd, lParam) {
      try {
        buf.fill(0)
        user32.GetClassNameA(hwnd, buf, 256)
        const cls = ref.readCString(buf, 0)
        if (cls === 'WorkerW') {
          // Check if this WorkerW has a child SHELLDLL_DefView
          const shellView = user32.FindWindowExA(hwnd, 0, 'SHELLDLL_DefView', null)
          if (shellView) {
            found = hwnd
            return false // stop enumeration
          }
        }
      } catch (e) {
        // ignore
      }
      return true
    })

    user32.EnumWindows(enumProc, 0)
    return found
  } catch (e) {
    console.error('findWorkerW error', e)
    return 0
  }
}

function getHwndFromBrowserWindow(win) {
  try {
    const buf = win.getNativeWindowHandle()
    if (!buf) return 0
    // On x64 the handle is 8 bytes, on x86 it's 4 bytes
    if (buf.length >= 8) return Number(buf.readBigUInt64LE(0))
    return buf.readUInt32LE(0)
  } catch (e) {
    console.error('getHwndFromBrowserWindow error', e)
    return 0
  }
}

function attachWindowToDesktop(browserWindow) {
  try {
    const hwnd = getHwndFromBrowserWindow(browserWindow)
    if (!hwnd) return false
    const worker = findWorkerW()
    if (!worker) return false
    user32.SetParent(hwnd, worker)
    return true
  } catch (e) {
    console.error('attachWindowToDesktop error', e)
    return false
  }
}

module.exports = { attachWindowToDesktop }
