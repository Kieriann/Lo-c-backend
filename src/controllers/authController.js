const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const prisma = require('../utils/prismaClient')
const authenticate = require('../middlewares/authMiddleware')
const { sendEmail } = require('../utils/mailer')
const {
  cleanText,
  hashToken,
  isValidEmail,
  normalizeEmail,
  randomToken,
  validatePassword,
} = require('../utils/security')

const CONFIRMATION_TTL_MS = 24 * 60 * 60 * 1000
const GENERIC_SIGNUP_MESSAGE = 'Si cette adresse peut être utilisée, un e-mail de confirmation va être envoyé.'
const dummyHashPromise = bcrypt.hash(randomToken(24), 10)

function frontendUrl(path, token) {
  const origin = process.env.FRONT_URL || 'http://localhost:5173'
  const url = new URL(path, origin)
  if (token) url.searchParams.set('token', token)
  return url.toString()
}

async function deliverConfirmation(email, rawToken) {
  const confirmUrl = frontendUrl('/confirm-email', rawToken)
  await sendEmail({
    to: email,
    subject: 'Confirmez votre inscription Free’s Biz',
    text: `Pour confirmer votre adresse, ouvrez ce lien dans les 24 heures : ${confirmUrl}`,
    html: `<p>Pour confirmer votre adresse Free’s Biz, utilisez ce lien valable 24 heures :</p><p><a href="${confirmUrl}">Confirmer mon adresse</a></p>`,
  })
}

async function signup(req, res, next) {
  try {
    const email = normalizeEmail(req.body?.email)
    const password = req.body?.password
    const passwordError = validatePassword(password)

    if (!isValidEmail(email)) return res.status(400).json({ error: 'EMAIL_INVALID' })
    if (passwordError) return res.status(400).json({ error: 'PASSWORD_INVALID', message: passwordError })

    const role = req.body?.role === 'CLIENT' ? 'CLIENT' : 'INDEP'
    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    })

    if (existingUser) return res.status(202).json({ message: GENERIC_SIGNUP_MESSAGE })

    const rawToken = randomToken()
    const tokenHash = hashToken(rawToken)
    const hashedPassword = await bcrypt.hash(password, 12)
    const username = cleanText(req.body?.firstname, { max: 80 }) || email.split('@')[0].slice(0, 80)

    await prisma.user.create({
      data: {
        email,
        username,
        password: hashedPassword,
        role,
        isAdmin: false,
        emailConfirmed: false,
        emailConfirmationToken: tokenHash,
        emailConfirmationExpiresAt: new Date(Date.now() + CONFIRMATION_TTL_MS),
      },
    })

    try {
      await deliverConfirmation(email, rawToken)
    } catch (emailError) {
      console.error('Confirmation email failed:', emailError.code || emailError.message)
    }

    return res.status(201).json({ message: GENERIC_SIGNUP_MESSAGE })
  } catch (error) {
    if (error.code === 'P2002') return res.status(202).json({ message: GENERIC_SIGNUP_MESSAGE })
    return next(error)
  }
}

async function resendConfirmation(req, res, next) {
  const email = normalizeEmail(req.body?.email)
  if (!isValidEmail(email)) return res.status(202).json({ message: GENERIC_SIGNUP_MESSAGE })

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, emailConfirmed: true },
    })

    if (user && !user.emailConfirmed) {
      const rawToken = randomToken()
      await prisma.user.update({
        where: { id: user.id },
        data: {
          emailConfirmationToken: hashToken(rawToken),
          emailConfirmationExpiresAt: new Date(Date.now() + CONFIRMATION_TTL_MS),
        },
      })

      try {
        await deliverConfirmation(email, rawToken)
      } catch (emailError) {
        console.error('Confirmation resend failed:', emailError.code || emailError.message)
      }
    }

    return res.status(202).json({ message: GENERIC_SIGNUP_MESSAGE })
  } catch (error) {
    return next(error)
  }
}

async function confirmEmail(req, res, next) {
  const rawToken = String(req.query?.token || '')
  if (!rawToken || rawToken.length > 256) return res.status(400).json({ error: 'TOKEN_INVALID' })

  try {
    const user = await prisma.user.findFirst({
      where: {
        emailConfirmationToken: hashToken(rawToken),
        emailConfirmationExpiresAt: { gt: new Date() },
        emailConfirmed: false,
      },
      select: { id: true },
    })

    if (!user) return res.status(400).json({ error: 'TOKEN_INVALID_OR_EXPIRED' })

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailConfirmed: true,
        emailConfirmationToken: null,
        emailConfirmationExpiresAt: null,
      },
    })

    return res.json({ message: 'E-mail confirmé. Vous pouvez maintenant vous connecter.' })
  } catch (error) {
    return next(error)
  }
}

async function login(req, res, next) {
  try {
    const email = normalizeEmail(req.body?.email)
    const password = typeof req.body?.password === 'string' ? req.body.password : ''

    if (!isValidEmail(email) || !password || password.length > 128) {
      return res.status(401).json({ error: 'INVALID_CREDENTIALS' })
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        password: true,
        emailConfirmed: true,
        isAdmin: true,
        firstLoginAt: true,
        role: true,
        tokenVersion: true,
      },
    })

    const hash = user?.password || await dummyHashPromise
    const passwordValid = await bcrypt.compare(password, hash)
    if (!user || !passwordValid) return res.status(401).json({ error: 'INVALID_CREDENTIALS' })
    if (!user.emailConfirmed) return res.status(403).json({ error: 'EMAIL_NOT_CONFIRMED' })

    const expectedRole = req.body?.expectedRole
    if (expectedRole && expectedRole !== user.role) {
      return res.status(409).json({
        error: 'ROLE_MISMATCH',
        actual: user.role,
        expected: expectedRole,
        message: user.role === 'CLIENT'
          ? 'Compte Client détecté. Bascule vers l’espace Client.'
          : 'Compte Indépendant détecté. Bascule vers l’espace Indépendant.',
      })
    }

    const isFirstLogin = !user.firstLoginAt
    const loginAt = new Date()
    await prisma.user.update({
      where: { id: user.id },
      data: {
        ...(isFirstLogin ? { firstLoginAt: loginAt } : {}),
        lastLoginAt: loginAt,
        inactivity22WarningSentAt: null,
        inactivity23WarningSentAt: null,
      },
    })

    const token = jwt.sign(
      {
        type: 'access',
        userId: user.id,
        role: user.role,
        version: user.tokenVersion,
      },
      process.env.JWT_SECRET,
      {
        algorithm: 'HS256',
        audience: authenticate.AUDIENCE,
        issuer: authenticate.ISSUER,
        expiresIn: '2h',
        jwtid: randomToken(16),
      },
    )

    return res.json({
      token,
      isFirstLogin,
      user: { id: user.id, email: user.email, role: user.role, isAdmin: user.isAdmin },
    })
  } catch (error) {
    return next(error)
  }
}

async function me(req, res, next) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, email: true, username: true, role: true, isAdmin: true },
    })
    if (!user) return res.status(404).json({ error: 'USER_NOT_FOUND' })
    return res.json(user)
  } catch (error) {
    return next(error)
  }
}

async function logout(req, res, next) {
  try {
    await prisma.user.update({
      where: { id: req.user.id },
      data: { tokenVersion: { increment: 1 } },
    })
    return res.status(204).end()
  } catch (error) {
    return next(error)
  }
}

module.exports = { confirmEmail, login, logout, me, resendConfirmation, signup }
