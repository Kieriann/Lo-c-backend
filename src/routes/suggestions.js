const express = require('express')
const router = express.Router()
const authenticate = require('../middlewares/authMiddleware')
const prisma = require('../utils/prismaClient')
const rateLimit = require('../middlewares/rateLimit')
const { cleanText } = require('../utils/security')

router.post('/', authenticate, rateLimit({ windowMs: 60 * 60 * 1000, max: 10, name: 'suggestions' }), async (req, res) => {
  try {
    const userId = req.user?.userId
    const title = cleanText(req.body?.title, { max: 150 })
    const content = cleanText(req.body?.content, { max: 10000 })

    if (!userId) return res.status(401).json({ error: 'Non authentifié' })
    if (!title || !content) return res.status(400).json({ error: 'title et content requis' })

    const suggestion = await prisma.suggestion.create({
      data: { userId, title, content },
      select: { id: true, createdAt: true }
    })

    return res.status(201).json(suggestion)
  } catch (e) {
    console.error('POST /api/suggestions error:', e)
    return res.status(500).json({ error: 'Erreur serveur' })
  }
})

module.exports = router
