const express = require('express')
const router = express.Router()
const prisma = require('../utils/prismaClient')
const auth = require('../middlewares/authMiddleware')

router.post('/', auth, async (req, res, next) => {
  try {
    const { email } = req.body
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Email invalide' })
    }

    const me = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { email: true, sponsorEmail: true }
    })
    if (!me) return res.status(404).json({ error: 'Utilisateur introuvable' })

    if (me.email.toLowerCase() === email.toLowerCase()) {
      return res.status(400).json({ error: 'Impossible de se parrainer soi-même' })
    }
    if (me.sponsorEmail) {
      return res.status(409).json({ error: 'Parrain déjà renseigné' })
    }

    await prisma.user.update({
      where: { id: req.user.id },
      data: { sponsorEmail: email }
    })
    res.json({ success: true })
  } catch (e) { next(e) }
})

module.exports = router
