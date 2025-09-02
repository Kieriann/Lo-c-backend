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
    const cities = await prisma.city.findMany({
      where: { name: { contains: q, mode: 'insensitive' } },
      select: { id: true, name: true, country: true, countryCode: true },
      take: 50,
      orderBy: [{ name: 'asc' }],
    })
    res.json(cities.map(c => ({
      id: c.id,
      name: c.name,
      country: c.countryCode || c.country,
    })))
  } catch (err) {
    next(err)
  }
})

module.exports = router
