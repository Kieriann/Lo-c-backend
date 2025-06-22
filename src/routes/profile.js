const express = require('express')
const router = express.Router()
const multer = require('multer')
const fs = require('fs')
const path = require('path')
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
const authenticateToken = require('../middlewares/authMiddleware')

router.use(authenticateToken)

const uploadDir = path.join(__dirname, '../../uploads')
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true })

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, file.originalname)
})
const upload = multer({ storage })

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

      // availableDate optionnel
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
        await prisma.experience.create({
          data: {
            title: exp.title,
            client: exp.client || '',
            description: exp.description,
            domains: exp.domains || '',
            skills: JSON.stringify(exp.skills || []),
            languages: Array.isArray(exp.languages) ? exp.languages : [],
            realTitle: exp.realTitle || '',
            realDescription: exp.realDescription || '',
            realFilePath: exp.realFilePath || '',
            userId
          }
        })
      }

      // Prestations
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
    fs.unlinkSync(path.join(uploadDir, photoDoc.fileName))
    await prisma.document.delete({ where: { id: photoDoc.id } })
  }
}

if (req.body.removeCV === 'true') {
  const cvDoc = await prisma.document.findFirst({ where: { userId, type: 'CV' } })
  if (cvDoc) {
    fs.unlinkSync(path.join(uploadDir, cvDoc.fileName))
    await prisma.document.delete({ where: { id: cvDoc.id } })
  }
}


      const photoFile = req.files?.photo?.[0]
      const cvFile    = req.files?.cv?.[0]

if (photoFile) {
  await prisma.document.create({
    data: {
      userId,
      type: 'ID_PHOTO',
      fileName: photoFile.filename,
      originalName: photoFile.originalname
    }
  })
}

if (cvFile) {
  await prisma.document.create({
    data: {
      userId,
      type: 'CV',
      fileName: cvFile.filename,
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
      where: { id: userId },
      select: {
        isAdmin: true,
        Profile: { include: { Address: true } }
      }
    })

    const experiences = await prisma.experience.findMany({ where: { userId } })
    const prestations = await prisma.prestation.findMany({ where: { userId } })

    const documents = await prisma.document.findMany({
      where: { userId },
      select: {
        id: true,
        type: true,
        fileName: true,
        originalName: true
      }
    })

    res.json({
      isAdmin: user.isAdmin,
      profile: user.Profile,
      experiences,
      documents,
      prestations
    })
  } catch (err) {
    console.error('Erreur GET /profil', err)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

    const experiences = await prisma.experience.findMany({ where: { userId } })
const documents = await prisma.document.findMany({
  where: { userId },
  select: {
    id: true,
    fileName: true,
    originalName: true,
    type: true
  }
})
    const prestations = await prisma.prestation.findMany({ where: { userId } })

    res.json({
      isAdmin: user.isAdmin,
      profile: user.Profile,
      experiences,
      documents,
      prestations
    })
  } catch (err) {
    console.error('Erreur GET /profil', err)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

module.exports = router
