const express = require('express')
const router = express.Router()
const multer = require('multer')
const upload = multer()
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
const authenticateToken = require('../middlewares/authMiddleware')
router.use(authenticateToken)



router.post('/profil', upload.fields([{ name: 'photo' }, { name: 'cv' }]), async (req, res) => {
  try {
    const userId = req.user.id // ou extrait du token
    const profileData = JSON.parse(req.body.profile)
    const addressData = JSON.parse(req.body.address)
    const experiencesData = JSON.parse(req.body.experiences)

    // 1. Créer ou mettre à jour Profile
    const profile = await prisma.profile.upsert({
      where: { userId },
      update: { ...profileData },
      create: { ...profileData, userId },
    })

    // 2. Créer ou mettre à jour Address
    await prisma.address.upsert({
      where: { profileId: profile.id },
      update: { ...addressData },
      create: { ...addressData, profileId: profile.id },
    })

    // 3. Supprimer les expériences précédentes
    await prisma.experience.deleteMany({ where: { userId } })

    // 4. Recréer les expériences
for (const exp of experiencesData) {
  await prisma.experience.create({
    data: {
      title: exp.title,
      description: exp.description,
      skills: JSON.stringify(exp.skills || []),
      languages: JSON.stringify(exp.languages || []),
      userId,
    },
  })
}



    // 5. Sauvegarder les fichiers (facultatif)
    const photoFile = req.files?.photo?.[0]
    const cvFile = req.files?.cv?.[0]

    if (photoFile) {
      await prisma.document.upsert({
        where: { userId },
        update: { type: 'ID_PHOTO' },
        create: { userId, type: 'ID_PHOTO' },
      })
    }

    if (cvFile) {
      await prisma.document.upsert({
        where: { userId },
        update: { type: 'CV' },
        create: { userId, type: 'CV' },
      })
    }

    res.status(200).json({ success: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

router.get('/profil', async (req, res) => {
  try {
    const userId = req.user.id // ou à adapter selon ton système d'auth

    const profile = await prisma.profile.findUnique({
      where: { userId },
      include: {
        Address: true,
      },
    })

    const experiences = await prisma.experience.findMany({
      where: { userId },
    })

    const documents = await prisma.document.findMany({
      where: { userId },
    })

    res.json({
      profile,
      experiences,
      documents,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})


module.exports = router
