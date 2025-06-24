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


router.post(
  '/profil',
  upload.fields([
    { name: 'photo' },
    { name: 'cv' },
    { name: 'realFiles' }
  ]),
  async (req, res) => {
    try {
      const userId = req.user.id
      const profileData     = JSON.parse(req.body.profile)
      const addressData     = JSON.parse(req.body.address)
      const experiencesData = JSON.parse(req.body.experiences)
      const prestationsData = JSON.parse(req.body.prestations)

      const { availableDate, ...restProfile } = profileData
      const availableDateParsed = availableDate ? new Date(availableDate) : undefined

      const profile = await prisma.profile.upsert({
        where: { userId },
        update: {
          ...restProfile,
          ...(availableDateParsed && { availableDate: availableDateParsed })
        },
        create: {
          ...restProfile,
          ...(availableDateParsed && { availableDate: availableDateParsed }),
          userId
        }
      })

      await prisma.address.upsert({
        where: { profileId: profile.id },
        update: { ...addressData },
        create: { ...addressData, profileId: profile.id }
      })

      await prisma.experience.deleteMany({ where: { userId } })

      const realFiles = req.files?.realFiles || []
      for (let i = 0; i < experiencesData.length; i++) {
        const exp = experiencesData[i]
const file = realFiles.find(f => f.originalname === exp.realFile?.name)
const buffer = file?.buffer
        let cloudinaryResult = null

        if (buffer) {
          cloudinaryResult = await new Promise((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(
            { folder: 'realisations', resource_type: 'raw' },

              (err, result) => {
                if (err) reject(err)
                else resolve(result)
              }
            )
            streamifier.createReadStream(buffer).pipe(stream)
          })
        }

await prisma.experience.create({
  data: {
    title: exp.title,
    client: exp.client || '',
    description: exp.description,
    domains: exp.domains || '',
    skills: JSON.stringify(exp.skills || []),
    languages: Array.isArray(exp.languages) ? exp.languages : [],
    userId
  }
})

      }

      await prisma.prestation.deleteMany({ where: { userId } })
      for (const p of prestationsData) {
        await prisma.prestation.create({
          data: {
            type: p.type || '',
            tech: p.tech || '',
            level: p.level || '',
            userId
          }
        })
      }

      if (req.body.removePhoto === 'true') {
        const photoDoc = await prisma.document.findFirst({ where: { userId, type: 'ID_PHOTO' } })
        if (photoDoc) {
          await cloudinary.uploader.destroy(photoDoc.fileName)
          await prisma.document.delete({ where: { id: photoDoc.id } })
        }
      }

      if (req.body.removeCV === 'true') {
        const cvDoc = await prisma.document.findFirst({ where: { userId, type: 'CV' } })
        if (cvDoc) {
          await cloudinary.uploader.destroy(cvDoc.fileName, { resource_type: 'raw' })
          await prisma.document.delete({ where: { id: cvDoc.id } })
        }
      }

      const photoFile = req.files?.photo?.[0]
      const cvFile    = req.files?.cv?.[0]

      if (photoFile) {
        const result = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            { folder: 'photos' },
            (err, result) => {
              if (err) reject(err)
              else resolve(result)
            }
          )
          streamifier.createReadStream(photoFile.buffer).pipe(stream)
        })

const photoFileName = `v${result.version}/${result.public_id}`

await prisma.document.create({
  data: {
    userId,
    type: 'ID_PHOTO',
    fileName: photoFileName,
    originalName: photoFile.originalname
  }
})
      }

      if (cvFile) {
        const result = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            { folder: 'cv', resource_type: 'raw' },
            (err, result) => {
              if (err) reject(err)
              else resolve(result)
            }
          )
          streamifier.createReadStream(cvFile.buffer).pipe(stream)
        })

        const cvFileName = `v${result.version}/${result.public_id}.${result.format || 'pdf'}`

await prisma.document.create({
  data: {
    userId,
    type: 'CV',
    fileName: cvFileName,
    originalName: cvFile.originalname
  }
})

      }

      res.status(200).json({ success: true })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Erreur serveur' })
    }
  }
)

router.get('/profil', async (req, res) => {
  try {
    const userId = req.user.id

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        Profile: { include: { Address: true } },
        Documents: true,
        Experiences: true,
        Prestations: true,
        realisations: {
          include: {
            files: true
          }
        }
      }
    })

    const documents = await prisma.document.findMany({
      where: { userId },
      select: {
        id: true,
        fileName: true,
        originalName: true,
        type: true
      }
    })

    res.json({
      isAdmin: user.isAdmin,
      profile: user.Profile,
      experiences: user.Experiences,
      documents,
      prestations: user.Prestations,
      realisations: user.realisations.map(r => ({
        title: r.title,
        description: r.description,
        techs: r.techs,
       files: r.files.map(f => ({
  version: f.version,
  public_id: f.public_id,
  format: f.format,
  originalName: f.originalName
}))

      }))
    })
  } catch (err) {
    console.error('Erreur GET /profil', err)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})


module.exports = router