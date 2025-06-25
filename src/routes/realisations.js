const express = require('express')
const router = express.Router()
const multer = require('multer')
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
const authenticateToken = require('../middlewares/authMiddleware')
const { v2: cloudinary } = require('cloudinary')
const streamifier = require('streamifier')

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

router.use(authenticateToken)

const upload = multer({ storage: multer.memoryStorage() })
function sanitizeFileName(name) {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '_')
}

// POST /api/realisations
router.post('/', upload.array('realFiles'), async (req, res) => {
  try {
    const userId = req.user.id
    const data = JSON.parse(req.body.data)
    const files = Array.isArray(req.files) ? req.files : [req.files].filter(Boolean)

    // Supprime tous les fichiers et réalisations précédentes de l'utilisateur
    await prisma.realisationFile.deleteMany({
      where: {
        realisation: {
          userId
        }
      }
    })
    await prisma.realisation.deleteMany({
      where: { userId }
    })

    // Parcours des réalisations à créer
    for (let i = 0; i < data.length; i++) {
      const r = data[i]
      const relatedFiles = files.filter(f => f.originalname && f.originalname.startsWith(`real-${i}-`))

      // Création de la réalisation
      const created = await prisma.realisation.create({
        data: {
          title: r.title,
          description: r.description,
          techs: r.techs,
          userId,
        }
      })

      // Upload et enregistrement des fichiers associés
      for (const f of relatedFiles) {
        if (!f?.buffer) continue

        const result = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            { folder: 'realisations', resource_type: 'raw' },
            (err, res) => (err ? reject(err) : resolve(res))
          )
          streamifier.createReadStream(f.buffer).pipe(stream)
        })

        await prisma.realisationFile.create({
          data: {
            realisationId: created.id,
            fileName: `v${result.version}/${result.public_id}.${result.format || 'pdf'}`,
            version: String(result.version),
            public_id: result.public_id,
            format: result.format || 'pdf',
originalName: f.originalName.replace(/\s+/g, '_'),
          }
        })
      }
    }

    res.status(200).json({ success: true })
  } catch (err) {
    console.error('Erreur POST /realisations', err)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

// GET /api/realisations
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id

    const rawRealisations = await prisma.realisation.findMany({
      where: { userId },
      include: { files: true }
    })

const realisations = rawRealisations.map(r => ({
  id: r.id,
  title: r.title,
  description: r.description,
  techs: r.techs,
  files: (r.files || []).map(f => ({
    id: f.id,
    public_id: f.public_id,
    version: f.version,
    format: f.format,
originalName: f.originalName.replace(/\s+/g, '_'),
    resourceType: f.resourceType
  }))
}))

res.json(realisations)
  } catch (err) {
    console.error('Erreur GET /realisations', err)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

module.exports = router