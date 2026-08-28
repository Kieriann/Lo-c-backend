const router = require('express').Router()
const prisma = require('../utils/prismaClient')
const requireAuth = require('../middlewares/authMiddleware')
const { requireRole } = require('../middlewares/roles')
const { cleanText, positiveInt } = require('../utils/security')

router.use(requireAuth, requireRole('CLIENT'))

// GET /api/client-saved-searches
router.get('/', async (req, res) => {
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
router.post('/', async (req, res) => {
  try {
    const { name, query } = req.body || {}

    if (!query || typeof query !== 'object' || Array.isArray(query)) {
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
        name: cleanText(name, { max: 100 }) || `Recherche ${nextSeq}`,
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
router.put('/:id', async (req, res) => {
  try {
    const id = positiveInt(req.params.id, { min: 1 })
    if (!id) return res.status(400).json({ error: 'Identifiant invalide' })
    const { name, query } = req.body || {}
    if (query != null && (typeof query !== 'object' || Array.isArray(query))) {
      return res.status(400).json({ error: 'Query invalide' })
    }

    const existing = await prisma.savedSearch.findFirst({
      where: { id, userId: req.user.userId },
    })
    if (!existing) {
      return res.status(404).json({ error: 'Introuvable' })
    }

    const updated = await prisma.savedSearch.update({
      where: { id },
      data: {
        ...(name ? { name: cleanText(name, { max: 100 }) } : {}),
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
router.delete('/:id', async (req, res) => {
  try {
    const id = positiveInt(req.params.id, { min: 1 })
    if (!id) return res.status(400).json({ error: 'Identifiant invalide' })

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
