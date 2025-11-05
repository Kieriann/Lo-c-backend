const express = require('express')
const router = express.Router()
const authenticate = require('../middlewares/authMiddleware')
const prisma = require('../utils/prismaClient')

router.post('/', authenticate, async (req, res) => {
  try {
    const userId = req.user?.userId
    const { title, content } = req.body

    if (!userId) return res.status(401).json({ error: 'Non authentifié' })
    if (!title || !content) return res.status(400).json({ error: 'title et content requis' })

    const suggestion = await prisma.suggestion.create({
      data: { userId, title: title.trim(), content: content.trim() },
      select: { id: true, createdAt: true }
    })

    return res.status(201).json(suggestion)
  } catch (e) {
    console.error('POST /api/suggestions error:', e)
    return res.status(500).json({ error: 'Erreur serveur' })
  }
})

module.exports = router