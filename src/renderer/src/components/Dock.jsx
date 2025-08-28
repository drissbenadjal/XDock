import { useState, useEffect, useCallback } from 'react'
import explorerIcon from '../assets/electron.svg'
import { MdAdd, MdSettings } from 'react-icons/md'
// no default apps; user will add apps via drag & drop

export default function Dock() {
  const stripExt = (p) => {
    try {
      if (!p) return ''
      const name = (p + '').split(/[\\/]/).pop()
      return name.replace(/\.[^/.]+$/, '')
    } catch {
      return p
    }
  }
  const [hover, setHover] = useState(null)
  const [appsState, setAppsState] = useState(() => {
    try {
      const raw = localStorage.getItem('dock.apps')
      return raw ? JSON.parse(raw) : []
    } catch {
      return []
    }
  })
  const [draggingId, setDraggingId] = useState(null)
  const [dockSettings, setDockSettings] = useState(() => {
    try {
      const raw = localStorage.getItem('dock.settings')
      return raw
        ? JSON.parse(raw)
        : { position: 'top', background: 'rgba(30,30,30,0.6)', borderRadius: 20 }
    } catch {
      return { position: 'top', background: 'rgba(30,30,30,0.6)', borderRadius: 20 }
    }
  })
  // no context menu in this build; keep settings as a fixed icon

  const onClick = async (app) => {
    try {
      console.log('open request for', app && app.path)
      if (app && app.path) {
        try {
          if (window.api && window.api.openApp) {
            const res = await window.api.openApp(app.path)
            console.log('openApp result', res)
            if (res && res.success) {
              return
            }
            console.warn('openApp returned error', res)
          }
        } catch (e) {
          console.error('openApp API error', e)
        }
      }
      if (app.action) app.action()
    } catch (e) {
      console.error(e)
    }
  }

  const saveApps = (list) => {
    setAppsState(list)
    try {
      localStorage.setItem('dock.apps', JSON.stringify(list))
    } catch (e) {
      console.error('saveApps', e)
    }
  }

  const onDrop = async (e) => {
    e.preventDefault()
    console.log('onDrop event', {
      types: e.dataTransfer && e.dataTransfer.types,
      filesLength: e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length,
      itemsLength: e.dataTransfer && e.dataTransfer.items && e.dataTransfer.items.length
    })

    // internal reorder finalization
    try {
      const internalId =
        e.dataTransfer && e.dataTransfer.getData && e.dataTransfer.getData('text/app-id')
      if (internalId) {
        saveApps(appsState)
        setDraggingId(null)
        return
      }
    } catch (err) {
      console.debug('internalId check failed', err)
    }

    // Extract path from dataTransfer
    let path = null
    try {
      const dt = e.dataTransfer
      if (dt) {
        // prefer files[] (works when dragging from Explorer)
        if (dt.files && dt.files.length > 0) {
          const f = dt.files[0]
          if (f && f.path) path = f.path
        }

        // fallback to items (uri-list or file entries)
        if (!path && dt.items && dt.items.length > 0) {
          for (let i = 0; i < dt.items.length; i++) {
            const it = dt.items[i]
            if (it.kind === 'file' && it.getAsFile) {
              try {
                const file = it.getAsFile()
                if (file && file.path) {
                  path = file.path
                  break
                }
              } catch (err) {
                console.debug('item.getAsFile failed', err)
              }
            }

            if (it.kind === 'string') {
              try {
                const s = await new Promise((res) => it.getAsString(res))
                if (s && s.indexOf('file://') !== -1) {
                  const url = s.trim().split(/\r?\n/)[0]
                  try {
                    const decoded = decodeURIComponent(url.replace(/^file:\/\//, ''))
                    if (decoded) {
                      path = decoded
                      break
                    }
                  } catch (err) {
                    console.debug('decoded path parse skipped', err)
                  }
                }
              } catch (err) {
                console.debug('item.getAsString skipped', err)
              }
            }
          }
        }
      }
    } catch (err) {
      console.error('extract path from dataTransfer failed', err)
    }

    // fallback to files list again
    if (!path) {
      const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]
      if (file) path = file.path
    }

    if (!path) {
      // build summary for debugging
      const summary = []
      try {
        const dt = e.dataTransfer
        if (dt) {
          if (dt.files && dt.files.length > 0) {
            for (let i = 0; i < dt.files.length; i++) {
              const f = dt.files[i]
              summary.push(
                `file[${i}]=${f.name}|path=${f.path || '<no-path>'}|type=${f.type || '<no-type>'}`
              )
            }
          }
          if (dt.items && dt.items.length > 0) {
            for (let i = 0; i < dt.items.length; i++) {
              const it = dt.items[i]
              summary.push(`item[${i}]=kind=${it.kind}|type=${it.type || '<no-type>'}`)
            }
          }
          if (dt.getData) {
            try {
              const dd =
                dt.getData('text/uri-list') || dt.getData('DownloadURL') || dt.getData('text/plain')
              if (dd) summary.push(`getData:'${dd.slice(0, 200)}'`)
            } catch (err) {
              console.debug('getData read skipped', err)
            }
          }
        }
      } catch (err) {
        console.debug('dataTransfer summary failed', err)
      }
      console.warn('Aucun chemin détecté lors du drop.', summary.join(' | '))
      return
    }

    // On Windows, resolve .lnk shortcuts if necessary
    try {
      if (path.toLowerCase().endsWith('.lnk') && window.api && window.api.resolveShortcut) {
        try {
          const resolved = await window.api.resolveShortcut(path)
          if (resolved) path = resolved
        } catch (err) {
          console.debug('resolveShortcut call failed', err)
        }
      }
    } catch (err) {
      console.error('shortcut resolve flow failed', err)
    }

    // ask main for file icon
    let iconData = null
    try {
      if (window.api && window.api.getFileIcon) {
        iconData = await window.api.getFileIcon(path)
      }
    } catch (err) {
      console.error('getFileIcon failed', err)
    }

    if (iconData && typeof iconData === 'string' && !iconData.startsWith('data:')) {
      try {
        if (window.api && window.api.readFileAsDataUrl) {
          const converted = await window.api.readFileAsDataUrl(iconData)
          if (converted) iconData = converted
        }
      } catch (e) {
        console.debug('convert icon path to dataUrl failed', e)
      }
    }

    const entry = {
      id: 'app-' + Date.now(),
      label: stripExt(path) || 'app',
      path,
      icon: iconData || explorerIcon
    }
    const next = [...appsState, entry]
    saveApps(next)
    console.log('app added', entry)
    // added silently
  }

  // helper to add a path programmatically (used by window drop handler and dialog)
  const addPathToDock = useCallback(
    async (rawPath) => {
      if (!rawPath) return
      let path = rawPath
      try {
        if (path.toLowerCase().endsWith('.lnk') && window.api && window.api.resolveShortcut) {
          try {
            const resolved = await window.api.resolveShortcut(path)
            if (resolved) path = resolved
          } catch (err) {
            console.debug('resolveShortcut call failed', err)
          }
        }
      } catch (err) {
        console.error('shortcut resolve flow failed', err)
      }

      // get icon
      let iconData = null
      try {
        if (window.api && window.api.getFileIcon) iconData = await window.api.getFileIcon(path)
      } catch (err) {
        console.error('getFileIcon failed', err)
      }

      if (iconData && typeof iconData === 'string' && !iconData.startsWith('data:')) {
        try {
          if (window.api && window.api.readFileAsDataUrl) {
            const converted = await window.api.readFileAsDataUrl(iconData)
            if (converted) iconData = converted
          }
        } catch (e) {
          console.debug('convert icon path to dataUrl failed', e)
        }
      }

      const entry = {
        id: 'app-' + Date.now(),
        label: stripExt(path) || 'app',
        path,
        icon: iconData || explorerIcon
      }
      const next = [...appsState, entry]
      saveApps(next)
      console.log('app added via window drop or dialog', entry)
      // added silently
    },
    [appsState]
  )

  useEffect(() => {
    // apply initial settings styles
    try {
      const el = document.querySelector('.dock')
      if (el && dockSettings) {
        el.style.background = dockSettings.background || ''
        el.style.borderRadius = (dockSettings.borderRadius || 20) + 'px'
      }
      // position
      const wrap = document.querySelector('.dock-wrap')
      if (wrap) {
        if (dockSettings.position === 'bottom') {
          wrap.style.top = ''
          wrap.style.bottom = '10px'
        } else {
          wrap.style.bottom = ''
          wrap.style.top = '10px'
        }
      }
    } catch (e) {
      console.debug('apply initial dock settings failed', e)
    }
    // global handlers to catch drops that may not reach the dock element
    const onWindowDragOver = (ev) => {
      try {
        ev.preventDefault()
      } catch {
        /* ignore */
      }
    }
    const onWindowDrop = async (ev) => {
      try {
        ev.preventDefault()
        console.log('window drop', {
          types: ev.dataTransfer && ev.dataTransfer.types,
          files: ev.dataTransfer && ev.dataTransfer.files && ev.dataTransfer.files.length
        })
        // try files first
        if (ev.dataTransfer && ev.dataTransfer.files && ev.dataTransfer.files.length > 0) {
          const f = ev.dataTransfer.files[0]
          if (f && f.path) {
            await addPathToDock(f.path)
            return
          }
        }
        // try uri-list
        if (ev.dataTransfer && ev.dataTransfer.getData) {
          try {
            const dd =
              ev.dataTransfer.getData('text/uri-list') ||
              ev.dataTransfer.getData('DownloadURL') ||
              ev.dataTransfer.getData('text/plain')
            if (dd && dd.indexOf('file://') !== -1) {
              const url = dd.trim().split(/\r?\n/)[0]
              try {
                const decoded = decodeURIComponent(url.replace(/^file:\/\//, ''))
                if (decoded) {
                  await addPathToDock(decoded)
                  return
                }
              } catch (e) {
                console.debug('decode failed', e)
              }
            }
          } catch (e) {
            console.debug('getData read skipped', e)
          }
        }
        // no path found
        console.warn(
          'Aucun chemin détecté (window drop). Essayez le bouton + ou glissez un fichier directement.'
        )
      } catch (err) {
        console.error('window drop handler failed', err)
      }
    }

    window.addEventListener('dragover', onWindowDragOver)
    window.addEventListener('drop', onWindowDrop)
    return () => {
      window.removeEventListener('dragover', onWindowDragOver)
      window.removeEventListener('drop', onWindowDrop)
    }
  }, [appsState, addPathToDock])

  const addViaDialog = async () => {
    try {
      if (window.api && window.api.openFileDialog) {
        const p = await window.api.openFileDialog()
        if (!p) return
        // resolve .lnk if needed
        let final = p
        try {
          if (final.toLowerCase().endsWith('.lnk') && window.api && window.api.resolveShortcut) {
            const r = await window.api.resolveShortcut(final)
            if (r) final = r
          }
        } catch (e) {
          console.debug('resolve shortcut failed', e)
        }
        // fetch icon
        let iconData = null
        try {
          if (window.api && window.api.getFileIcon) iconData = await window.api.getFileIcon(final)
        } catch (e) {
          console.error('getFileIcon dialog', e)
        }
        if (iconData && typeof iconData === 'string' && !iconData.startsWith('data:')) {
          try {
            if (window.api && window.api.readFileAsDataUrl) {
              const converted = await window.api.readFileAsDataUrl(iconData)
              if (converted) iconData = converted
            }
          } catch (e) {
            console.debug('convert icon path to dataUrl failed', e)
          }
        }

        const entry = {
          id: 'app-' + Date.now(),
          label: stripExt(final) || stripExt(final.split(/[\\/]/).pop()),
          path: final,
          icon: iconData || explorerIcon
        }
        const next = [...appsState, entry]
        saveApps(next)
      }
    } catch (e) {
      console.error('addViaDialog', e)
    }
  }

  // animRef removed (no longer used)

  // animateWindowSize removed — window resizing handled by ResizeObserver directly

  // context menu removed: no openContextMenu / closeContextMenu helpers

  const handleOpenSettings = async () => {
    try {
      console.log('renderer: handleOpenSettings calling api.openDockSettings')
      if (window.api && window.api.openDockSettings) {
        const res = await window.api.openDockSettings()
        console.log('renderer: openDockSettings result', res)
      }
    } catch {
      console.error('openDockSettings')
    }
  }

  const onDragOver = (e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }

  const reorder = (overId) => {
    if (!draggingId || draggingId === overId) return
    const fromIndex = appsState.findIndex((x) => x.id === draggingId)
    const toIndex = appsState.findIndex((x) => x.id === overId)
    if (fromIndex === -1 || toIndex === -1) return
    const next = [...appsState]
    const [moved] = next.splice(fromIndex, 1)
    next.splice(toIndex, 0, moved)
    setAppsState(next)
  }

  // Observe dock size and inform main to resize and center the window
  useEffect(() => {
    let observer = null
    let to = null
    try {
      const el = document.querySelector('.dock') || document.querySelector('.dock-wrap')
      if (!el || typeof window === 'undefined' || !window.api || !window.api.setWindowSize) return
      observer = new ResizeObserver((entries) => {
        try {
          if (!entries || entries.length === 0) return
          const target = entries[0].target
          const dockRect = target.getBoundingClientRect()
          const w = Math.max(Math.ceil(dockRect.width) + 24, 120)
          // set height exactly to dock content height plus a small margin
          const h = Math.max(Math.ceil(dockRect.height) + 16, 40)
          // debounce rapid changes
          if (to) clearTimeout(to)
          to = setTimeout(() => {
            try {
              // send current position so main can place top or bottom
              const pos = (dockSettings && dockSettings.position) || 'top'
              window.api.setWindowSize(w, h, pos)
            } catch (e) {
              console.debug('setWindowSize call failed')
            }
          }, 100)
        } catch {
          console.debug('ResizeObserver callback failed')
        }
      })
      observer.observe(el)
    } catch {
      console.debug('dock resize observer failed')
    }
    return () => {
      try {
        if (observer) observer.disconnect()
        if (to) clearTimeout(to)
      } catch {
        /* ignore cleanup errors */
      }
    }
  }, [appsState, dockSettings])

  useEffect(() => {
    // listen to settings from main
    try {
      if (window.api && window.api.onDockSettings) {
        window.api.onDockSettings((s) => {
          try {
            if (!s) return
            setDockSettings(s)
            localStorage.setItem('dock.settings', JSON.stringify(s))
            // apply
            const el = document.querySelector('.dock')
            if (el) {
              el.style.background = s.background || ''
              el.style.borderRadius = (s.borderRadius || 20) + 'px'
            }
            const wrap = document.querySelector('.dock-wrap')
            if (wrap) {
              if (s.position === 'bottom') {
                wrap.style.top = ''
                wrap.style.bottom = '10px'
              } else {
                wrap.style.bottom = ''
                wrap.style.top = '10px'
              }
            }
          } catch (e) {
            console.debug('apply dock settings (on event) failed', e)
          }
        })
      }
    } catch (e) {
      console.debug('subscribe onDockSettings failed', e)
    }
    // listen to reset requests from main via preload API
    try {
      if (window.api && window.api.onDockReset) {
        window.api.onDockReset(() => {
          try {
            localStorage.removeItem('dock.apps')
            localStorage.removeItem('dock.settings')
            setAppsState([])
            const def = { position: 'top', background: 'rgba(30,30,30,0.6)', borderRadius: 20 }
            setDockSettings(def)
            // apply default styles
            const el = document.querySelector('.dock')
            if (el) {
              el.style.background = def.background
              el.style.borderRadius = def.borderRadius + 'px'
            }
            const wrap = document.querySelector('.dock-wrap')
            if (wrap) {
              wrap.style.bottom = ''
              wrap.style.top = '10px'
            }
          } catch {
            /* ignore */
          }
        })
      }
    } catch (err) {
      /* ignore */
    }
  }, [])

  return (
    <div className="dock-wrap" onDrop={onDrop} onDragOver={onDragOver}>
      <ul className="dock">
        {appsState.map((a, i) => (
          <li
            key={a.id}
            className={`dock-item ${hover === i ? 'hover' : ''} ${draggingId === a.id ? 'dragging' : ''}`}
            style={{ width: (dockSettings?.iconSize || 36) + 36 }}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            onClick={() => onClick(a)}
            onDoubleClick={() => onClick(a)}
            /* context menu removed */
            onDragOver={(e) => {
              // allow reorder while dragging
              try {
                e.preventDefault()
                e.dataTransfer.dropEffect = 'move'
                if (draggingId) reorder(a.id)
              } catch {
                // ignore
              }
            }}
            onDrop={(e) => {
              try {
                e.preventDefault()
                // finalize order
                saveApps(appsState)
                setDraggingId(null)
              } catch (err) {
                console.error('li drop', err)
              }
            }}
          >
            <img
              src={a.icon}
              alt={a.label}
              draggable={true}
              style={{ width: dockSettings?.iconSize || 36, height: dockSettings?.iconSize || 36 }}
              onDoubleClick={() => onClick(a)}
              onDragStart={(e) => {
                console.log('dragstart', a.id, a.label)
                try {
                  e.dataTransfer.setData('text/app-id', a.id)
                  e.dataTransfer.effectAllowed = 'copyMove'
                } catch (err) {
                  console.error('dragStart', err)
                }
                setDraggingId(a.id)
              }}
              onDragEnd={(e) => {
                console.log(
                  'dragend',
                  a.id,
                  'dropEffect=',
                  e.dataTransfer && e.dataTransfer.dropEffect,
                  'client=',
                  e.clientX,
                  e.clientY
                )
                try {
                  // if dropEffect is 'none' it means dropped outside valid drop target
                  let droppedInside = false
                  try {
                    if (typeof e.clientX === 'number' && typeof e.clientY === 'number') {
                      // when dropping inside window, elementFromPoint can tell us where it landed
                      const target = document.elementFromPoint(e.clientX, e.clientY)
                      console.log(
                        'dragend elementFromPoint ->',
                        target && (target.className || target.tagName)
                      )
                      if (target && target.closest && target.closest('.dock')) {
                        droppedInside = true
                      }
                    }
                  } catch (innerErr) {
                    console.error('elementFromPoint check failed', innerErr)
                  }

                  if (!droppedInside && e.dataTransfer && e.dataTransfer.dropEffect === 'none') {
                    console.log('dragged out - removing', a.id)
                    const next = appsState.filter((x) => x.id !== a.id)
                    saveApps(next)
                    return
                  }

                  // If client coords show it wasn't dropped on the dock, remove as well
                  if (
                    !droppedInside &&
                    typeof e.clientX === 'number' &&
                    typeof e.clientY === 'number'
                  ) {
                    console.log('dragged out by coords - removing', a.id)
                    const next = appsState.filter((x) => x.id !== a.id)
                    saveApps(next)
                  }
                  // if it was a move inside the dock, ensure we persist the new order
                  if (e.dataTransfer && e.dataTransfer.dropEffect === 'move') {
                    saveApps(appsState)
                  }
                } catch (err) {
                  console.error('dragEnd', err)
                }
                setDraggingId(null)
              }}
            />
            <span className="label">{a.label}</span>
          </li>
        ))}
        <li className="dock-item add-button" onClick={addViaDialog} title="Ajouter une app">
          <MdAdd size={20} />
        </li>
        {/* Persistent Settings icon - styled and positioned like an app item */}
        <li
          className={`dock-item settings-button ${hover === 'settings' ? 'hover' : ''}`}
          style={{ width: (dockSettings?.iconSize || 36) + 36 }}
          onMouseEnter={() => setHover('settings')}
          onMouseLeave={() => setHover(null)}
          onClick={handleOpenSettings}
          title="Settings"
          draggable={false}
          onDragStart={(e) => {
            try {
              e.preventDefault()
            } catch {
              /* ignore */
            }
          }}
        >
          <div
            style={{
              width: dockSettings?.iconSize || 36,
              height: dockSettings?.iconSize || 36,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <MdSettings size={dockSettings?.iconSize || 36} />
          </div>
          <span className="label">Settings</span>
        </li>
      </ul>
      {/* context menu removed */}
    </div>
  )
}
