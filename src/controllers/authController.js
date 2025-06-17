const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const crypto = require('crypto')
const prisma = require('../utils/prismaClient')
const { sendEmail } = require('../utils/mailer')

//
// ─── Création de compte (inscription) ──────────────────────────────
//
async function signup(req, res) {
  const { email, password } = req.body
  if (!email || !password) {
    return res.status(400).json({ error: 'Email et mot de passe requis' })
  }
  const existingUser = await prisma.user.findUnique({ where: { email } })
  if (existingUser) {
    return res.status(409).json({ error: 'Email déjà utilisé' })
  }
  const hashedPassword = await bcrypt.hash(password, 10)
  const username = email.split('@')[0]
  const emailConfirmationToken = crypto.randomBytes(32).toString('hex')
  const user = await prisma.user.create({
    data: {
      email,
      username,
      password: hashedPassword,
      isAdmin: email === 'loic.bernard15@yahoo.fr',
      emailConfirmed: false,
      emailConfirmationToken,
    },
  })
  const confirmUrl = `${process.env.FRONTEND_URL}/confirm-email?token=${emailConfirmationToken}`
  await sendEmail({
    to: user.email,
    subject: 'Confirme ton adresse e-mail',
    text: `
Bienvenue chez Free’s Biz !

Pour activer ton compte, clique sur ce lien :
${confirmUrl}

Si tu n’as pas demandé cet e-mail, ignore-le.
    `,
  })
  return res
    .status(201)
    .json({ message: 'Inscription réussie ! Vérifie ta boîte mail pour confirmer ton adresse.' })
}

//
// ─── Confirmation d’e-mail ─────────────────────────────────────────
//
async function confirmEmail(req, res) {
  const { token } = req.query
  if (!token) {
    return res.status(400).send('Token manquant')
  }
  const user = await prisma.user.findUnique({
    where: { emailConfirmationToken: token }
  })
  if (!user) {
    return res.status(404).send('Token invalide ou expiré')
  }
  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailConfirmed: true,
      emailConfirmationToken: null
    }
  })
  // Redirige vers une page de confirmation sur le front, ou renvoie un message simple :
  return res.redirect(`${process.env.FRONTEND_URL}/email-confirmed`)
}

//
// ─── Connexion ─────────────────────────────────────────────────────
//
async function login(req, res) {
  const { email, password } = req.body
  if (!email || !password) {
    return res.status(400).json({ error: 'Email et mot de passe requis' })
  }
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    return res.status(404).json({ error: 'Utilisateur non trouvé' })
  }
  if (!user.emailConfirmed) {
    return res.status(403).json({ error: 'Email non confirmé' })
  }
  const isPasswordValid = await bcrypt.compare(password, user.password)
  if (!isPasswordValid) {
    return res.status(401).json({ error: 'Mot de passe incorrect' })
  }
  const token = jwt.sign(
    { userId: user.id, isAdmin: user.isAdmin },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  )
  res.json({ token, user: { id: user.id, email: user.email } })
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
    select: { id: true, email: true }
  })
  if (!user) {
    return res.status(404).json({ error: 'Utilisateur non trouvé' })
  }
  res.json(user)
}

module.exports = { signup, confirmEmail, login, me }
