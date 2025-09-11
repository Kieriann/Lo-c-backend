const express = require('express')
const router  = express.Router()
const prisma  = require('../utils/prismaClient')
const authenticate = require('../middlewares/authMiddleware')

// GET /api/client/profile
router.get('/', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'CLIENT') return res.status(403).json({ error: 'Forbidden' })
    const userId = Number(req.user.userId)
    const profile = await prisma.clientProfile.findFirst({
      where: { user: { id: userId } }
    })
    res.json(profile || {})
  } catch (e) {
    console.error('GET /api/client/profile failed:', e)
    res.status(500).json({ error: 'SERVER_ERROR' })
  }
})

// PUT /api/client/profile
router.put('/', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'CLIENT') return res.status(403).json({ error: 'Forbidden' })
    const userId = req.user.userId

    const {
      companyName, siret, sector,
      contactFirstName, contactLastName, contactRole,
      email, phone,
      addressStreet, addressPostalCode, addressCity, addressCountry,
      clientType,
    } = req.body

    const data = {
      companyName, siret, sector,
      contactFirstName, contactLastName, contactRole,
      email, phone,
      addressStreet, addressPostalCode, addressCity, addressCountry,
      clientType,
    }

    const existing = await prisma.clientProfile.findFirst({
      where: { user: { id: userId } },
      select: { id: true }
    })

    const saved = existing
      ? await prisma.clientProfile.update({ where: { id: existing.id }, data })
      : await prisma.clientProfile.create({ data: { ...data, user: { connect: { id: userId } } } })

    res.json(saved)
  } catch (e) {
    console.error('PUT /api/client/profile failed:', e)
    res.status(500).json({ error: 'SERVER_ERROR' })
  }
})

module.exports = router
