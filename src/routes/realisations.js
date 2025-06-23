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

router.post('/', upload.array('realFiles'), async (req, res) => {
  try {
    const userId = req.user.id
    const data = JSON.parse(req.body.data)
    const files = req.files || []

    await prisma.realisation.deleteMany({ where: { userId } })

    for (let i = 0; i < data.length; i++) {
      const r = data[i]
      const file = files.find(f => f.originalname === r.realFile?.name)
      const buffer = file?.buffer
      let cloudResult = null

      if (buffer) {
        cloudResult = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            { folder: 'realisations', resource_type: 'raw' },
            (err, result) => {
              if (err) reject(err)
              else resolve(result)
            }
          )
          streamifier.createReadStream(buffer).pipe(stream)
        })
        console.log('cloudResult:', cloudResult)
      }

      await prisma.realisation.create({
        data: {
          title: r.realTitle,
          description: r.realDescription,
          techs: r.realTech,
fileName: cloudResult?.public_id + '.' + (r.realFile?.name?.split('.').pop() || 'pdf'),

          originalName: r.realFile?.name || '',
          userId
        }
      })
    }

    res.status(200).json({ success: true })
  } catch (err) {
    console.error('Erreur POST /realisations', err)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

router.get('/', async (req, res) => {
  try {
    const userId = req.user.id
    const realisations = await prisma.realisation.findMany({ where: { userId } })
    res.json(realisations)
  } catch (err) {
    console.error('Erreur GET /realisations', err)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

module.exports = router
