const express = require('express')
const router = express.Router()
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
const auth = require('../middlewares/authMiddleware')

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

    // 2) Fallback Nominatim si peu ou pas de résultats DB
    let extCities = []
    if (dbCities.length < 10) {
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=20&q=${encodeURIComponent(q)}`
      const resp = await fetch(url, {
        headers: { 'User-Agent': 'freesbiz/1.0 (contact@freesbiz.local)' },
      })
      if (resp.ok) {
        const arr = await resp.json()
        extCities = (Array.isArray(arr) ? arr : [])
          .filter(x => ['city', 'town', 'village', 'municipality'].includes(x.type))
          .map(x => {
            const name = x.name || (x.display_name || '').split(',')[0].trim()
            const cc = (x.address?.country_code || '').toUpperCase()
            const country = cc || x.address?.country || ''
            return { id: null, name, country }
          })
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
