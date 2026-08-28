const express = require('express')
const multer = require('multer')
const prisma = require('../utils/prismaClient')
const authenticateToken = require('../middlewares/authMiddleware')
const { requireRole } = require('../middlewares/roles')
const { assetUrl, uploadImage, uploadDocument, deleteFile } = require('../utils/cloudinary')
const { cleanText, isValidEmail, positiveInt, safeHttpUrl } = require('../utils/security')

const router = express.Router()

router.use(authenticateToken, requireRole('INDEP'))

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 2, fields: 20 },
  fileFilter: (_req, file, callback) => {
    const allowed = file.fieldname === 'photo'
      ? new Set(['image/jpeg', 'image/png', 'image/gif'])
      : file.fieldname === 'cv'
        ? new Set(['application/pdf'])
        : new Set()
    const accepted = allowed.has(file.mimetype)
    callback(accepted ? null : new multer.MulterError('LIMIT_UNEXPECTED_FILE'), accepted)
  },
})

const safeParse = (value, fallback) => {
  try { return JSON.parse(value ?? '') } catch { return fallback }
}

const validDate = value => {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

const profileInput = raw => {
  const email = cleanText(raw.email, { max: 254 })
  if (email && !isValidEmail(email)) throw Object.assign(new Error('Adresse email invalide'), { status: 400 })

  return {
    firstname: cleanText(raw.firstname, { max: 100 }),
    lastname: cleanText(raw.lastname, { max: 100 }),
    phone: cleanText(raw.phone, { max: 40 }),
    email: email || null,
    bio: cleanText(raw.bio, { max: 5000 }),
    languages: cleanText(raw.languages, { max: 2000 }),
    siret: cleanText(raw.siret, { max: 20 }),
    registrationNumber: cleanText(raw.registrationNumber, { max: 100 }),
    smallDayRate: positiveInt(raw.smallDayRate, { max: 100000, fallback: 0 }),
    mediumDayRate: positiveInt(raw.mediumDayRate, { max: 100000, fallback: 0 }),
    highDayRate: positiveInt(raw.highDayRate, { max: 100000, fallback: 0 }),
    teleworkDays: positiveInt(raw.teleworkDays, { max: 7, fallback: 0 }),
    isEmployed: raw.isEmployed === true,
    availableDate: validDate(raw.availableDate),
    website: safeHttpUrl(raw.website) || null,
    workerStatus: raw.workerStatus === 'salarie' ? 'salarie' : 'indep',
    diffusionAutorisee: raw.diffusionAutorisee === true,
  }
}

const addressInput = raw => ({
  address: cleanText(raw.address, { max: 255 }),
  city: cleanText(raw.city, { max: 150 }),
  state: cleanText(raw.state, { max: 150 }),
  country: cleanText(raw.country, { max: 100 }),
  postalCode: cleanText(raw.postalCode, { max: 20 }),
  lat: Number.isFinite(Number(raw.lat)) && Number(raw.lat) >= -90 && Number(raw.lat) <= 90 ? Number(raw.lat) : null,
  lng: Number.isFinite(Number(raw.lng)) && Number(raw.lng) >= -180 && Number(raw.lng) <= 180 ? Number(raw.lng) : null,
})

const experienceInput = raw => ({
  title: cleanText(raw.title, { max: 200 }),
  client: cleanText(raw.client, { max: 200 }),
  description: cleanText(raw.description, { max: 5000 }),
  domains: cleanText(raw.domains, { max: 1000 }),
  skills: JSON.stringify(Array.isArray(raw.skills) ? raw.skills.slice(0, 100) : []),
  languages: Array.isArray(raw.languages)
    ? raw.languages.slice(0, 30).map(item => cleanText(item, { max: 100 })).filter(Boolean)
    : [],
})

const prestationInput = raw => ({
  type: cleanText(raw.type, { max: 100 }),
  tech: cleanText(raw.tech, { max: 100 }),
  level: cleanText(raw.level, { max: 30 }),
})

async function loadProfile(userId) {
  const [userMeta, profile, experiences, prestations, realisations, documents] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { isAdmin: true } }),
    prisma.profile.findUnique({ where: { userId }, include: { Address: true } }),
    prisma.experience.findMany({ where: { userId } }),
    prisma.prestation.findMany({ where: { userId } }),
    prisma.realisation.findMany({ where: { userId }, include: { files: true, technos: true } }),
    prisma.document.findMany({
      where: { userId },
      select: { id: true, type: true, originalName: true, publicId: true, version: true, format: true, deliveryType: true },
    }),
  ])

  return {
    isAdmin: userMeta?.isAdmin || false,
    memberStatus: profile?.memberStatus || null,
    profile: profile || {},
    address: profile?.Address || {},
    experiences,
    prestations,
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
    realisations: realisations.map(realisation => ({
      ...realisation,
      files: realisation.files.map(file => ({
        id: file.id,
        originalName: file.originalName,
        url: assetUrl({
          publicId: file.publicId,
          resourceType: 'raw',
          deliveryType: file.deliveryType,
          version: file.version,
          format: file.format,
        }),
      })),
    })),
  }
}

router.post('/profil', upload.fields([
  { name: 'photo', maxCount: 1 },
  { name: 'cv', maxCount: 1 },
]), async (req, res, next) => {
  try {
    const userId = req.user.id
    const rawProfile = safeParse(req.body.profile, null)
    const rawAddress = safeParse(req.body.address, null)
    const rawExperiences = safeParse(req.body.experiences, null)
    const rawPrestations = safeParse(req.body.prestations, null)

    if (!rawProfile || !rawAddress || !Array.isArray(rawExperiences) || !Array.isArray(rawPrestations)) {
      return res.status(400).json({ error: 'Données de profil invalides' })
    }
    if (rawExperiences.length > 50 || rawPrestations.length > 50) {
      return res.status(400).json({ error: 'Trop d’éléments dans le profil' })
    }

    const cleanProfile = profileInput(rawProfile)
    const cleanAddress = addressInput(rawAddress)
    const cleanExperiences = rawExperiences.map(experienceInput).filter(item => item.title || item.description)
    const cleanPrestations = rawPrestations.map(prestationInput).filter(item => item.type || item.tech)

    await prisma.$transaction(async tx => {
      const profile = await tx.profile.upsert({
        where: { userId },
        update: cleanProfile,
        create: { ...cleanProfile, userId },
      })
      await tx.address.upsert({
        where: { profileId: profile.id },
        update: cleanAddress,
        create: { ...cleanAddress, profileId: profile.id },
      })
      await tx.experience.deleteMany({ where: { userId } })
      if (cleanExperiences.length) {
        await tx.experience.createMany({ data: cleanExperiences.map(item => ({ ...item, userId })) })
      }
      await tx.prestation.deleteMany({ where: { userId } })
      if (cleanPrestations.length) {
        await tx.prestation.createMany({ data: cleanPrestations.map(item => ({ ...item, userId })) })
      }
    })

    const photoFile = req.files?.photo?.[0]
    const cvFile = req.files?.cv?.[0]
    const currentDocuments = await prisma.document.findMany({ where: { userId, type: { in: ['ID_PHOTO', 'cv'] } } })
    const obsolete = []

    if (photoFile) {
      const result = await uploadImage(photoFile.buffer, userId)
      const previous = currentDocuments.filter(doc => doc.type === 'ID_PHOTO')
      await prisma.$transaction([
        prisma.document.deleteMany({ where: { userId, type: 'ID_PHOTO' } }),
        prisma.document.create({ data: {
          userId, type: 'ID_PHOTO', fileName: photoFile.originalname, originalName: photoFile.originalname,
          publicId: result.publicId, version: Number(result.version) || null, format: result.format,
          deliveryType: 'authenticated',
        } }),
      ])
      obsolete.push(...previous.map(doc => ({ ...doc, resourceType: 'image' })))
    } else if (req.body.removePhoto === 'true') {
      obsolete.push(...currentDocuments.filter(doc => doc.type === 'ID_PHOTO').map(doc => ({ ...doc, resourceType: 'image' })))
      await prisma.document.deleteMany({ where: { userId, type: 'ID_PHOTO' } })
    }

    if (cvFile) {
      const result = await uploadDocument(cvFile.buffer, userId)
      const previous = currentDocuments.filter(doc => doc.type === 'cv')
      await prisma.$transaction([
        prisma.document.deleteMany({ where: { userId, type: 'cv' } }),
        prisma.document.create({ data: {
          userId, type: 'cv', fileName: cvFile.originalname, originalName: cvFile.originalname,
          publicId: result.publicId, version: Number(result.version) || null, format: 'pdf',
          deliveryType: 'authenticated',
        } }),
      ])
      obsolete.push(...previous.map(doc => ({ ...doc, resourceType: 'raw' })))
    } else if (req.body.removeCV === 'true') {
      obsolete.push(...currentDocuments.filter(doc => doc.type === 'cv').map(doc => ({ ...doc, resourceType: 'raw' })))
      await prisma.document.deleteMany({ where: { userId, type: 'cv' } })
    }

    await Promise.allSettled(obsolete.map(doc => deleteFile(doc.publicId, doc.resourceType, doc.deliveryType)))
    res.set('Cache-Control', 'no-store')
    return res.status(200).json(await loadProfile(userId))
  } catch (error) {
    console.error('Erreur POST /api/profile/profil:', error)
    return next(error)
  }
})

router.get('/profil', async (req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store')
    return res.json(await loadProfile(req.user.id))
  } catch (error) {
    console.error('Erreur GET /api/profile/profil:', error)
    return next(error)
  }
})

module.exports = router
