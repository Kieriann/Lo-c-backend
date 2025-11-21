const router = require('express').Router()
const prisma = require('../utils/prismaClient')
const requireAuth = require('../middlewares/authMiddleware')

// GET /api/client-saved-searches
router.get('/', requireAuth, async (req, res) => {
  try {
    const rows = await prisma.savedSearch.findMany({
      where: { userId: req.user.userId },
      orderBy: { createdAt: 'desc' },
    })
    res.json(rows)
  } catch (e) {
    console.error('GET /client-saved-searches failed:', e)
    res.status(500).json({ error: 'Erreur liste recherches' })
  }
})

// POST /api/client-saved-searches
router.post('/', requireAuth, async (req, res) => {
  try {
    const { name, query } = req.body || {}

    if (!query || typeof query !== 'object') {
      return res.status(400).json({ error: 'Query manquante ou invalide' })
    }

    const last = await prisma.savedSearch.findFirst({
      where: { userId: req.user.userId },
      orderBy: { seq: 'desc' },
    })
    const nextSeq = (last?.seq || 0) + 1

    const created = await prisma.savedSearch.create({
      data: {
        userId: req.user.userId,
        name: name && name.trim() ? name.trim() : `Recherche ${nextSeq}`,
        seq: nextSeq,
        query,
      },
    })

    res.json(created)
  } catch (e) {
    console.error('POST /client-saved-searches failed:', e)
    res.status(500).json({ error: 'Erreur création recherche' })
  }
})

// PUT /api/client-saved-searches/:id (renommer / mettre à jour query)
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id)
    const { name, query } = req.body || {}

    const existing = await prisma.savedSearch.findFirst({
      where: { id, userId: req.user.userId },
    })
    if (!existing) {
      return res.status(404).json({ error: 'Introuvable' })
    }

    const updated = await prisma.savedSearch.update({
      where: { id },
      data: {
        ...(name ? { name: name.trim() } : {}),
        ...(query ? { query } : {}),
      },
    })

    res.json(updated)
  } catch (e) {
    console.error('PUT /client-saved-searches failed:', e)
    res.status(500).json({ error: 'Erreur mise à jour recherche' })
  }
})

// DELETE /api/client-saved-searches/:id
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id)

    const existing = await prisma.savedSearch.findFirst({
      where: { id, userId: req.user.userId },
    })
    if (!existing) {
      return res.status(404).json({ error: 'Introuvable' })
    }

    await prisma.savedSearch.delete({ where: { id } })
    res.json({ ok: true })
  } catch (e) {
    console.error('DELETE /client-saved-searches failed:', e)
    res.status(500).json({ error: 'Erreur suppression recherche' })
  }
})

module.exports = router
