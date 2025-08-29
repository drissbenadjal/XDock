import { useState, useEffect, useRef } from 'react'
import explorerIcon from '../assets/electron.svg'

const hexToRgb = (hex) => {
  const h = hex.replace('#', '')
  const bigint = parseInt(h, 16)
  const r = (bigint >> 16) & 255
  const g = (bigint >> 8) & 255
  const b = bigint & 255
  return { r, g, b }
}

export default function DockSettings() {
  const [position, setPosition] = useState('top')
  const [color, setColor] = useState('#1e1e1e')
  const [opacity, setOpacity] = useState(0.6)
  const [radius, setRadius] = useState(20)
  const [startAtLogin, setStartAtLogin] = useState(false)
  const [showAddButton, setShowAddButton] = useState(true)
  const [showLabels, setShowLabels] = useState(true)
  const [showSettingsEntry, setShowSettingsEntry] = useState(true)
  const [iconSize, setIconSize] = useState(36)
  const [activeTab, setActiveTab] = useState('general')
  const [apps, setApps] = useState([])
  const [newAppPath, setNewAppPath] = useState('')

  useEffect(() => {
    try {
      const raw = localStorage.getItem('dock.settings')
      if (raw) {
        const s = JSON.parse(raw)
        if (s.position) setPosition(s.position)
        if (s.background) {
          const m = s.background.match(/rgba?\((\d+),(\d+),(\d+),(\d*\.?\d+)\)/)
          if (m) {
            const r = Number(m[1])
            const g = Number(m[2])
            const b = Number(m[3])
            const hex = '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)
            setColor(hex)
            setOpacity(parseFloat(m[4]))
          }
        }

        if (s.borderRadius) setRadius(s.borderRadius)
        if (typeof s.startAtLogin !== 'undefined') setStartAtLogin(!!s.startAtLogin)
        if (typeof s.showAddButton !== 'undefined') setShowAddButton(!!s.showAddButton)
        if (typeof s.showLabels !== 'undefined') setShowLabels(!!s.showLabels)
        if (typeof s.showSettingsEntry !== 'undefined') setShowSettingsEntry(!!s.showSettingsEntry)
        if (s.iconSize) setIconSize(Number(s.iconSize) || 36)
      }
    } catch {
      /* ignore */
    }
    try {
      const rawApps = localStorage.getItem('dock.apps')
      if (rawApps) {
        try {
          const parsed = JSON.parse(rawApps) || []
          const normalized = parsed.map((a) => ({
            id: a.id || 'app-' + Date.now(),
            label: a.label || a.name || (a.path ? a.path.split(/[\\/]/).pop() : ''),
            path: a.path || '',
            icon: a.icon || explorerIcon
          }))
          setApps(normalized)
        } catch {
          setApps([])
        }
      }
    } catch {
      /* ignore */
    }
  }, [])

  // auto apply on changes (debounced)
  const applyTimeout = useRef(null)
  useEffect(() => {
    // debounce
    if (applyTimeout.current) clearTimeout(applyTimeout.current)
    applyTimeout.current = setTimeout(() => apply(false), 300)
    return () => {
      if (applyTimeout.current) clearTimeout(applyTimeout.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position, color, opacity, radius, startAtLogin, iconSize])

  const apply = async (closeAfter = false) => {
    try {
      const rgb = hexToRgb(color)
      const bg = `rgba(${rgb.r},${rgb.g},${rgb.b},${opacity})`
      const settings = {
        position,
        background: bg,
        borderRadius: Number(radius),
  startAtLogin: !!startAtLogin,
  showAddButton: !!showAddButton,
  showLabels: !!showLabels,
  showSettingsEntry: !!showSettingsEntry,
    iconSize: Number(iconSize)
      }
      try {
        if (window.api && window.api.applyDockSettings) await window.api.applyDockSettings(settings)
      } catch (err) {
        console.error('applyDockSettings', err)
      }
      localStorage.setItem('dock.settings', JSON.stringify(settings))
      if (closeAfter) window.close()
    } catch (err) {
      console.error(err)
    }
  }

  // apply immediately with optional overrides (useful for immediate UI actions)
  const applyImmediate = async (overrides = {}) => {
    try {
      const newColor = overrides.color || color
      const newOpacity = typeof overrides.opacity === 'number' ? overrides.opacity : opacity
      const rgb = hexToRgb(newColor)
      const bg = `rgba(${rgb.r},${rgb.g},${rgb.b},${newOpacity})`
      const settings = {
        position: typeof overrides.position !== 'undefined' ? overrides.position : position,
        background: bg,
        borderRadius:
          typeof overrides.borderRadius !== 'undefined' ? overrides.borderRadius : Number(radius),
        startAtLogin:
          typeof overrides.startAtLogin !== 'undefined' ? !!overrides.startAtLogin : !!startAtLogin,
        showAddButton:
          typeof overrides.showAddButton !== 'undefined' ? !!overrides.showAddButton : !!showAddButton,
        showLabels:
          typeof overrides.showLabels !== 'undefined' ? !!overrides.showLabels : !!showLabels,
          showSettingsEntry:
            typeof overrides.showSettingsEntry !== 'undefined'
              ? !!overrides.showSettingsEntry
              : !!showSettingsEntry,
        iconSize: typeof overrides.iconSize !== 'undefined' ? overrides.iconSize : Number(iconSize)
      }
      try {
        if (window.api && window.api.applyDockSettings) await window.api.applyDockSettings(settings)
      } catch (err) {
        console.error('applyImmediate.applyDockSettings', err)
      }
      try {
        localStorage.setItem('dock.settings', JSON.stringify(settings))
      } catch {
        /* ignore */
      }
      // update local state to reflect applied values
      try {
        if (typeof overrides.position !== 'undefined') setPosition(overrides.position)
        if (typeof overrides.color !== 'undefined') setColor(overrides.color)
        if (typeof overrides.opacity !== 'undefined') setOpacity(overrides.opacity)
        if (typeof overrides.borderRadius !== 'undefined') setRadius(overrides.borderRadius)
        if (typeof overrides.startAtLogin !== 'undefined') setStartAtLogin(!!overrides.startAtLogin)
        if (typeof overrides.showAddButton !== 'undefined') setShowAddButton(!!overrides.showAddButton)
        if (typeof overrides.showLabels !== 'undefined') setShowLabels(!!overrides.showLabels)
        if (typeof overrides.showSettingsEntry !== 'undefined') setShowSettingsEntry(!!overrides.showSettingsEntry)
        if (typeof overrides.iconSize !== 'undefined') setIconSize(overrides.iconSize)
      } catch {
        /* ignore */
      }
    } catch (e) {
      console.error('applyImmediate failed', e)
    }
  }

  const persistApps = async (next) => {
    try {
      localStorage.setItem('dock.apps', JSON.stringify(next))
      setApps(next)
      try {
        if (window.api && window.api.applyDockApps) await window.api.applyDockApps(next)
      } catch (err) {
        console.error('applyDockApps failed', err)
      }
    } catch (e) {
      console.error('persistApps failed', e)
    }
  }

  const addApp = async () => {
    try {
      let path = newAppPath
      if (!path && window.api && window.api.openFileDialog) {
        const picked = await window.api.openFileDialog()
        if (picked) path = picked
      }
      if (!path) return
      // resolve .lnk and .url before fetching icon
      let final = path
      try {
        const lower = final.toLowerCase()
        if (lower.endsWith('.lnk') && window.api && window.api.resolveShortcut) {
          try {
            const r = await window.api.resolveShortcut(final)
            if (r) final = r
          } catch (err) {
            console.debug('resolveShortcut failed', err)
          }
        } else if (lower.endsWith('.url') || lower.endsWith('.website')) {
          try {
            const txt = window.api && window.api.readFileText ? await window.api.readFileText(final) : null
            if (txt) {
              const m = txt.match(/^(?:URL|LocalFile)\s*=\s*(.+)$/im)
              if (m && m[1]) {
                const candidate = m[1].trim()
                if (candidate) final = candidate
              }
            }
          } catch (err) {
            console.debug('.url parse failed', err)
          }
        }

      } catch (e) {
        console.debug('addApp resolve failed', e)
      }

      // fetch icon for final
      let iconData = null
      try {
        if (window.api && window.api.getFileIcon) iconData = await window.api.getFileIcon(final)
      } catch (e) {
        /* ignore */
      }
      if (iconData && typeof iconData === 'string' && !iconData.startsWith('data:')) {
        try {
          if (window.api && window.api.readFileAsDataUrl) {
            const converted = await window.api.readFileAsDataUrl(iconData)
            if (converted) iconData = converted
          }
        } catch (e) {
          /* ignore */
        }
      }

      const rawName = (final || path).split(/[\\/\\]/).pop() || ''
      const labelNoExt = rawName.replace(/\.[^/.]+$/i, '')
      const entry = {
        id: 'app-' + Date.now(),
        label: labelNoExt,
        path: final,
        icon: iconData || explorerIcon
      }
  const next = [...apps, entry]
  await persistApps(next)
      setNewAppPath('')
    } catch (e) {
      console.error('addApp failed', e)
    }
  }

  const removeApp = async (id) => {
    const next = apps.filter((a) => a.id !== id)
    await persistApps(next)
  }

  const renameApp = async (id, label) => {
    const next = apps.map((a) => (a.id === id ? { ...a, label } : a))
    await persistApps(next)
  }

  return (
    <div className="settings-wrapper">
      <div className="settings-card">
          <div className="custom-titlebar">
            <div className="title">Settings</div>
            <div className="controls">
              <button
                className="btn reset-btn"
                onClick={() =>
                  window.api && window.api.windowControl && window.api.windowControl('close')
                }
                aria-label="Fermer"
              >
                ✕
              </button>
            </div>
          </div>
        <div className="settings-body">
          <div className="settings-left">
          <div className="nav-list">
            <div
              className={`nav-item-light ${activeTab === 'general' ? 'active' : ''}`}
              onClick={() => setActiveTab('general')}
            >
              <div className="nav-icon">⚙️</div>
              <div>General</div>
            </div>
            <div
              className={`nav-item-light ${activeTab === 'applications' ? 'active' : ''}`}
              onClick={() => setActiveTab('applications')}
            >
              <div className="nav-icon">📦</div>
              <div>Applications</div>
            </div>
          </div>
          <div className="left-footer">
            <button
              className="btn reset-btn"
              onClick={async () => {
                const ok = window.confirm('Réinitialiser les réglages et les applications ?')
                if (!ok) return
                try {
                  if (window.api && window.api.resetDock) await window.api.resetDock()
                  localStorage.removeItem('dock.apps')
                  localStorage.removeItem('dock.settings')
                  // reset local state
                  setApps([])
                  setPosition('top')
                  setColor('#1e1e1e')
                  setOpacity(0.6)
                  setRadius(20)
                } catch {
                  /* ignore */
                }
              }}
            >
              Réinitialiser
            </button>
          </div>
          </div>
          <div className="settings-center">
            <div className="center-header">
            <div className="center-title">
              {activeTab === 'general' ? 'General' : 'Applications'}
            </div>
            <div className="center-sub">Manage your dock preferences</div>
          </div>
          <div className="settings-list">
            {activeTab === 'general' && (
              <div>
                <div className="setting-row">
                  <div>
                    <div className="setting-label">Position</div>
                    <div className="setting-desc">Place the dock on top or bottom</div>
                  </div>
                  <div className="control-right">
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        className={`select-btn ${position === 'top' ? 'primary' : ''}`}
                        onClick={() => {
                          const next = 'top'
                          setPosition(next)
                          applyImmediate({ position: next })
                        }}
                      >
                        Top
                      </button>
                      <button
                        className={`select-btn ${position === 'bottom' ? 'primary' : ''}`}
                        onClick={() => {
                          const next = 'bottom'
                          setPosition(next)
                          applyImmediate({ position: next })
                        }}
                      >
                        Bottom
                      </button>
                    </div>
                  </div>
                </div>

                <div className="setting-row">
                  <div>
                    <div className="setting-label">Background color</div>
                    <div className="setting-desc">Choose color and opacity</div>
                  </div>
                  <div className="control-right">
                    <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
                    <div
                      className={`toggle ${opacity > 0.5 ? 'on' : ''}`}
                      onClick={() => setOpacity(opacity > 0.5 ? 0.3 : 0.8)}
                    >
                      <div className="knob" />
                    </div>
                  </div>
                </div>

                <div className="setting-row">
                  <div>
                    <div className="setting-label">Border radius</div>
                    <div className="setting-desc">Rounded corners for the dock</div>
                  </div>
                  <div className="control-right">
                    <input
                      className="input-range"
                      type="range"
                      min={0}
                      max={60}
                      value={radius}
                      onChange={(e) => {
                        const v = Number(e.target.value)
                        setRadius(v)
                        applyImmediate({ borderRadius: v })
                      }}
                    />
                    <div style={{ minWidth: 48, textAlign: 'right' }}>{radius}px</div>
                  </div>
                </div>

                <div className="setting-row">
                  <div>
                    <div className="setting-label">Icon size</div>
                    <div className="setting-desc">Adjust the size of icons shown in the dock</div>
                  </div>
                  <div className="control-right">
                    <input
                      className="input-range"
                      type="range"
                      min={20}
                      max={72}
                      value={iconSize}
                      onChange={(e) => {
                        const v = Number(e.target.value)
                        setIconSize(v)
                        applyImmediate({ iconSize: v })
                      }}
                    />
                    <div style={{ minWidth: 48, textAlign: 'right' }}>{iconSize}px</div>
                  </div>
                </div>

                <div className="setting-row">
                  <div>
                    <div className="setting-label">Start at login</div>
                    <div className="setting-desc">Launch XDock when Windows starts</div>
                  </div>
                  <div className="control-right">
                    <div
                      className={`toggle ${startAtLogin ? 'on' : ''}`}
                      onClick={() => {
                        const next = !startAtLogin
                        setStartAtLogin(next)
                        applyImmediate({ startAtLogin: next })
                      }}
                      title="Start XDock at Windows startup"
                    >
                      <div className="knob" />
                    </div>
                  </div>
                </div>

                <div className="setting-row">
                  <div>
                    <div className="setting-label">Afficher le bouton +</div>
                    <div className="setting-desc">Montrer ou masquer le bouton d'ajout dans la dock</div>
                  </div>
                  <div className="control-right">
                    <div
                      className={`toggle ${showAddButton ? 'on' : ''}`}
                      onClick={() => {
                        const next = !showAddButton
                        setShowAddButton(next)
                        applyImmediate({ showAddButton: next })
                      }}
                      title="Afficher le bouton Ajouter dans la dock"
                    >
                      <div className="knob" />
                    </div>
                  </div>
                </div>

                <div className="setting-row">
                  <div>
                    <div className="setting-label">Afficher les noms</div>
                    <div className="setting-desc">Afficher ou masquer les noms des applications dans la dock</div>
                  </div>
                  <div className="control-right">
                    <div
                      className={`toggle ${showLabels ? 'on' : ''}`}
                      onClick={() => {
                        const next = !showLabels
                        setShowLabels(next)
                        applyImmediate({ showLabels: next })
                      }}
                      title="Afficher les noms d'app"
                    >
                      <div className="knob" />
                    </div>
                  </div>
                </div>
                <div className="setting-row">
                  <div>
                    <div className="setting-label">Afficher l'icône Paramètres</div>
                    <div className="setting-desc">Afficher l'icône des préférences dans la zone de notification — ouvrez les préférences en cliquant droit sur l'icône cachée dans la petite flèche près de l'horloge.</div>
                  </div>
                  <div className="control-right">
                    <div
                      className={`toggle ${showSettingsEntry ? 'on' : ''}`}
                      onClick={() => {
                        const next = !showSettingsEntry
                        setShowSettingsEntry(next)
                        applyImmediate({ showSettingsEntry: next })
                      }}
                      title="Afficher l'icône des préférences"
                    >
                      <div className="knob" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'applications' && (
              <div>
                <div className="setting-row">
                  <div>
                    <div className="setting-label">Applications</div>
                    <div className="setting-desc">Add, remove or rename apps</div>
                  </div>
                  <div className="control-right">
                    <button className="select-btn primary" onClick={addApp}>
                      Ajouter un raccourci
                    </button>
                  </div>
                </div>

                <div style={{ maxHeight: '60vh', overflow: 'auto' }} className="apps-list">
                  {apps.length === 0 && (
                    <div className="panel-empty">Aucune application ajoutée.</div>
                  )}
                  {apps.map((a) => {
                    const rawLabel = a.label || ''
                    const displayLabel = rawLabel.replace(/\.(exe|url|lnk)$/i, '')
                    return (
                      <div key={a.id} className="setting-row">
                        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                          <div className="app-thumb">
                            {a.icon ? (
                              <img src={a.icon} alt={displayLabel || ''} style={{ width: 24, height: 24 }} />
                            ) : (
                              (displayLabel && displayLabel[0] ? displayLabel[0].toUpperCase() : 'A')
                            )}
                          </div>
                          <div style={{ minWidth: 0 }}>
                              <div className="app-name">{displayLabel}</div>
                          </div>
                        </div>
                        <div className="control-right">
                          <button
                            className="select-btn"
                            onClick={() => {
                              const newName = prompt("Renommer l'application", displayLabel || '')
                              if (newName) renameApp(a.id, newName)
                            }}
                          >
                            Renommer
                          </button>
                          <button
                            className="select-btn delete-btn"
                            onClick={() => removeApp(a.id)}
                          >
                            Supprimer
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
          </div>
        </div>
      </div>
    </div>
  )
}
