const express = require('express')
const router = express.Router()
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
const auth = require('../middlewares/authMiddleware')

// POST /api/client/requests
router.post('/', auth, async (req, res, next) => {
  try {
    const { kind, technology, level, location } = req.body
    if (!kind || !technology || !level || !location?.mode) {
      return res.status(400).json({ error: 'Champs manquants' })
    }

    const kindEnum = kind === 'mission' ? 'MISSION' : 'EXPERTISE'
    const levelEnum =
      level === 'expert' ? 'EXPERT' : level === 'medium' ? 'MEDIUM' : 'JUNIOR'

    let locationMode, cityId = null, citySnapshot = null

    if (location.mode === 'remote') {
      locationMode = 'REMOTE'
    } else if (location.mode === 'onsite') {
      locationMode = 'ONSITE'
      if (!location.city || (!location.city.id && !location.city.name)) {
        return res.status(400).json({ error: 'Ville requise' })
      }
      if (location.city.id) {
        const c = await prisma.city.findUnique({ where: { id: Number(location.city.id) } })
        if (!c) return res.status(400).json({ error: 'Ville inconnue' })
        cityId = c.id
        citySnapshot = `${c.name}, ${c.countryCode}`
      } else {
        // fallback si on reçoit juste name/country
        citySnapshot = `${location.city.name}${location.city.country ? ', ' + location.city.country : ''}`
      }
    } else {
      return res.status(400).json({ error: 'Mode localisation invalide' })
    }

    const created = await prisma.clientRequest.create({
      data: {
        kind: kindEnum,
        technology: technology.trim(),
        level: levelEnum,
        locationMode,
        cityId,
        citySnapshot,
        userId: req.user.id,
      },
      select: { id: true },
    })

    res.json(created)
  } catch (err) {
    next(err)
  }
})

module.exports = router
