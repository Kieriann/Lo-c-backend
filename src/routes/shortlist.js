const router = require('express').Router()
const prisma = require('../utils/prismaClient')
const requireAuth = require('../middlewares/authMiddleware')
const { geocodeCity } = require('../utils/geocode')


/**
 * POST /api/shortlist/compute
 * Body :
 *  A) { clientRequestId: number }
 *  B) { criteria: {...}, weights: {...} }
 * Retour : [{ userId, score, details }] trié desc, max 10.
 */
router.post('/compute', requireAuth, async (req, res) => {
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
        // si tu veux activer Cas 1: mapper aussi technologies -> {name, level, weight}
        technologies: [],
      }

      weights = {
        skills: cr.skillsWeight ?? 5,
        tjm: cr.tjmWeight ?? 3,
        location: cr.locationWeight ?? 2,
        availability: cr.availabilityWeight ?? 2,
      }
    } else {
      criteria = req.body.criteria || {}
      weights  = req.body.weights  || {}
      weights.skills ??= 5
      weights.tjm ??= 3
      weights.location ??= 2
      weights.availability ??= 2
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
          }
        }
      }
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


    const levelToNum = (lv) => {
      const s = String(lv || '').toLowerCase()
      if (s === 'expert') return 1
      if (s === 'medium' || s === 'intermediaire' || s === 'intermédiaire') return 0.66
      if (s === 'junior') return 0.33
      const n = Number(lv)
      return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0.5
    }

    const getPrestationLevel = (p, name) => {
      const tech = String(name || '').toLowerCase()
      for (const pr of (p.User?.Prestations || [])) {
        if (String(pr.tech || '').toLowerCase() === tech) return levelToNum(pr.level)
      }
      return null
    }

    const resolveCandidateCity = (p) => {
  const name = norm(p.Address?.city)
  const cc   = (p.Address?.country || '').toUpperCase()
  if (!name) return null
  return cityByKey.get(`${name}|${cc}`) || null
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

    const isCityMatch = (_p, _cityId) => {
      // TODO: mapper ville profil ↔ cityId si besoin
      return true
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
      const tjm = getTjm(p)
      if (!tjm || !min || !max) return 0.6
      if (tjm >= min && tjm <= max) return 1
      const center = (min + max) / 2
      const span = Math.max(1, (max - min) / 2)
      const dist = Math.abs(tjm - center)
      return Math.max(0, 1 - dist / span)
    }

    // 4) Scoring
    const reqTechs = Array.isArray(criteria.technologies) ? criteria.technologies : []
const totalReqWeight = reqTechs.reduce((s, t) => s + safeWeight(t.weight), 0)

const scored = await Promise.all(candidates.map(async p => {// Skills = max( Prestations , 70% Exp + 30% Réals )
const expMap   = getExpTechMap(p)
const realMap  = getRealTechMap(p)
const prestMap = getPrestationTechMap(p)


      let sum = 0
      for (const t of reqTechs) {
        const name = String(t?.name || '').toLowerCase()
        if (!name) continue
        const need = levelToNum(t?.level)
const w    = safeWeight(t?.weight)

const haveExp   = getFromMap(expMap,  name)
const haveReal  = getFromMap(realMap, name)
const havePrest = getFromMap(prestMap, name)
const have = Math.max((0.7 * haveExp) + (0.3 * haveReal), havePrest)


// proximité: 1 si égalité, <1 si sur/sous-qualifié
const perTech = (need > 0 && have > 0) ? (Math.min(have, need) / Math.max(have, need)) : 0
        sum += perTech * w
      }
      const skills = reqTechs.length ? (sum / totalReqWeight) : 0.5

      const tjm = tjmComponent(p, criteria.tjmMin, criteria.tjmMax)

const location = await locationComponentByDistance(p, criteria)


      const avail = availabilityScore(p, criteria.startDate)

      const scoreRaw =
        (skills * weights.skills) +
        (tjm * weights.tjm) +
        (location * weights.location) +
        (avail * weights.availability)

      const totalWeight =
        (weights.skills || 0) +
        (weights.tjm || 0) +
        (weights.location || 0) +
        (weights.availability || 0)

      const scorePct = totalWeight > 0 ? (scoreRaw / totalWeight) * 100 : 0

      return {
        userId: p.userId,
        score: Math.round(scorePct),
details: {
  skills: Math.round(skills * 100),
  tjm: Math.round(tjm * 100),
  location: Math.round(location * 100),
  availability: Math.round(avail * 100),
  availabilityText: availabilityText(p), 
},

      }
    }))

// 5) Tri par priorité (poids décroissants) + top 10
const order = [
  { k: 'skills',       w: Number(weights.skills)       || 0 },
  { k: 'tjm',          w: Number(weights.tjm)          || 0 },
  { k: 'location',     w: Number(weights.location)     || 0 },
  { k: 'availability', w: Number(weights.availability) || 0 },
].sort((a, b) => b.w - a.w).map(o => o.k)

scored.sort((a, b) => {
  for (const k of order) {
    const da = a.details?.[k] ?? 0
    const db = b.details?.[k] ?? 0
    if (db !== da) return db - da
  }
  return b.score - a.score
})
return res.json(scored.slice(0, 10))

  } catch (e) {
    console.error('shortlist compute error:', e)
    return res.status(500).json({ error: 'Erreur calcul shortlist' })
  }
})

module.exports = router
