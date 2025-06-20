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
        path: true,
        fileName: true,
      }
    })

    res.json(documents)
  } catch (err) {
    next(err)
  }
})

module.exports = router
