const bcrypt   = require('bcrypt')
const jwt      = require('jsonwebtoken')
const crypto   = require('crypto')
const prisma   = require('../utils/prismaClient')
const sgMail   = require('@sendgrid/mail')
require('dotenv').config()

// ── SendGrid : activation seulement si clé valide ───────────────────
const SENDGRID_KEY = process.env.SENDGRID_API_KEY || ''
const CAN_SENDGRID = SENDGRID_KEY.startsWith('SG.')
if (CAN_SENDGRID) {
  sgMail.setApiKey(SENDGRID_KEY)
} else {
  console.warn('SendGrid désactivé : clé absente ou invalide.')
}

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
  const prenom = req.body.firstname || email.split('@')[0]
  const token  = crypto.randomBytes(32).toString('hex')
  const username = prenom

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

  // ── Envoi d’email non bloquant ───────────────────────────────────
  if (CAN_SENDGRID) {
    try {
      await sgMail.send({
        to: email,
        from: 'no-reply@freesbiz.fr',
        subject: 'Merci pour votre inscription – dernière étape',
        text: `Bonjour,\n\nMerci pour votre inscription sur Free’s Biz.\n\nPour finaliser votre compte, cliquez sur le lien suivant :\n${confirmUrl}\n\nSi vous n’êtes pas à l’origine de cette demande, vous pouvez ignorer ce message.`,
        html: `<p>Bonjour,</p><p>Merci pour votre inscription sur <strong>Free’s Biz</strong>.</p><p>Pour finaliser votre compte, cliquez <a href="${confirmUrl}">ici</a>.</p><p>Si vous n’êtes pas à l’origine de cette demande, vous pouvez ignorer ce message.</p>`,
      })
    } catch (e) {
      console.error('SendGrid error:', e.response?.body || e.message)
      // On continue quand même : l’inscription ne doit pas échouer.
    }
  }

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
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true, email: true, password: true, emailConfirmed: true, isAdmin: true, firstLoginAt: true }
  })

  if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé' })
  if (!user.emailConfirmed) {
    return res.status(403).json({ error: 'Email non confirmé' })
  }

  const isPasswordValid = await bcrypt.compare(password, user.password)
  if (!isPasswordValid) {
    return res.status(401).json({ error: 'Mot de passe incorrect' })
  }

  const isFirstLogin = !user.firstLoginAt
  if (isFirstLogin) {
    await prisma.user.update({
      where: { id: user.id },
      data: { firstLoginAt: new Date() }
    })
  }

  const jwtToken = jwt.sign(
    { userId: user.id, isAdmin: user.isAdmin },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  )

  res.json({ token: jwtToken, isFirstLogin, user: { id: user.id, email: user.email } })
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

//
// ─── Réinitialisation du mot de passe ─────────────────────────────
//
async function resetPassword(req, res) {
  const { token, password } = req.body
  if (!token || !password) return res.status(400).json({ error: 'Données manquantes' })

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    const hashed = await bcrypt.hash(password, 10)

    await prisma.user.update({
      where: { id: decoded.userId },
      data: { password: hashed },
    })

    res.json({ success: true })
  } catch (err) {
    res.status(400).json({ error: 'Token invalide ou expiré' })
  }
}

// pour delete un user par mail
async function deleteUser(req, res) {
  try {
    const email = req.body.email
    if (!email) return res.status(400).json({ error: 'Email requis' })

    await prisma.user.delete({ where: { email } })
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

module.exports = { signup, confirmEmail, login, me, resetPassword, deleteUser }
