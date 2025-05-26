const express = require('express')
const router = express.Router()
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
const authenticateToken = require('../middlewares/authMiddleware')

router.use(authenticateToken)

router.get('/profils', async (req, res) => {
  if (!req.user?.id) return res.status(401).json({ error: 'Non authentifié' })
  const user = await prisma.user.findUnique({ where: { id: req.user.id } })
  if (!user?.isAdmin) return res.status(403).json({ error: 'Accès interdit' })
  const search = req.query.search || ''

  try {
    const profils = await prisma.profile.findMany({
      where: {
        OR: [
          { firstname: { contains: search } },
          { lastname: { contains: search } },
          { bio: { contains: search } },
        ],
      },
      include: {
        User: { select: { email: true } },
      },
    })

    res.json(profils)
  } catch (err) {
    console.error('❌ Erreur admin profils :', err)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})


module.exports = router
