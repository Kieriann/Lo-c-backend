const express = require('express')
const router = express.Router()
const prisma = require('../utils/prismaClient')
const auth = require('../middlewares/authMiddleware')

// cache mémoire 5 min
const cache = new Map()
const TTL = 5 * 60 * 1000
function getCache(k) {
  const v = cache.get(k)
  if (!v) return null
  if (Date.now() - v.t > TTL) { cache.delete(k); return null }
  return v.d
}
function setCache(k, d) { cache.set(k, { d, t: Date.now() }) }

// fetch avec timeout
async function fetchWithTimeout(url, opts = {}, timeoutMs = 2500) {
  const ac = new AbortController()
  const id = setTimeout(() => ac.abort(), timeoutMs)
  try {
    return await fetch(url, { ...opts, signal: ac.signal })
  } finally {
    clearTimeout(id)
  }
}

function normalizeCountry(x) {
  const cc = (x?.address?.country_code || '').toUpperCase()
  return cc || x?.address?.country || ''
}
function bestName(x) {
  const a = x.address || {}
  return a.city || a.town || a.village || a.municipality || a.suburb || a.locality || a.county || x.name || ''
}

// GET /api/cities?query=pa
router.get('/', auth, async (req, res, next) => {
  try {
    const q = String(req.query.query || '').trim()
    if (q.length < 2) return res.json([])

    const key = `q:${q.toLowerCase()}`
    const cached = getCache(key)
    if (cached) return res.json(cached)

    // DB + Nominatim en parallèle
    const dbP = prisma.city.findMany({
      where: { name: { contains: q, mode: 'insensitive' } },
      select: { id: true, name: true, country: true, countryCode: true },
      take: 50,
      orderBy: [{ name: 'asc' }],
    })

    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=25&accept-language=fr,en&q=${encodeURIComponent(q)}`
    const extP = (async () => {
      try {
        const resp = await fetchWithTimeout(url, {
          headers: { 'User-Agent': 'FreesBiz/1.0 (contact@freesbiz.app)' },
        }, 2500)
        if (!resp.ok) return []
        const arr = await resp.json()
        return (Array.isArray(arr) ? arr : [])
          // on garde tout lieu nommé avec pays, sans filtrer trop agressivement
          .map(x => {
            const name = bestName(x)
            const country = normalizeCountry(x)
            return name && country ? { id: null, name, country } : null
          })
          .filter(Boolean)
      } catch { return [] }
    })()

    const [dbCities, extCities] = await Promise.all([dbP, extP])

    const normalizedDb = dbCities.map(c => ({
      id: c.id,
      name: c.name,
      country: c.countryCode || c.country || '',
    }))

    // merge + dédoublonnage
    const seen = new Set()
    const all = [...normalizedDb, ...extCities].filter(c => {
      const k = `${(c.name || '').toLowerCase()}|${(c.country || '').toLowerCase()}`
      if (!c.name || !c.country) return false
      if (seen.has(k)) return false
      seen.add(k)
      return true
    }).slice(0, 50)

    setCache(key, all)
    res.json(all)
  } catch (err) {
    next(err)
  }
})

module.exports = router
