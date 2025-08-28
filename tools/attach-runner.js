const { spawnSync } = require('child_process')
const { join } = require('path')
const fs = require('fs')

const projectDir = join(__dirname, 'AttachToDesktop')
const publishDir = join(projectDir, 'bin', 'Release', 'net6.0', 'publish')
const exePath = process.platform === 'win32' ? join(publishDir, 'AttachToDesktop.exe') : null

function hasDotnet() {
  const r = spawnSync('dotnet', ['--version'], { encoding: 'utf8' })
  return r.status === 0
}

function buildIfNeeded() {
  if (!exePath) return false
  if (fs.existsSync(exePath)) return true
  if (!hasDotnet()) return false
  const r = spawnSync(
    'dotnet',
    [
      'publish',
      projectDir,
      '-c',
      'Release',
      '-r',
      'win-x64',
      '--self-contained',
      'false',
      '/p:PublishSingleFile=false'
    ],
    { stdio: 'inherit' }
  )
  return r.status === 0
}

function runAttach(hwnd) {
  if (!exePath) return false
  if (!buildIfNeeded()) return false
  const r = spawnSync(exePath, [String(hwnd)], { encoding: 'utf8' })
  return r.status === 0
}

module.exports = { runAttach }
