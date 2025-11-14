const router = require('express').Router()
const prisma = require('../utils/prismaClient')
const requireAuth = require('../middlewares/authMiddleware')
const { geocodeCity } = require('../utils/geocode')

// ── Niveaux & similarités ───────────────────────────────────────────
const LEVEL_ORDER = ['beginner','junior','intermediate','senior','expert']
const LEVEL_CENTERS = { beginner:0.2, junior:0.4, intermediate:0.6, senior:0.8, expert:1 }

const normLevel = (v) => String(v || '').toLowerCase().trim()
const levelIndex = (v) => {
  if (!v) return -1
  const i = LEVEL_ORDER.indexOf(String(v).toLowerCase())
  return i === -1 ? -1 : i
}

const levelSimilarity = (requested, found) => {
  const r = levelIndex(requested), f = levelIndex(found)
  if (r === -1 || f === -1) return 0
  if (f >= r) return 1
  const gap = r - f
  const steps = [1, 0.8, 0.6, 0.4, 0.2, 0] 
  return steps[Math.min(gap, 5)]
}


// Numérique (0..1) <-> libellé
const levelToNum = (lv) => {
  const s = normLevel(lv)
  if (s === 'expert') return 1
  if (s === 'senior') return 0.85
  if (s === 'medium') return 0.66
  if (s === 'intermediaire' || s === 'intermédiaire' || s === 'intermediate') return 0.5
  if (s === 'junior') return 0.33
  if (s === 'beginner' || s === 'debutant' || s === 'débutant') return 0.1
  const n = Number(lv)
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0.5
}

const numToNearestLevel = (x) => {
  const v = Math.max(0, Math.min(1, Number(x) || 0))
  if (v < 0.30) return 'beginner'
  if (v < 0.50) return 'junior'
  if (v < 0.70) return 'intermediate'
  if (v < 0.90) return 'senior'
  return 'expert'
}


/**
 * POST /api/shortlist/compute
 * Body :
 *  A) { clientRequestId: number }
 *  B) { criteria: {...}, weights: {...} }
 * Retour : [{ userId, score, details }] trié desc, max 10.
 */
router.post('/compute', requireAuth, async (req, res) => {
  if (!req.user || (req.user.role !== 'CLIENT' && !req.user.isAdmin)) {
    return res.status(403).json({ error: 'Accès réservé aux clients' })
  }

  try {
    // 1) Charger critères + poids
    let criteria = null
    let weights = null

    if (req.body.clientRequestId) {
      const cr = await prisma.clientRequest.findUnique({
        where: { id: Number(req.body.clientRequestId) },
        include: { city: true, technologies: true }
      })
      if (!cr) return res.status(404).json({ error: 'Demande introuvable' })

      criteria = {
        kind: cr.kind,
        cityId: cr.cityId || (cr.city ? cr.city.id : null),
        remote: (cr.locationMode || 'REMOTE') === 'REMOTE',
        remoteDaysCount: cr.remoteDaysCount ?? 0,
        tjmMin: cr.tjmMin ?? null,
        tjmMax: cr.tjmMax ?? null,
        startDate: null,
        // technologies: [{ name, level, weight }]
        technologies: (cr.technologies || []).map(t => ({
          name: t.name,
          level: t.level,
          weight: t.weight ?? 1,
        })),
      }

weights = {
  skills: cr.skillsWeight ?? 5,
  tjm: cr.tjmWeight ?? 3,
  telework: cr.teleworkWeight ?? 2,
  availability: cr.availabilityWeight ?? 2,
}
    } else {
      criteria = req.body.criteria || {}
      weights  = req.body.weights  || {}
      weights.skills ??= 5
      weights.tjm ??= 3
      weights.telework ??= 2
      weights.availability ??= 2
    }

// Sécuriser côté serveur : pour EXPERTISE on annule tjm/télétravail
if (String(criteria.kind || '').toUpperCase() === 'EXPERTISE') {
  weights.tjm = 0
  weights.telework = 0
}


    const norm = s => String(s || '')
      .normalize('NFD').replace(/\p{Diacritic}/gu, '')
      .toLowerCase().trim()

    // anti-429 : cache et budget par requête
    const reqGeoCache = new Map() // key: "city|CC" -> {lat,lng,countryCode}
    let geoBudget = 3             // max géocodages externes par calcul

    // 1.5) Charger villes pour géolocalisation
    const cities = await prisma.city.findMany()
    const cityById = new Map(cities.map(c => [c.id, c]))
    const cityByKey = new Map(
      cities.map(c => [`${norm(c.name)}|${(c.countryCode || '').toUpperCase()}`, c])
    )

    // 2) Charger candidats
    const candidates = await prisma.profile.findMany({
      include: {
        Address: true,
        User: {
          include: {
            Experiences: { include: { domainsList: true } },
            realisations: { include: { technos: true } },
            Prestations: true,
          },
        },
      },
    })

    // 3) Helpers
    const safeWeight = w => Math.max(1, Number(w) || 1)

    const toRad = d => (d * Math.PI) / 180
    const haversineKm = (lat1, lon1, lat2, lon2) => {
      const R = 6371
      const dLat = toRad(lat2 - lat1)
      const dLon = toRad(lon2 - lon1)
      const a =
        Math.sin(dLat/2)**2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2)**2
      return 2 * R * Math.asin(Math.sqrt(a))
    }

    const getFromMap = (map, name) => {
      const n = norm(name)
      let v = map.get(n) || 0
      for (const [k, val] of map) {
        if (k.includes(n) || n.includes(k)) v = Math.max(v, val)
      }
      return v
    }

    const getPrestationTechMap = (p) => {
      const map = new Map()
      for (const pr of (p.User?.Prestations || [])) {
        const k = norm(pr.tech)
        if (!k) continue
        map.set(k, Math.max(map.get(k) || 0, levelToNum(pr.level)))
      }
      return map
    }

    const getPrestationLevel = (p, name) => {
      const tech = String(name || '').toLowerCase()
      for (const pr of (p.User?.Prestations || [])) {
        if (String(pr.tech || '').toLowerCase() === tech) return levelToNum(pr.level)
      }
      return null
    }

    const ensureCityCoords = async (city) => {
      if (!city) return null
      if (city.lat != null && city.lng != null) return city
      let hit = null
      try { hit = await geocodeCity(city.name, city.countryCode) } catch { hit = null }
      if (!hit) return city
      try {
        return await prisma.city.update({
          where: { id: city.id },
          data: { lat: hit.lat, lng: hit.lng },
        })
      } catch {
        return { ...city, lat: hit.lat, lng: hit.lng }
      }
    }

    const resolveCandidateCoords = async (p) => {
      const name = norm(p.Address?.city)
      const cc   = (p.Address?.country || '').toUpperCase()
      if (!name) return null

      const known = cityByKey.get(`${name}|${cc}`) || null
      if (known) return await ensureCityCoords(known)

      const k = `${name}|${cc}`
      if (reqGeoCache.has(k)) return reqGeoCache.get(k)
      if (geoBudget <= 0) return null
      geoBudget--

      let hit = null
      try { hit = await geocodeCity(name, cc) } catch { hit = null }
      const res = hit ? { lat: hit.lat, lng: hit.lng, countryCode: cc } : null
      reqGeoCache.set(k, res)
      return res
    }

    const locationComponentByDistance = async (p, criteria) => {
      if (criteria.remote) return 0.8
      const req0 = criteria.cityId ? cityById.get(criteria.cityId) : null
      const req  = await ensureCityCoords(req0)
      if (!req?.lat || !req?.lng) return 0.5

      const cand = await resolveCandidateCoords(p)
      if (!cand?.lat || !cand?.lng) return 0.2

      const d = haversineKm(req.lat, req.lng, cand.lat, cand.lng)
      if (d <= 15)  return 1
      if (d <= 50)  return 0.9
      if (d <= 150) return 0.8
      if (d <= 300) return 0.7
      if (d <= 600) return 0.5
      if ((req.countryCode || '') === (cand.countryCode || '')) return 0.3
      return 0.1
    }

    // Expériences: Domain.name → niveau (fallback prestations sinon 0.66)
    const getExpTechMap = (p) => {
      const map = new Map()
      const exps = p.User?.Experiences || []
      for (const exp of exps) {
        const domains = exp?.domainsList || []
        for (const d of domains) {
          const name = String(d?.name || '').toLowerCase()
          if (!name) continue
          const lvl = getPrestationLevel(p, name) ?? 0.66
          map.set(name, Math.max(map.get(name) || 0, lvl))
        }
      }
      return map
    }

    // Réalisations: Techno{name, level} → niveau
    const getRealTechMap = (p) => {
      const map = new Map()
      const reals = p.User?.realisations || []
      for (const r of reals) {
        for (const t of (r?.technos || [])) {
          const name = String(t?.name || '').toLowerCase()
          if (!name) continue
          const lvl = levelToNum(t?.level)
          map.set(name, Math.max(map.get(name) || 0, lvl))
        }
      }
      return map
    }

const getProfileTechMap = (p) => {
  const map = new Map()
  const arr =
    Array.isArray(p.technologies) ? p.technologies :
    (Array.isArray(p.skills) ? p.skills : [])
  for (const t of arr) {
    const name = String(typeof t === 'string' ? t : t?.name || '')
      .toLowerCase().trim()
    if (!name) continue
    const lvl = typeof t === 'string' ? 0.66 : levelToNum(t?.level)
    map.set(name, Math.max(map.get(name) || 0, lvl))
  }
  return map
}

    const availabilityScore = (p, startDate) => {
      if (!startDate) return p.isEmployed ? 0.4 : 1
      const sd = new Date(startDate)
      const af = p.availableDate ? new Date(p.availableDate) : null
      if (!p.isEmployed) return 1
      if (af && af <= sd) return 0.7
      return 0.2
    }

    const availabilityText = (p) => {
      const d = p.availableDate ? new Date(p.availableDate) : null
      if (d && d.getTime() > Date.now()) {
        const dd = String(d.getDate()).padStart(2,'0')
        const mm = String(d.getMonth()+1).padStart(2,'0')
        const yy = d.getFullYear()
        return `${dd}/${mm}/${yy}`
      }
      return 'oui'
    }

    const getTjm = (p) => p.mediumDayRate ?? p.smallDayRate ?? p.highDayRate ?? null
const tjmComponent = (p, min, max) => {
  const a = Number.isFinite(Number(min)) ? Number(min) : null
  const b = Number.isFinite(Number(max)) ? Number(max) : null

  const x = Number.isFinite(Number(p.smallDayRate)) ? Number(p.smallDayRate) : null
  const y = Number.isFinite(Number(p.highDayRate))  ? Number(p.highDayRate)  : null

  // Pas d'infos -> neutre
  if (a == null && b == null) return 0.6
  if ((x == null || y == null) || y < x) {
    // fallback mono-valeur si la fourchette profil est incomplète
    const tjm = getTjm(p)
    if (!tjm) return 0.6
    if (a != null && b != null) {
      if (tjm >= a && tjm <= b) return 1
      const center = (a + b) / 2
      const span = Math.max(1, (b - a) / 2)
      return Math.max(0, 1 - Math.abs(tjm - center) / span)
    }
    if (b != null) {
      if (tjm <= b) return 1
      const span = Math.max(1, b * 0.5)
      return Math.max(0, 1 - (tjm - b) / span)
    }
    if (a != null) {
      if (tjm >= a) return 1
      const span = Math.max(1, a * 0.5)
      return Math.max(0, 1 - (a - tjm) / span)
    }
    return 0.6
  }

  // Normalisation des bornes client si une seule est fournie
  const A = a != null ? a : 0
  const B = b != null ? b : Infinity

  // Règle 100% si chevauchement, même 1 €
  if (A <= y && x <= B) return 1

  // Sinon, distance minimale entre intervalles disjoints
  const dist =
    B < x ? (x - B) :      // client en-dessous du profil
    A > y ? (A - y) : 0    // client au-dessus du profil (sinon chevauchement déjà capté)

  // Échelle de pénalisation : somme des largeurs (client + profil)
  const widthClient = (isFinite(B) ? (B - A) : A) || 0
  const widthProfil = (y - x) || 0
  const span = Math.max(1, widthClient + widthProfil)

  return Math.max(0, 1 - dist / span)
}



// 4) Scoring
const reqTechsRaw = Array.isArray(criteria.technologies) ? criteria.technologies : []
const reqTechs = reqTechsRaw.map(t =>
  (typeof t === 'string' ? { name: t, level: 'intermediate', weight: 1 } : t)
)
const totalReqWeight = reqTechs.reduce((s, t) => s + Number(t?.weight || 0), 0)

const scored = await Promise.all(candidates.map(async p => {
  const expMap   = getExpTechMap(p)
  const realMap  = getRealTechMap(p)
  const prestMap = getPrestationTechMap(p)
  const profMap  = getProfileTechMap(p)

  let weightedSumPct = 0
  const perTechDetails = []

  for (const t of reqTechs) {
    const name = String(t?.name || '').toLowerCase()
    if (!name) continue
    const needNum  = levelToNum(t?.level)
    const needLbl  = normLevel(t?.level) || null
    const w        = safeWeight(t?.weight)

    const haveExp   = getFromMap(expMap,  name)
    const haveReal  = getFromMap(realMap, name)
    const havePrest = getFromMap(prestMap, name)
    const haveProf  = getFromMap(profMap,  name)
    const haveNum   = Math.max((0.7 * haveExp) + (0.3 * haveReal), havePrest, haveProf)
    const haveLbl   = haveNum > 0 ? numToNearestLevel(haveNum) : null

    const matchNum  = (needLbl && haveLbl) ? levelSimilarity(needLbl, haveLbl) : 0
    const matchPct  = Math.round(matchNum * 100)

weightedSumPct += matchPct * Number(t?.weight || 0)

    perTechDetails.push({
      techName: t.name || String(t),
      requestedLevel: needLbl,
      profileLevel: haveLbl,
      match: matchPct,
      requestedNum: Number(needNum.toFixed(2)),
      profileNum: Number(haveNum.toFixed(2)),
    })
  }

  const skillsTotalPct = reqTechs.length ? Math.round(weightedSumPct / totalReqWeight) : 50

  const tjm = tjmComponent(p, criteria.tjmMin, criteria.tjmMax)
  const tjmPct = Math.round(tjm * 100)

  const telework = (() => {
    const req  = Number(criteria.remoteDaysCount)
    const cand = Number(p.teleworkDays)
    if (!Number.isFinite(req))  return 50
    if (!Number.isFinite(cand)) return 0
    const diff = Math.abs(cand - req)
    const steps = [100, 80, 60, 40, 20, 0]
    return steps[Math.min(diff, 5)]
  })()

  const avail = availabilityScore(p, criteria.startDate)
  const availPct = Math.round(avail * 100)

  const scoreRaw =
    weightedSumPct +
    (tjmPct * (Number(weights.tjm) || 0)) +
    (telework * (Number(weights.telework) || 0)) +
    (availPct * (Number(weights.availability) || 0))

  const totalWeight =
    totalReqWeight +
    (Number(weights.tjm) || 0) +
    (Number(weights.telework) || 0) +
    (Number(weights.availability) || 0)

  const scorePct = totalWeight > 0 ? (scoreRaw / totalWeight) : 0
  const safeScorePct = Number.isFinite(scorePct) ? scorePct : 0

  return {
    userId: p.userId,
    fullName: [
      (p.firstName ?? p.firstname ?? p.User?.firstName ?? p.User?.firstname),
      (p.lastName  ?? p.lastname  ?? p.User?.lastName  ?? p.User?.lastname)
    ].filter(Boolean).join(' ') || null,
    score: Math.round(safeScorePct),
    details: {
      tjmValue: getTjm(p),
      tjmMin: p.smallDayRate ?? null,
      tjmMax: p.highDayRate ?? null,
      skills: {
        total: skillsTotalPct,
        weight: totalReqWeight,
        details: perTechDetails,
      },
      tjm: tjmPct,
      availability: availPct,
      availabilityText: availabilityText(p),
      telework: telework,
      teleworkDays: p.teleworkDays ?? null,
      teleworkNeeded: criteria.remoteDaysCount ?? null,
    },
  }
}))

    // 5) Tri par priorité (poids décroissants) + top 10
const order = [
  { k: 'skills',       w: Number(weights.skills)       || 0 },
  { k: 'tjm',          w: Number(weights.tjm)          || 0 },
  { k: 'telework',     w: Number(weights.telework)     || 0 },
  { k: 'availability', w: Number(weights.availability) || 0 },
].sort((a, b) => b.w - a.w).map(o => o.k)

    scored.sort((a, b) => {
      for (const k of order) {
        const va = (k === 'skills') ? (a.details?.skills?.total ?? 0) : (a.details?.[k] ?? 0)
        const vb = (k === 'skills') ? (b.details?.skills?.total ?? 0) : (b.details?.[k] ?? 0)
        if (vb !== va) return vb - va
      }
      return b.score - a.score
    })

const onlyWithSkills = scored.filter(s => (s?.details?.skills?.total ?? 0) > 0)
return res.json(onlyWithSkills.slice(0, 10))

  } catch (e) {
    console.error('shortlist compute error:', e)
    return res.status(500).json({ error: 'Erreur calcul shortlist' })
  }
})

module.exports = router
