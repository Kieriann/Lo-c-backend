const bcrypt   = require('bcrypt')
const jwt      = require('jsonwebtoken')
const crypto   = require('crypto')
const prisma   = require('../utils/prismaClient')
const sgMail   = require('@sendgrid/mail')
require('dotenv').config()

sgMail.setApiKey(process.env.SENDGRID_API_KEY)

//
// ─── Création de compte (inscription) ──────────────────────────────
//
async function signup(req, res) {
  const emailRaw = req.body.email
  const password = req.body.password
  if (!emailRaw || !password) {
    return res.status(400).json({ error: 'Email et mot de passe requis' })
  }

  const email = emailRaw.toLowerCase()
  const existingUser = await prisma.user.findUnique({ where: { email } })
  if (existingUser) {
    return res.status(409).json({ error: 'Email déjà utilisé' })
  }

  const hashedPassword = await bcrypt.hash(password, 10)
  const username       = email.split('@')[0]
  const token          = crypto.randomBytes(32).toString('hex')

  const user = await prisma.user.create({
    data: {
      email,
      username,
      password: hashedPassword,
      isAdmin: email === 'loic.bernard15@yahoo.fr',
      emailConfirmed: false,
      emailConfirmationToken: token,
    },
  })

  const confirmUrl = `${process.env.FRONT_URL}/confirm-email?token=${user.emailConfirmationToken}`

  // Envoi du mail via SendGrid
  await sgMail.send({
    to:      email,
    from:    process.env.EMAIL_FROM,
    subject: 'Confirme ton adresse e-mail',
    text:    `Bonjour ${username},\n\nPour activer ton compte, clique ici :\n${confirmUrl}`,
    html:    `<p>Bonjour ${username},</p><p>Pour activer ton compte, clique <a href="${confirmUrl}">ici</a>.</p>`,
  })

  return res
    .status(201)
    .json({ message: 'Inscription réussie ! Vérifiez vos mails pour confirmer votre adresse.' })
}

//
// ─── Confirmation d’e-mail ─────────────────────────────────────────
//
async function confirmEmail(req, res) {
  const { token } = req.query
  if (!token) return res.status(400).send('Token manquant')

  const user = await prisma.user.findUnique({
    where: { emailConfirmationToken: String(token) },
  })
  if (!user) return res.status(404).send('Token invalide ou expiré')

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailConfirmed: true,
      emailConfirmationToken: null,
    },
  })

  return res
    .status(200)
    .json({ message: 'E-mail confirmé ! Vous pouvez maintenant vous connecter.' })
}

//
// ─── Connexion ─────────────────────────────────────────────────────
//
async function login(req, res) {
const emailRaw = req.body.email
const password = req.body.password
if (!emailRaw || !password) {
  return res.status(400).json({ error: 'Email et mot de passe requis' })
}
const normalizedEmail = emailRaw.toLowerCase()
const user = await prisma.user.findUnique({ where: { email: normalizedEmail } })

  if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé' })
  if (!user.emailConfirmed) {
    return res.status(403).json({ error: 'Email non confirmé' })
  }

  const isPasswordValid = await bcrypt.compare(password, user.password)
  if (!isPasswordValid) {
    return res.status(401).json({ error: 'Mot de passe incorrect' })
  }

  const jwtToken = jwt.sign(
    { userId: user.id, isAdmin: user.isAdmin },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  )

  res.json({ token: jwtToken, user: { id: user.id, email: user.email } })
}

//
// ─── Récupération de l’utilisateur connecté ───────────────────────
//
async function me(req, res) {
  if (!req.user?.id) {
    return res.status(401).json({ error: 'Utilisateur non authentifié' })
  }

  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { id: true, email: true, username: true },
  })
  if (!user) {
    return res.status(404).json({ error: 'Utilisateur non trouvé' })
  }

  res.json(user)
}

module.exports = { signup, confirmEmail, login, me }
