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
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

router.use(authenticateToken)

const upload = multer({ storage: multer.memoryStorage() })

router.post(
  '/',
  upload.any(),
  async (req, res) => {
    try {
      const userId = req.user.id
      const data = JSON.parse(req.body.data)
      const realFilesGrouped = {}

      for (const file of req.files || []) {
        const match = file.originalname.match(/^real-(\d+)-/)
        if (match) {
          const idx = match[1]
          if (!realFilesGrouped[idx]) realFilesGrouped[idx] = []
          realFilesGrouped[idx].push(file)
        }
      }

const data = JSON.parse(req.body.data)
const idsToKeep = []

for (const r of data) {
  for (const f of (r.files || [])) {
    if (f.id) idsToKeep.push(f.id)
  }
}


      await prisma.techno.deleteMany({
  where: {
    realisation: {
      userId
    }
  }
})
await prisma.realisationFile.deleteMany({
  where: {
    realisation: { userId },
    NOT: { id: { in: idsToKeep } }
  }
})

await prisma.realisation.deleteMany({
  where: { userId }
})


      for (let i = 0; i < data.length; i++) {
        const r = data[i]
        const relatedDocs = realFilesGrouped[i] || []

        await prisma.$transaction(async (tx) => {
          const createdReal = await tx.realisation.create({
            data: {
              title: r.title,
              description: r.description,
              userId,
            },
          })

          if (Array.isArray(r.techs)) {
            for (const t of r.techs) {
              await tx.techno.create({
                data: {
                  name: t.name,
                  level: t.level,
                  realisationId: createdReal.id,
                },
              })
            }
          }

          for (const doc of relatedDocs) {
            if (!doc?.buffer) continue

            const result = await new Promise((resolve, reject) => {
              const stream = cloudinary.uploader.upload_stream(
                { folder: 'realisations' },
                (err, resUpload) => (err ? reject(err) : resolve(resUpload))
              )
              streamifier.createReadStream(doc.buffer).pipe(stream)
            })

            await tx.realisationFile.create({
              data: {
                realisationId: createdReal.id,
                fileName: result.original_filename || doc.originalname,
                version: result.version ? parseInt(result.version, 10) : null,
                publicId: (result.public_id || result.publicId || '').replace(/^realisations\//, ''),
                format: result.format || 'pdf',
                originalName: (doc.originalname || 'SansNom').replace(/\s+/g, '_'),
              },
            })
          }
        })
      }

      res.status(200).json({ success: true })
    } catch (err) {
      console.error('Erreur POST /realisations', err)
      res.status(500).json({ error: 'Erreur serveur' })
    }
  }
)

router.post(
  '/upload-document',
  authenticateToken,
  upload.single('document'),
  async (req, res) => {
    try {
      const userId = req.user.id
      const realisationId = Number(req.body.realisationId)
      if (!realisationId) {
        return res.status(400).json({ error: 'realisationId obligatoire' })
      }

      const file = req.file
      if (!file || !file.buffer) {
        return res.status(400).json({ error: 'Fichier manquant' })
      }

      const existingReal = await prisma.realisation.findUnique({
        where: { id: realisationId, userId }
      })
      if (!existingReal) {
        return res.status(404).json({ error: 'Réalisation non trouvée' })
      }

      const result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: 'realisations' },
          (error, output) => (error ? reject(error) : resolve(output))
        )
        streamifier.createReadStream(file.buffer).pipe(stream)
      })

      const savedFile = await prisma.realisationFile.create({
        data: {
          realisationId,
          fileName: result.original_filename || file.originalname,
          publicId: (result.public_id || result.publicId || '').replace(/^realisations\//, ''),
          version: result.version ? parseInt(result.version, 10) : null,
          format: result.format || 'pdf',
          originalName: (file.originalname || 'SansNom').replace(/\s+/g, '_'),
        },
      })

      res.json({ success: true, file: savedFile, cloudinary: result })
    } catch (error) {
      console.error('Erreur upload document réalisation:', error)
      res.status(500).json({ error: 'Erreur serveur' })
    }
  }
)

router.get('/', async (req, res) => {
  try {
    const userId = req.user.id

    const rawRealisations = await prisma.realisation.findMany({
      where: { userId },
      include: {
        files: true,
        techs: true,
      },
    })

const realisations = rawRealisations.map(r => ({
  id: r.id,
  title: r.title,
  description: r.description,
  techs: (r.techs || []).map(t => ({
    name: t.name,
    level: t.level,
  })),
  files: (r.files || []).map(f => ({
    id: f.id,
    publicId: f.publicId,
    version: f.version,
    format: f.format,
    originalName: (f.originalName || 'SansNom').replace(/\s+/g, '_'),
  })),
}))


    res.json(realisations)
  } catch (err) {
    console.error('Erreur GET /realisations', err)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

module.exports = router