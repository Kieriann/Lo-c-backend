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

  // Vérifier si l’utilisateur existe déjà
  const existingUser = await prisma.user.findUnique({ where: { email } })
  if (existingUser) {
    return res.status(409).json({ error: 'Email déjà utilisé' })
  }

  // Hasher le mot de passe
  const hashedPassword = await bcrypt.hash(password, 10)
  const username = email.split('@')[0]

  // Générer un token de confirmation unique
  const emailConfirmationToken = crypto.randomBytes(32).toString('hex')

  // Créer l’utilisateur avec emailConfirmed à false et le token
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

  // Construire le lien de confirmation
  const confirmUrl = `${process.env.FRONTEND_URL}/confirm-email?token=${emailConfirmationToken}`

  // Envoyer l’email de confirmation
  await sendEmail({
    to: user.email,
    subject: 'Confirme ton adresse e-mail',
    text: `
Bienvenue chez Free’s Biz !

Pour activer ton compte, clique sur le lien suivant :
${confirmUrl}

Si tu n’as pas demandé cet e-mail, ignore-le.
    `,
  })

  // Ne pas renvoyer de JWT avant confirmation
  return res
    .status(201)
    .json({ message: 'Inscription réussie ! Vérifie ta boîte mail pour confirmer ton adresse.' })
}

module.exports = { signup }

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

  const isPasswordValid = await bcrypt.compare(password, user.password)
  if (!isPasswordValid) {
    return res.status(401).json({ error: 'Mot de passe incorrect' })
  }

  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
    expiresIn: '7d',
  })

  res.json({ token, user: { id: user.id, email: user.email } })
}

//
// ─── Récupération de l'utilisateur connecté ───────────────────────
//

async function me(req, res) {
  if (!req.user.id) {
    return res.status(401).json({ error: 'Utilisateur non authentifié' })
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, email: true },
    })

    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' })
    }

    res.json(user)
  } catch (err) {
    res.status(500).json({ error: 'Erreur interne' })
  }
}

module.exports = { signup, login, me }
