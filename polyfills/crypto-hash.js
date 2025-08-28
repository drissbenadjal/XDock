// Temporary polyfill for globalThis.crypto.hash when running on older Node
// This file is intended as a short-term workaround for environments where
// `crypto.hash` (WebCrypto) is not available. Prefer updating Node to >=20.19.0.
try {
  if (typeof globalThis.crypto === 'undefined') globalThis.crypto = {}

  if (typeof globalThis.crypto.hash === 'undefined') {
    const nodeCrypto = require('crypto')

    const impl = async (alg, data) => {
      const algo = (String(alg || 'SHA-256') || 'sha256').toLowerCase().replace(/[^a-z0-9]/g, '')

      let buffer
      if (Buffer.isBuffer(data)) buffer = data
      else if (typeof data === 'string') buffer = Buffer.from(data)
      else if (data instanceof ArrayBuffer) buffer = Buffer.from(new Uint8Array(data))
      else if (data && data.buffer) buffer = Buffer.from(data.buffer)
      else buffer = Buffer.from(String(data))

      const h = nodeCrypto.createHash(algo)
      h.update(buffer)
      return h.digest()
    }

    // Attach to globalThis.crypto
    globalThis.crypto.hash = impl

    // Also attach to the Node crypto export (some code imports crypto and checks crypto.hash)
    try {
      const c = require('crypto')
      if (typeof c.hash === 'undefined') c.hash = impl
      if (c.webcrypto && typeof c.webcrypto.hash === 'undefined') c.webcrypto.hash = impl
    } catch (e) {
      // ignore
    }
  }
} catch (e) {
  // If polyfill fails just ignore; main error will surface elsewhere
  // but avoid crashing the preloaded script.
  try {
    console.error('crypto-hash polyfill failed', e)
  } catch (_) {}
}
