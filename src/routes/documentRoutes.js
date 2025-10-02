const express = require('express')
const router = express.Router()
const prisma = require('../utils/prismaClient')
const authMiddleware = require('../middlewares/authMiddleware')

// ─── Route : récupérer les documents du user connecté ────────────────
router.get('/me', authMiddleware, async (req, res, next) => {
  try {
        console.log(req.user)
    const userId = req.user.id

    const documents = await prisma.document.findMany({
      where: { userId },
      select: {
  id: true,
  type: true,
  fileName: true,
  originalName: true,
  publicId: true,
  version: true,
  format: true
}

    })

    res.json(documents)
  } catch (err) {
    next(err)
  }
})

// ─── Route : compter tous les CV enregistrés ─────────────────────────
router.get('/count-cv', async (req, res) => {
  try {
    const count = await prisma.document.count({
      where: {
        type: 'cv' // Assure-toi que le type est bien 'cv' pour les documents CV
      }
    })
    res.json({ count })
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' })
  }
})
router.get('/', async (req, res) => {
  try {
    const documents = await prisma.document.findMany()
    res.json(documents)
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

// ─── Compter les PROFILS ayant au moins 1 CV ────────────────────────
router.get('/count-cv-profiles', async (_req, res, next) => {
  try {
    const rows = await prisma.document.findMany({
      where: { type: { equals: 'cv', mode: 'insensitive' } },
      distinct: ['userId'],
      select: { userId: true },
    })
    res.json({ count: rows.length })
  } catch (err) {
    next(err)
  }
})
// ─── Compter TOUS les profils créés ─────────────────────────────────
router.get('/count-profiles', async (_req, res, next) => {
  try {
    const count = await prisma.profile.count()
    res.json({ count })
  } catch (err) {
    next(err)
  }
})



module.exports = router
