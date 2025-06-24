const express = require('express')
const router = express.Router()
const multer = require('multer')
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
const authenticateToken = require('../middlewares/authMiddleware')
const { uploadImage, uploadDocument } = require('../utils/cloudinaryUpload')

router.use(authenticateToken)

const upload = multer({ storage: multer.memoryStorage() })
function sanitizeFileName(name) {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // accents
    .replace(/[^a-zA-Z0-9._-]/g, '_') // tout sauf lettres, chiffres, point, tiret, underscore
    .replace(/\s+/g, '_') // espaces
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
        const experience = await prisma.experience.create({
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
        
        const file = realFiles.find(f => f.originalname === exp.realFile?.name)
if (file && file.buffer) {
  console.log("realFile:", file.originalname, file.mimetype, file.buffer.length)
  const cleanName = sanitizeFileName(file.originalname)
  const result = await uploadDocument(file.buffer, cleanName)

  await prisma.experienceFile.create({
    data: {
      experienceId: experience.id,
      public_id: result.public_id,
      version: result.version,
      format: result.format || cleanName.split('.').pop().toLowerCase(),
      originalName: cleanName
    }
  })
}
await prisma.document.delete({ where: { id: 12 } })

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
          // Optionally, destroy on Cloudinary if you wish:
          // await cloudinary.uploader.destroy(photoDoc.fileName)
          await prisma.document.delete({ where: { id: photoDoc.id } })
        }
      }

      if (req.body.removeCV === 'true') {
        const cvDoc = await prisma.document.findFirst({ where: { userId, type: 'CV' } })
        if (cvDoc) {
          // Optionally, destroy on Cloudinary if you wish:
          // await cloudinary.uploader.destroy(cvDoc.fileName, { resource_type: 'raw' })
          await prisma.document.delete({ where: { id: cvDoc.id } })
        }
      }

      const photoFile = req.files?.photo?.[0]
      const cvFile    = req.files?.cv?.[0]

      if (photoFile && photoFile.buffer) {
  console.log("photoFile:", photoFile.originalname, photoFile.mimetype, photoFile.buffer.length)
const cleanName = sanitizeFileName(photoFile.originalname).replace(/\.[^/.]+$/, '')
const result = await uploadImage(photoFile.buffer, cleanName)
  const photoFileName = `v${result.version}/${result.public_id}`

  await prisma.document.create({
    data: {
      userId,
      type: 'ID_PHOTO',
      fileName: photoFileName,
      originalName: cleanName
    }
  })
}



      if (cvFile && cvFile.buffer) {
  console.log("cvFile:", cvFile.originalname, cvFile.mimetype, cvFile.buffer.length)
const cleanName = sanitizeFileName(cvFile.originalname).replace(/\.[^/.]+$/, '')
  const result = await uploadDocument(cvFile.buffer, cleanName)

  const format = result.format || cvFile.originalname.split('.').pop().toLowerCase()
  const cvFileName = `v${result.version}/${result.public_id}.${format}`

  console.log('Création CV → fileName:', cvFileName)

  
  await prisma.document.create({
    data: {
      userId,
      type: 'CV',
      fileName: cvFileName,
      originalName: cleanName,
      format: format
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

console.log('Documents renvoyés:', documents)

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
          originalName: f.originalname.replace(/\s+/g, '_'),

        }))
      }))
    })
  } catch (err) {
    console.error('Erreur GET /profil', err)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

module.exports = router