const express = require('express')
const router = express.Router()
const prisma = require('../utils/prismaClient')
const authenticateToken = require('../middlewares/authMiddleware')

// ─── Protection globale : JWT + rôle admin ─────────────────────────
router.use(authenticateToken)
router.use((req, res, next) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ error: 'Accès refusé' })
  }
  next()
})

// ─── Confirmer un email manuellement ───────────────────────────────
router.post('/confirm-email', async (req, res) => {
  const { email } = req.body || {}
  if (!email) return res.status(400).json({ error: 'Email requis' })

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } })
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' })

  await prisma.user.update({
    where: { id: user.id },
    data: { emailConfirmed: true, emailConfirmationToken: null },
  })
  res.json({ success: true })
})

// ─── Fallback pour les anciennes routes admin ─────────────────────
router.use((_req, res) => {
  res.status(404).json({ error: 'Route admin indisponible' })
})

module.exports = router
