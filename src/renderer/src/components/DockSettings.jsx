import React, { useState, useEffect } from 'react'

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
  const [iconSize, setIconSize] = useState(36)

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
        if (s.iconSize) setIconSize(Number(s.iconSize) || 36)
      }
    } catch (e) {
      /* ignore */
    }
  }, [])

  const apply = async (closeAfter = false) => {
    try {
      const rgb = hexToRgb(color)
      const bg = `rgba(${rgb.r},${rgb.g},${rgb.b},${opacity})`
      const settings = {
        position,
        background: bg,
        borderRadius: Number(radius),
        startAtLogin: !!startAtLogin,
        iconSize: Number(iconSize)
      }
      try {
        if (window.api && window.api.applyDockSettings) await window.api.applyDockSettings(settings)
      } catch (e) {
        console.error('applyDockSettings', e)
      }
      localStorage.setItem('dock.settings', JSON.stringify(settings))
      if (closeAfter) window.close()
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        fontFamily: 'Inter, system-ui, sans-serif',
        color: '#e6eefc',
        boxSizing: 'border-box',
        background: '#0b0c0f'
      }}
    >
      <main
        style={{
          flex: 1,
          padding: 22,
          background: 'transparent',
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box',
          height: '100%'
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 18
          }}
        >
          <div>
            <div style={{ fontSize: 12, color: '#9aa4b2', marginBottom: 6 }}>
              Settings › General
            </div>
            <h2 style={{ margin: 0, fontSize: 20, color: '#e6eefc' }}>Dock Settings</h2>
          </div>
          <div>
            <button
              onClick={() => apply(false)}
              style={{
                marginRight: 8,
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid rgba(255,255,255,0.06)',
                background: 'rgba(255,255,255,0.03)',
                color: '#e6eefc'
              }}
            >
              Appliquer
            </button>
            <button
              onClick={() => apply(true)}
              style={{
                marginRight: 8,
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid #2b6fff',
                background: '#2b6fff',
                color: '#fff'
              }}
            >
              Appliquer et fermer
            </button>
            <button
              onClick={async () => {
                try {
                  if (window.api && window.api.resetDock) await window.api.resetDock()
                  localStorage.removeItem('dock.apps')
                  localStorage.removeItem('dock.settings')
                  window.close()
                } catch (e) {
                  console.error('resetDock', e)
                }
              }}
              style={{
                padding: '8px 12px',
                borderRadius: 8,
                border: 'none',
                background: '#e04545',
                color: '#fff'
              }}
            >
              Réinitialiser
            </button>
          </div>
        </div>

        <section
          style={{
            background: '#0f1113',
            border: '1px solid rgba(255,255,255,0.04)',
            padding: 18,
            borderRadius: 10,
            width: '100%',
            flex: 1,
            overflow: 'auto',
            boxSizing: 'border-box'
          }}
        >
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontWeight: 700, marginBottom: 8, color: '#e6eefc' }}>
              Position
            </label>
            <div>
              <label style={{ marginRight: 12, color: '#e6eefc' }}>
                <input
                  type="radio"
                  value="top"
                  checked={position === 'top'}
                  onChange={() => setPosition('top')}
                />{' '}
                Haut
              </label>
              <label style={{ color: '#e6eefc' }}>
                <input
                  type="radio"
                  value="bottom"
                  checked={position === 'bottom'}
                  onChange={() => setPosition('bottom')}
                />{' '}
                Bas
              </label>
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontWeight: 700, marginBottom: 8, color: '#e6eefc' }}>
              Couleur de fond
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                style={{
                  width: 56,
                  height: 36,
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 6
                }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <label style={{ color: '#9aa4b2' }}>Opacité</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={opacity}
                  onChange={(e) => setOpacity(Number(e.target.value))}
                  style={{ width: 200 }}
                />
                <div style={{ color: '#e6eefc', fontSize: 13 }}>{opacity.toFixed(2)}</div>
              </div>
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontWeight: 700, marginBottom: 8, color: '#e6eefc' }}>
              Options supplémentaires
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <label style={{ color: '#e6eefc' }}>
                <input
                  type="checkbox"
                  checked={startAtLogin}
                  onChange={(e) => setStartAtLogin(e.target.checked)}
                />{' '}
                Démarrer l'application au démarrage
              </label>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <label style={{ color: '#e6eefc' }}>Taille des icônes</label>
              <input
                type="range"
                min="24"
                max="64"
                step="1"
                value={iconSize}
                onChange={(e) => setIconSize(Number(e.target.value))}
                style={{ width: 200 }}
              />
              <div style={{ color: '#e6eefc', fontSize: 13 }}>{iconSize}px</div>
            </div>
          </div>

          <div style={{ marginBottom: 8 }}>
            <label style={{ display: 'block', fontWeight: 700, marginBottom: 8, color: '#e6eefc' }}>
              Border radius: {radius}px
            </label>
            <input
              type="range"
              min="0"
              max="64"
              step="1"
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>
        </section>
      </main>
    </div>
  )
}
