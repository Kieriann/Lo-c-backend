const express = require('express')
const router = express.Router()
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
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


module.exports = router
