const express = require('express')
const router = express.Router()
const prisma = require('../utils/prismaClient')
const authenticateToken = require('../middlewares/authMiddleware')

// ─── Protection de la route par token ─────────────────────────────
router.use(authenticateToken)

//
// ─── Recherche des profils avec filtre texte libre ─────────────────
//

router.get('/profils', async (req, res) => {
  const search = req.query.search || ''

  try {
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { email: { contains: search } },
          { username: { contains: search } },
          {
            Experiences: {
              some: {
                OR: [
                  { title: { contains: search } },
                  { description: { contains: search } },
                ],
              },
            },
          },
          {
            Profile: {
              OR: [
                { firstname: { contains: search } },
                { lastname: { contains: search } },
                { bio: { contains: search } },
              ],
            },
          },
        ],
      },
      include: {
        Profile: true,
      },
    })

    const profils = users
      .filter((u) => u.Profile)
      .map((u) => ({
        ...u.Profile,
        User: { email: u.email },
      }))

    res.json(profils)
  } catch (err) {
    console.error('Erreur admin profils :', err)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})
// ─── Confirmer un email manuellement ───────────────────────────────
router.post('/confirm-email', async (req, res) => {
  if (!req.user?.isAdmin) return res.status(403).json({ error: 'Accès refusé' })

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

module.exports = router
