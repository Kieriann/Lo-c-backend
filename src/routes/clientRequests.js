const router = require('express').Router()
const prisma = require('../utils/prismaClient')
const requireAuth = require('../middlewares/authMiddleware')
const { requireRole } = require('../middlewares/roles')
const { cleanText, positiveInt } = require('../utils/security')

// map front -> enum prisma
const kindMap = {
  expertise: 'EXPERTISE',
  mission: 'MISSION',
  outil: 'OUTIL',
  preembauche: 'PREEMBAUCHE',
  alternance: 'ALTERNANCE',
}

router.use(requireAuth, requireRole('CLIENT'))

function normalizeTechnologyRows(rows) {
  if (!Array.isArray(rows) || rows.length > 30) return []
  return rows
    .map(row => ({
      technology: cleanText(row?.technology, { max: 80 }),
      level: ['JUNIOR', 'MEDIUM', 'EXPERT'].includes(String(row?.level || '').toUpperCase())
        ? String(row.level).toUpperCase()
        : 'JUNIOR',
      weight: positiveInt(row?.weight, { min: 0, max: 10, fallback: 0 }),
    }))
    .filter(row => row.technology)
}

// GET /api/client-requests (liste du client courant)
router.get('/', requireAuth, async (req, res) => {
  try {
    const rows = await prisma.clientRequest.findMany({
      where: { userId: req.user.userId },
      include: {
        city: true,
        technologies: true,
      },
      orderBy: { createdAt: 'desc' },
    })
    res.json(rows)
  } catch (e) {
    res.status(500).json({ error: 'Erreur liste demandes' })
  }
})

// GET /api/client-requests/:id
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const id = positiveInt(req.params.id, { min: 1 })
    if (!id) return res.status(400).json({ error: 'ID_INVALID' })
    const row = await prisma.clientRequest.findFirst({
      where: { id, userId: req.user.userId },
      include: { city: true, technologies: true },
    })
    if (!row) return res.status(404).json({ error: 'Introuvable' })
    res.json(row)
  } catch {
    res.status(500).json({ error: 'Erreur lecture' })
  }
})

// POST /api/client-requests
router.post('/', requireAuth, async (req, res) => {
  try {
    const {
      kind, // 'expertise' | 'mission' | 'preembauche' | 'alternance'
      tjmMin, tjmMax, tjmWeight,
      location, // { mode:'remote'|'onsite', city?, days?, weight? }
      technologies = [], // [{ technology, level, weight }]

      // Expertise
      expertiseObjective,
      expertiseDuration,

      // Pré-embauche
      prehireJobTitle,
      prehireContractType,
      prehireTrialPeriod,
      prehireCompensation,

      // Alternance
      alternanceJobTitle,
      alternanceDescription,
      alternanceRemuMode,   // 'BAREME' | 'SUPERIEURE'
      alternanceRemuAmount, // number (annuel brut)
    } = req.body || {}

    const kindUpper = kindMap[String(kind || '').toLowerCase()]
    if (!kindUpper) return res.status(400).json({ error: 'KIND_INVALID' })
    const technologyRows = normalizeTechnologyRows(technologies)
    const normalizedTjmMin = positiveInt(tjmMin, { min: 0, max: 10000 })
    const normalizedTjmMax = positiveInt(tjmMax, { min: 0, max: 10000 })
    const cityId = positiveInt(location?.city?.id, { min: 1 })
    if (normalizedTjmMin != null && normalizedTjmMax != null && normalizedTjmMin > normalizedTjmMax) {
      return res.status(400).json({ error: 'TJM_RANGE_INVALID' })
    }
    if (location?.mode === 'onsite' && !cityId) {
      return res.status(400).json({ error: 'CITY_REQUIRED' })
    }

    const data = {
      userId: req.user.userId,
      kind: kindUpper,
      tjmMin: normalizedTjmMin,
      tjmMax: normalizedTjmMax,
      tjmWeight: positiveInt(tjmWeight, { min: 0, max: 10, fallback: 0 }),
      locationMode: (location?.mode === 'onsite') ? 'ONSITE' : 'REMOTE',
      locationWeight: positiveInt(location?.weight, { min: 0, max: 10, fallback: 0 }),
      remoteDaysCount: (location?.mode === 'remote')
        ? positiveInt(location?.days, { min: 1, max: 5, fallback: 1 })
        : 0,
      city: (location?.mode === 'onsite')
        ? { connect: { id: cityId } }
        : undefined,

      // Champs conditionnels
      ...(kindUpper === 'EXPERTISE' ? {
        expertiseObjective: cleanText(expertiseObjective, { max: 2000 }) || null,
        expertiseDuration: cleanText(expertiseDuration, { max: 120 }) || null,
      } : {}),

      ...(kindUpper === 'PREEMBAUCHE' ? {
        prehireJobTitle: cleanText(prehireJobTitle, { max: 160 }) || null,
        prehireContractType: cleanText(prehireContractType, { max: 80 }) || null,
        prehireTrialPeriod: cleanText(prehireTrialPeriod, { max: 80 }) || null,
        prehireCompensation: positiveInt(prehireCompensation, { min: 0, max: 1_000_000 }),
      } : {}),

      ...(kindUpper === 'ALTERNANCE' ? {
        alternanceJobTitle: cleanText(alternanceJobTitle, { max: 160 }) || null,
        alternanceDescription: cleanText(alternanceDescription, { max: 2000 }) || null,
        alternanceRemuMode: (alternanceRemuMode === 'SUPERIEURE') ? 'SUPERIEURE' : 'BAREME',
        alternanceRemuAmount: (alternanceRemuMode === 'SUPERIEURE')
          ? positiveInt(alternanceRemuAmount, { min: 0, max: 1_000_000 })
          : null,
      } : {}),

      technologies: {
        create: technologyRows,
      },
    }

    const created = await prisma.clientRequest.create({
      data,
      include: { city: true, technologies: true },
    })
    res.json({ id: created.id })
  } catch (e) {
    if (e.code === 'P2025') return res.status(400).json({ error: 'CITY_INVALID' })
    console.error('POST /client-requests failed:', e.code || e.message)
    res.status(500).json({ error: 'REQUEST_CREATE_FAILED' })
  }
})

// PUT /api/client-requests/:id
router.put('/:id', requireAuth, async (req, res) => {
  const id = Number(req.params.id)
  try {
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'ID_INVALID' })
    const ownedRequest = await prisma.clientRequest.findFirst({
      where: { id, userId: req.user.userId },
      select: { id: true },
    })
    if (!ownedRequest) return res.status(404).json({ error: 'NOT_FOUND' })

    const {
      kind,
      tjmMin, tjmMax, tjmWeight,
      location,
      technologies = [],

      // Expertise
      expertiseObjective,
      expertiseDuration,

      // Pré-embauche
      prehireJobTitle,
      prehireContractType,
      prehireTrialPeriod,
      prehireCompensation,

      // Alternance
      alternanceJobTitle,
      alternanceDescription,
      alternanceRemuMode,
      alternanceRemuAmount,
    } = req.body || {}

    const kindUpper = kindMap[String(kind || '').toLowerCase()]
    if (!kindUpper) return res.status(400).json({ error: 'KIND_INVALID' })
    const technologyRows = normalizeTechnologyRows(technologies)
    const normalizedTjmMin = positiveInt(tjmMin, { min: 0, max: 10000 })
    const normalizedTjmMax = positiveInt(tjmMax, { min: 0, max: 10000 })
    const cityId = positiveInt(location?.city?.id, { min: 1 })
    if (normalizedTjmMin != null && normalizedTjmMax != null && normalizedTjmMin > normalizedTjmMax) {
      return res.status(400).json({ error: 'TJM_RANGE_INVALID' })
    }
    if (location?.mode === 'onsite' && !cityId) {
      return res.status(400).json({ error: 'CITY_REQUIRED' })
    }

    const dataBase = {
      kind: kindUpper,
      tjmMin: normalizedTjmMin,
      tjmMax: normalizedTjmMax,
      tjmWeight: positiveInt(tjmWeight, { min: 0, max: 10, fallback: 0 }),
      locationMode: (location?.mode === 'onsite') ? 'ONSITE' : 'REMOTE',
      locationWeight: positiveInt(location?.weight, { min: 0, max: 10, fallback: 0 }),
      remoteDaysCount: (location?.mode === 'remote')
        ? positiveInt(location?.days, { min: 1, max: 5, fallback: 1 })
        : 0,
      city: (location?.mode === 'onsite')
        ? { connect: { id: cityId } }
        : { disconnect: true },

      // On nettoie systématiquement les champs spécifiques, puis on remet ceux du kind
      expertiseObjective: null,
      expertiseDuration: null,
      prehireJobTitle: null,
      prehireContractType: null,
      prehireTrialPeriod: null,
      prehireCompensation: null,
      alternanceJobTitle: null,
      alternanceDescription: null,
      alternanceRemuMode: null,
      alternanceRemuAmount: null,
    }

    if (kindUpper === 'EXPERTISE') {
      dataBase.expertiseObjective = cleanText(expertiseObjective, { max: 2000 }) || null
      dataBase.expertiseDuration = cleanText(expertiseDuration, { max: 120 }) || null
    } else if (kindUpper === 'PREEMBAUCHE') {
      dataBase.prehireJobTitle = cleanText(prehireJobTitle, { max: 160 }) || null
      dataBase.prehireContractType = cleanText(prehireContractType, { max: 80 }) || null
      dataBase.prehireTrialPeriod = cleanText(prehireTrialPeriod, { max: 80 }) || null
      dataBase.prehireCompensation = positiveInt(prehireCompensation, { min: 0, max: 1_000_000 })
    } else if (kindUpper === 'ALTERNANCE') {
      dataBase.alternanceJobTitle = cleanText(alternanceJobTitle, { max: 160 }) || null
      dataBase.alternanceDescription = cleanText(alternanceDescription, { max: 2000 }) || null
      dataBase.alternanceRemuMode = (alternanceRemuMode === 'SUPERIEURE') ? 'SUPERIEURE' : 'BAREME'
      dataBase.alternanceRemuAmount = (alternanceRemuMode === 'SUPERIEURE')
        ? positiveInt(alternanceRemuAmount, { min: 0, max: 1_000_000 })
        : null
    }

    const updated = await prisma.clientRequest.update({
      where: { id },
      data: {
        ...dataBase,
        technologies: {
          deleteMany: {}, // reset
          create: technologyRows,
        },
      },
      include: { city: true, technologies: true },
    })

    res.json({ id: updated.id })
  } catch (e) {
    if (e.code === 'P2025') return res.status(400).json({ error: 'CITY_INVALID' })
    res.status(500).json({ error: 'Erreur mise à jour' })
  }
})

module.exports = router
