const express = require('express')
const router = express.Router()
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
const auth = require('../middlewares/authMiddleware')

// util: fetch avec timeout
async function fetchWithTimeout(url, opts = {}, timeoutMs = 2500) {
  const ac = new AbortController()
  const id = setTimeout(() => ac.abort(), timeoutMs)
  try {
    return await fetch(url, { ...opts, signal: ac.signal })
  } finally {
    clearTimeout(id)
  }
}

// GET /api/cities?query=pa
router.get('/', auth, async (req, res, next) => {
  try {
    const q = String(req.query.query || '').trim()
    if (q.length < 2) return res.json([])

    // 1) DB
    const dbCities = await prisma.city.findMany({
      where: { name: { contains: q, mode: 'insensitive' } },
      select: { id: true, name: true, country: true, countryCode: true },
      take: 50,
      orderBy: [{ name: 'asc' }],
    })

    // 2) Fallback Nominatim (plus tolérant) si peu de résultats
    let extCities = []
    if (dbCities.length < 10) {
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=20&accept-language=fr,en&q=${encodeURIComponent(q)}`
      try {
        const resp = await fetchWithTimeout(url, {
          headers: { 'User-Agent': 'FreesBiz/1.0 (contact@freesbiz.app)' },
        }, 2500)
        if (resp.ok) {
          const arr = await resp.json()
          extCities = (Array.isArray(arr) ? arr : [])
            // élargit le filtre : on garde les lieux habités et assimilés
            .filter(x => {
              const t = (x.type || '').toLowerCase()
              return ['city','town','village','municipality','suburb','hamlet','locality','neighbourhood'].includes(t)
                || (x.class === 'place' && x.name)
            })
            .map(x => {
              const name = x.name || (x.display_name || '').split(',')[0].trim()
              const cc = (x.address?.country_code || '').toUpperCase()
              const country = cc || x.address?.country || ''
              return { id: null, name, country }
            })
        }
      } catch {
        // ignore timeout/abort
      }
    }

    // 3) Merge + dedupe
    const normalizedDb = dbCities.map(c => ({
      id: c.id,
      name: c.name,
      country: c.countryCode || c.country || '',
    }))
    const all = [...normalizedDb, ...extCities]
    const seen = new Set()
    const uniq = all.filter(c => {
      const k = `${(c.name || '').toLowerCase()}|${(c.country || '').toLowerCase()}`
      if (seen.has(k)) return false
      seen.add(k)
      return c.name && c.country
    }).slice(0, 50)

    res.json(uniq)
  } catch (err) {
    next(err)
  }
})

module.exports = router
