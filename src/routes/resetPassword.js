const router = require('express').Router()
const bcrypt = require('bcrypt')
const prisma = require('../utils/prismaClient')
const rateLimit = require('../middlewares/rateLimit')
const { hashToken, validatePassword } = require('../utils/security')

const limit = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, name: 'reset-password' })

router.post('/', limit, async (req, res, next) => {
  const rawToken = String(req.body?.token || '')
  const password = req.body?.password
  const passwordError = validatePassword(password)

  if (!rawToken || rawToken.length > 256) return res.status(400).json({ error: 'TOKEN_INVALID_OR_EXPIRED' })
  if (passwordError) return res.status(400).json({ error: 'PASSWORD_INVALID', message: passwordError })

  try {
    const user = await prisma.user.findFirst({
      where: {
        passwordResetTokenHash: hashToken(rawToken),
        passwordResetExpiresAt: { gt: new Date() },
      },
      select: { id: true },
    })

    if (!user) return res.status(400).json({ error: 'TOKEN_INVALID_OR_EXPIRED' })

    const passwordHash = await bcrypt.hash(password, 12)
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: passwordHash,
        passwordResetTokenHash: null,
        passwordResetExpiresAt: null,
        tokenVersion: { increment: 1 },
      },
    })

    return res.json({ success: true })
  } catch (error) {
    return next(error)
  }
})

module.exports = router
