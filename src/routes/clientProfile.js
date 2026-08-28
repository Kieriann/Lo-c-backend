const express = require('express')
const router  = express.Router()
const prisma  = require('../utils/prismaClient')
const authenticate = require('../middlewares/authMiddleware')
const { requireRole } = require('../middlewares/roles')
const { cleanText, isValidEmail } = require('../utils/security')

router.use(authenticate, requireRole('CLIENT'))

// GET /api/client/profile
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id
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
router.put('/', async (req, res) => {
  try {
    const userId = req.user.id

    const {
      companyName, siret, sector,
      contactFirstName, contactLastName, contactRole,
      email, phone,
      addressStreet, addressPostalCode, addressCity, addressCountry,
      clientType,
    } = req.body

    if (email && !isValidEmail(email)) return res.status(400).json({ error: 'Email invalide' })
    const data = {
      companyName: cleanText(companyName, { max: 200 }) || null,
      siret: cleanText(siret, { max: 20 }) || null,
      sector: cleanText(sector, { max: 150 }) || null,
      contactFirstName: cleanText(contactFirstName, { max: 100 }) || null,
      contactLastName: cleanText(contactLastName, { max: 100 }) || null,
      contactRole: cleanText(contactRole, { max: 150 }) || null,
      email: cleanText(email, { max: 254 }) || null,
      phone: cleanText(phone, { max: 40 }) || null,
      addressStreet: cleanText(addressStreet, { max: 255 }) || null,
      addressPostalCode: cleanText(addressPostalCode, { max: 20 }) || null,
      addressCity: cleanText(addressCity, { max: 150 }) || null,
      addressCountry: cleanText(addressCountry, { max: 100 }) || null,
      clientType: cleanText(clientType, { max: 50 }) || null,
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
