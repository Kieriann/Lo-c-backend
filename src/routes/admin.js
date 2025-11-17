const express = require('express')
const router = express.Router()
const prisma = require('../utils/prismaClient')
const authenticateToken = require('../middlewares/authMiddleware')

// ─── Protection globale : JWT + rôle admin ─────────────────────────
router.use(authenticateToken)
router.use((req, res, next) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ error: 'Accès refusé' })
  }
  next()
})

// ─── Recherche utilisateurs (moteur admin) ─────────────────────────
router.get('/search-users', async (req, res) => {
  const q = req.query.query?.toLowerCase() || ''

  if (!q) return res.json([])

  const users = await prisma.user.findMany({
    where: {
      OR: [
        { email: { contains: q, mode: 'insensitive' } },
        { firstName: { contains: q, mode: 'insensitive' } },
        { lastName: { contains: q, mode: 'insensitive' } }
      ],
    },
    orderBy: { createdAt: 'desc' },
    take: 20
  })

  res.json(users)
})

// ─── Liste + recherche des profils ────────────────────────────────
router.get('/profils', async (req, res) => {
  const search = (req.query.search || '').toString().trim()

  try {
    const profils = await prisma.profile.findMany({
      where: search
        ? {
            OR: [
              { firstname: { contains: search, mode: 'insensitive' } },
              { lastname: { contains: search, mode: 'insensitive' } },
              { bio: { contains: search, mode: 'insensitive' } },
              { siret: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {},
      include: {
        User: true,
      },
      orderBy: { id: 'desc' },
      take: 50,
    })

    res.json(profils)
  } catch (e) {
    console.error('Erreur /api/admin/profils', e)
    res.status(500).json({ error: 'Erreur récupération profils' })
  }
})


// ─── Confirmer un email manuellement ───────────────────────────────
router.post('/confirm-email', async (req, res) => {
  const { email } = req.body || {}
  if (!email) return res.status(400).json({ error: 'Email requis' })

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } })
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' })

  await prisma.user.update({
    where: { id: user.id },
    data: { emailConfirmed: true, emailConfirmationToken: null },
  })
  res.json({ success: true })
})

// ─── Fallback pour les anciennes routes admin ─────────────────────
router.use((_req, res) => {
  res.status(404).json({ error: 'Route admin indisponible' })
})

module.exports = router
