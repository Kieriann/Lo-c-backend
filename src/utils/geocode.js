const axios = require('axios')

const _cache = new Map() // key: "city|CC" -> { lat, lng }
const _normKey = (name, cc) =>
  `${String(name||'').trim().toLowerCase()}|${String(cc||'').trim().toUpperCase()}`

const sleep = ms => new Promise(r => setTimeout(r, ms))

async function geocodeCity(name, countryCode) {
  const key = _normKey(name, countryCode)
  if (_cache.has(key)) return _cache.get(key)

  const q = countryCode ? `${name}, ${countryCode}` : String(name || '')
  let lastErr = null
  for (let i = 0; i < 3; i++) {
    try {
      const { data } = await axios.get('https://nominatim.openstreetmap.org/search', {
        params: { q, format: 'json', addressdetails: 0, limit: 1 },
        headers: { 'User-Agent': 'Freesbiz-Shortlist/1.0 (contact@freesbiz.example)' },
        timeout: 8000,
      })
      const hit = Array.isArray(data) ? data[0] : null
      if (!hit) return null
      const res = { lat: Number(hit.lat), lng: Number(hit.lon) }
      _cache.set(key, res)
      if (_cache.size > 1000) _cache.clear()
      return res
    } catch (e) {
      lastErr = e
      const sc = e?.response?.status
      if (sc === 429 || sc === 503) await sleep(500 * (2 ** i))
      else throw e
    }
  }
  return null
}

module.exports = { geocodeCity }
