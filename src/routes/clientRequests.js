const express = require('express')
const router = express.Router()
const prisma = require('../utils/prismaClient')
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

 if (!req.user?.userId) return res.status(401).json({ error: 'Non authentifié' })


const data = {
  kind: kindEnum,
  technology: technology.trim(),
  level: levelEnum,
  locationMode,
  citySnapshot,
  status: 'IN_PROGRESS',
  createdBy: { connect: { id: req.user.userId } },
  ...(cityId ? { city: { connect: { id: cityId } } } : {}),
}
const created = await prisma.clientRequest.create({ data, select: { id: true } })


    res.json(created)
  } catch (err) {
    next(err)
  }
})

// GET /api/client/requests/:id
router.get('/:id', auth, async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    if (!id) return res.status(400).json({ error: 'Bad id' })
    const row = await prisma.clientRequest.findUnique({
      where: { id },
      include: { city: true },
    })
    if (!row || row.userId !== req.user.userId) return res.status(404).json({ error: 'Not found' })
    res.json(row)
  } catch (err) { next(err) }
})

// PUT /api/client/requests/:id
router.put('/:id', auth, async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    if (!id) return res.status(400).json({ error: 'Bad id' })

    const existing = await prisma.clientRequest.findUnique({ where: { id } })
    if (!existing || existing.userId !== req.user.userId) return res.status(404).json({ error: 'Not found' })

    const { kind, technology, level, location } = req.body
    if (!kind || !technology || !level || !location?.mode) {
      return res.status(400).json({ error: 'Champs manquants' })
    }

    const kindEnum  = kind === 'mission' ? 'MISSION' : 'EXPERTISE'
    const levelEnum = level === 'expert' ? 'EXPERT' : level === 'medium' ? 'MEDIUM' : 'JUNIOR'

    let locationMode, cityId = null, citySnapshot = null
    if (location.mode === 'remote') {
      locationMode = 'REMOTE'
    } else if (location.mode === 'onsite') {
      locationMode = 'ONSITE'
      if (location.city?.id) {
        const c = await prisma.city.findUnique({ where: { id: Number(location.city.id) } })
        if (!c) return res.status(400).json({ error: 'Ville inconnue' })
        cityId = c.id
        citySnapshot = `${c.name}, ${c.countryCode}`
      } else if (location.city?.name) {
        citySnapshot = `${location.city.name}${location.city.country ? ', ' + location.city.country : ''}`
      } else {
        return res.status(400).json({ error: 'Ville requise' })
      }
    } else {
      return res.status(400).json({ error: 'Mode localisation invalide' })
    }

    const data = {
      kind: kindEnum,
      technology: technology.trim(),
      level: levelEnum,
      locationMode,
      citySnapshot,
      city: cityId ? { connect: { id: cityId } } : undefined,
    }

    const updated = await prisma.clientRequest.update({
      where: { id },
      data,
      select: { id: true },
    })
    res.json(updated)
  } catch (err) { next(err) }
})


// GET /api/client/requests
router.get('/', auth, async (req, res, next) => {
  try {
    if (!req.user?.userId) return res.status(401).json({ error: 'Non authentifié' })

const rows = await prisma.clientRequest.findMany({
  where: { userId: req.user.userId },
  orderBy: { createdAt: 'desc' },
})


    res.json(rows)
  } catch (err) {
    next(err)
  }
})





module.exports = router
