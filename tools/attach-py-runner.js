const { spawnSync } = require('child_process')
const { join } = require('path')
const fs = require('fs')

const scriptPath = join(__dirname, 'attach_py.py')

function hasPython() {
  const r = spawnSync('python', ['--version'], { encoding: 'utf8' })
  if (r.status === 0) return true
  const r2 = spawnSync('python3', ['--version'], { encoding: 'utf8' })
  return r2.status === 0
}

function runAttach(hwnd) {
  if (!fs.existsSync(scriptPath)) return false
  if (!hasPython()) return false
  const py = spawnSync('python', [scriptPath, String(hwnd)], { encoding: 'utf8' })
  if (py.status !== 0) {
    // try python3
    const py2 = spawnSync('python3', [scriptPath, String(hwnd)], { encoding: 'utf8' })
    return py2.status === 0
  }
  return true
}

module.exports = { runAttach }
