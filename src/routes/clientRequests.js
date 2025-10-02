const router = require('express').Router()
const prisma = require('../utils/prismaClient')
const requireAuth = require('../middlewares/authMiddleware')

// map front -> enum prisma
const kindMap = {
  expertise: 'EXPERTISE',
  mission: 'MISSION',
  preembauche: 'PREEMBAUCHE',
  alternance: 'ALTERNANCE',
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
    const id = Number(req.params.id)
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

    const kindUpper = kindMap[kind] || 'EXPERTISE'

    const data = {
      userId: req.user.userId,
      kind: kindUpper,
      tjmMin: tjmMin ?? null,
      tjmMax: tjmMax ?? null,
      tjmWeight: Number.isFinite(Number(tjmWeight)) ? Number(tjmWeight) : 0,
      locationMode: (location?.mode === 'onsite') ? 'ONSITE' : 'REMOTE',
      locationWeight: Number.isFinite(Number(location?.weight)) ? Number(location.weight) : 0,
      remoteDaysCount: (location?.mode === 'remote')
        ? Math.max(1, Math.min(5, Number(location?.days) || 1))
        : 0,
      city: (location?.mode === 'onsite' && location?.city?.id)
        ? { connect: { id: Number(location.city.id) } }
        : undefined,

      // Champs conditionnels
      ...(kindUpper === 'EXPERTISE' ? {
        expertiseObjective: expertiseObjective ?? null,
        expertiseDuration: expertiseDuration ?? null,
      } : {}),

      ...(kindUpper === 'PREEMBAUCHE' ? {
        prehireJobTitle: prehireJobTitle ?? null,
        prehireContractType: prehireContractType ?? null,
        prehireTrialPeriod: prehireTrialPeriod ?? null,
        prehireCompensation: prehireCompensation ?? null,
      } : {}),

      ...(kindUpper === 'ALTERNANCE' ? {
        alternanceJobTitle: alternanceJobTitle ?? null,
        alternanceDescription: alternanceDescription ?? null,
        alternanceRemuMode: (alternanceRemuMode === 'SUPERIEURE') ? 'SUPERIEURE' : 'BAREME',
        alternanceRemuAmount: (alternanceRemuMode === 'SUPERIEURE')
          ? (Number(alternanceRemuAmount) || null)
          : null,
      } : {}),

      technologies: {
        create: technologies
          .filter(t => (t.technology || '').trim())
          .map(t => ({
            technology: t.technology.trim(),
            level: String(t.level || 'junior').toUpperCase(), // JUNIOR|MEDIUM|EXPERT
            weight: Number.isFinite(Number(t.weight)) ? Number(t.weight) : 0,
          })),
      },
    }

    const created = await prisma.clientRequest.create({
      data,
      include: { city: true, technologies: true },
    })
    res.json({ id: created.id })
  } catch (e) {
    console.error('POST /client-requests failed:', e)
    res.status(500).json({ error: e?.meta?.cause || e?.message || 'Erreur création' })
  }
})

// PUT /api/client-requests/:id
router.put('/:id', requireAuth, async (req, res) => {
  const id = Number(req.params.id)
  try {
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

    const kindUpper = kindMap[kind] || 'EXPERTISE'

    const dataBase = {
      kind: kindUpper,
      tjmMin: tjmMin ?? null,
      tjmMax: tjmMax ?? null,
      tjmWeight: Number.isFinite(Number(tjmWeight)) ? Number(tjmWeight) : 0,
      locationMode: (location?.mode === 'onsite') ? 'ONSITE' : 'REMOTE',
      locationWeight: Number.isFinite(Number(location?.weight)) ? Number(location.weight) : 0,
      remoteDaysCount: (location?.mode === 'remote')
        ? Math.max(1, Math.min(5, Number(location?.days) || 1))
        : 0,
      city: (location?.mode === 'onsite' && location?.city?.id)
        ? { connect: { id: Number(location.city.id) } }
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
      dataBase.expertiseObjective = expertiseObjective ?? null
      dataBase.expertiseDuration = expertiseDuration ?? null
    } else if (kindUpper === 'PREEMBAUCHE') {
      dataBase.prehireJobTitle = prehireJobTitle ?? null
      dataBase.prehireContractType = prehireContractType ?? null
      dataBase.prehireTrialPeriod = prehireTrialPeriod ?? null
      dataBase.prehireCompensation = prehireCompensation ?? null
    } else if (kindUpper === 'ALTERNANCE') {
      dataBase.alternanceJobTitle = alternanceJobTitle ?? null
      dataBase.alternanceDescription = alternanceDescription ?? null
      dataBase.alternanceRemuMode = (alternanceRemuMode === 'SUPERIEURE') ? 'SUPERIEURE' : 'BAREME'
      dataBase.alternanceRemuAmount = (alternanceRemuMode === 'SUPERIEURE')
        ? (Number(alternanceRemuAmount) || null)
        : null
    }

    const updated = await prisma.clientRequest.update({
      where: { id },
      data: {
        ...dataBase,
        technologies: {
          deleteMany: {}, // reset
          create: technologies
            .filter(t => (t.technology || '').trim())
            .map(t => ({
              technology: t.technology.trim(),
              level: String(t.level || 'junior').toUpperCase(),
              weight: Number.isFinite(Number(t.weight)) ? Number(t.weight) : 0,
            })),
        },
      },
      include: { city: true, technologies: true },
    })

    // sécurité: appartenance
    if (updated.userId !== req.user.userId) {
      return res.status(403).json({ error: 'Interdit' })
    }

    res.json({ id: updated.id })
  } catch (e) {
    res.status(500).json({ error: 'Erreur mise à jour' })
  }
})

module.exports = router
