const express = require('express')
const router = express.Router()
const prisma = require('../utils/prismaClient')
const authenticateToken = require('../middlewares/authMiddleware')
const { requireAdmin } = require('../middlewares/roles')
const { cleanText, normalizeEmail, positiveInt } = require('../utils/security')
const { assetUrl } = require('../utils/cloudinary')

// ─── Protection globale : JWT + rôle admin ─────────────────────────
router.use(authenticateToken, requireAdmin)

// ─── Recherche utilisateurs (moteur admin) ─────────────────────────
router.get('/search-users', async (req, res) => {
  const q = cleanText(req.query.query, { max: 100 }).toLowerCase()

  if (!q) return res.json([])

  const users = await prisma.user.findMany({
    where: {
      OR: [
        { email: { contains: q, mode: 'insensitive' } },
        { username: { contains: q, mode: 'insensitive' } },
        { Profile: { is: { firstname: { contains: q, mode: 'insensitive' } } } },
        { Profile: { is: { lastname: { contains: q, mode: 'insensitive' } } } },
      ],
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: {
      id: true, email: true, username: true, role: true,
      isAdmin: true, emailConfirmed: true, createdAt: true,
      Profile: { select: { firstname: true, lastname: true } },
    },
  })

  res.json(users)
})

// ─── Liste + recherche des profils ────────────────────────────────
router.get('/profils', async (req, res) => {
  const search = cleanText(req.query.search, { max: 100 })

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
        User: {
          select: { id: true, email: true, role: true, emailConfirmed: true, createdAt: true },
        },
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

router.get('/profil/:id', async (req, res) => {
  const profileId = positiveInt(req.params.id, { min: 1 })
  if (!profileId) return res.status(400).json({ error: 'Identifiant invalide' })

  try {
    const profile = await prisma.profile.findUnique({
      where: { id: profileId },
      include: {
        Address: true,
        User: { select: { id: true, email: true, role: true, emailConfirmed: true, createdAt: true } },
      },
    })
    if (!profile) return res.status(404).json({ error: 'Profil introuvable' })

    const [experiences, prestations, realisations, documents] = await Promise.all([
      prisma.experience.findMany({ where: { userId: profile.userId } }),
      prisma.prestation.findMany({ where: { userId: profile.userId } }),
      prisma.realisation.findMany({ where: { userId: profile.userId }, include: { files: true, technos: true } }),
      prisma.document.findMany({
        where: { userId: profile.userId },
        select: { id: true, type: true, originalName: true, publicId: true, version: true, format: true, deliveryType: true },
      }),
    ])
    res.set('Cache-Control', 'no-store')
    return res.json({
      profile,
      experiences,
      prestations,
      realisations: realisations.map(realisation => ({
        ...realisation,
        files: realisation.files.map(file => ({
          id: file.id,
          originalName: file.originalName,
          url: assetUrl({
            publicId: file.publicId, resourceType: 'raw', deliveryType: file.deliveryType,
            version: file.version, format: file.format,
          }),
        })),
      })),
      documents: documents.map(doc => ({
        id: doc.id,
        type: doc.type,
        originalName: doc.originalName,
        url: assetUrl({
          publicId: doc.publicId,
          resourceType: doc.type === 'ID_PHOTO' ? 'image' : 'raw',
          deliveryType: doc.deliveryType,
          version: doc.version,
          format: doc.format,
        }),
      })),
    })
  } catch (error) {
    console.error('Erreur /api/admin/profil/:id', error)
    return res.status(500).json({ error: 'Erreur récupération profil' })
  }
})


// ─── Confirmer un email manuellement ───────────────────────────────
router.post('/confirm-email', async (req, res) => {
  const email = normalizeEmail(req.body?.email)
  if (!email) return res.status(400).json({ error: 'Email requis' })

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } })
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' })

  await prisma.user.update({
    where: { id: user.id },
    data: { emailConfirmed: true, emailConfirmationToken: null, emailConfirmationExpiresAt: null },
  })
  res.json({ success: true })
})

// ─── Fallback pour les anciennes routes admin ─────────────────────
router.use((_req, res) => {
  res.status(404).json({ error: 'Route admin indisponible' })
})

module.exports = router
