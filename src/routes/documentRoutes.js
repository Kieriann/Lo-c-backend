const express = require('express')
const router = express.Router()
const prisma = require('../utils/prismaClient')
const authMiddleware = require('../middlewares/authMiddleware')
const { assetUrl } = require('../utils/cloudinary')

// ─── Route : récupérer les documents du user connecté ────────────────
router.get('/me', authMiddleware, async (req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store')
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
  format: true,
  deliveryType: true,
}

    })

    res.json(documents.map(doc => ({
      id: doc.id,
      type: doc.type,
      fileName: doc.fileName,
      originalName: doc.originalName,
      url: assetUrl({
        publicId: doc.publicId,
        resourceType: doc.type === 'ID_PHOTO' ? 'image' : 'raw',
        deliveryType: doc.deliveryType,
        version: doc.version,
        format: doc.format,
      }),
    })))
  } catch (err) {
    next(err)
  }
})

// ─── Route : compter tous les CV enregistrés ─────────────────────────
router.get('/count-cv', async (_req, res) => {
  try {
    const count = await prisma.document.count({
      where: { type: { equals: 'cv', mode: 'insensitive' } }
    })
    res.set('Cache-Control', 'public, max-age=300')
    res.json({ count })
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
    const count = rows.length
    res.set('Cache-Control', 'public, max-age=300')
    res.json({ count })
  } catch (err) {
    next(err)
  }
})

// ─── Compter TOUS les profils créés ─────────────────────────────────
router.get('/count-profiles', async (_req, res, next) => {
  try {
    const count = await prisma.profile.count({
      where: { User: { is: { emailConfirmed: true, role: 'INDEP' } } },
    })
    res.set('Cache-Control', 'public, max-age=300')
    res.json({ count })
  } catch (err) {
    next(err)
  }
})



module.exports = router
