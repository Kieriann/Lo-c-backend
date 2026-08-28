const router = require('express').Router()
const prisma = require('../utils/prismaClient')
const rateLimit = require('../middlewares/rateLimit')
const { sendEmail } = require('../utils/mailer')
const { hashToken, isValidEmail, normalizeEmail, randomToken } = require('../utils/security')

const genericResponse = { message: 'Si ce compte existe, un lien de réinitialisation va être envoyé.' }
const limit = rateLimit({ windowMs: 60 * 60 * 1000, max: 5, name: 'forgot-password' })

router.post('/', limit, async (req, res, next) => {
  const email = normalizeEmail(req.body?.email)
  if (!isValidEmail(email)) return res.status(202).json(genericResponse)

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, emailConfirmed: true },
    })

    if (user?.emailConfirmed) {
      const rawToken = randomToken()
      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordResetTokenHash: hashToken(rawToken),
          passwordResetExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
        },
      })

      const origin = process.env.FRONT_URL || 'http://localhost:5173'
      const resetUrl = new URL(`/reset-password/${rawToken}`, origin).toString()

      try {
        await sendEmail({
          to: email,
          subject: 'Réinitialisation de votre mot de passe Free’s Biz',
          text: `Ce lien est valable 15 minutes : ${resetUrl}`,
          html: `<p>Ce lien de réinitialisation est valable 15 minutes :</p><p><a href="${resetUrl}">Choisir un nouveau mot de passe</a></p>`,
        })
      } catch (emailError) {
        console.error('Password reset email failed:', emailError.code || emailError.message)
      }
    }

    return res.status(202).json(genericResponse)
  } catch (error) {
    return next(error)
  }
})

module.exports = router
