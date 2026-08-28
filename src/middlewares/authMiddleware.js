const jwt = require('jsonwebtoken')
const prisma = require('../utils/prismaClient')

const ISSUER = 'freesbiz-api'
const AUDIENCE = 'freesbiz-web'

function bearerToken(req) {
  const header = req.headers.authorization || ''
  return header.startsWith('Bearer ') ? header.slice(7).trim() : null
}

async function verifyAccessToken(token) {
  if (!process.env.JWT_SECRET) {
    const error = new Error('JWT_SECRET manquant')
    error.code = 'SERVER_MISCONFIG'
    throw error
  }

  const decoded = jwt.verify(token, process.env.JWT_SECRET, {
    algorithms: ['HS256'],
    issuer: ISSUER,
    audience: AUDIENCE,
  })

  if (decoded.type !== 'access') throw new Error('INVALID_TOKEN_TYPE')
  const id = Number(decoded.userId)
  if (!Number.isInteger(id) || id <= 0) throw new Error('INVALID_USER')

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      role: true,
      isAdmin: true,
      emailConfirmed: true,
      tokenVersion: true,
    },
  })

  if (!user || !user.emailConfirmed) throw new Error('INVALID_USER')
  if (Number(decoded.version) !== user.tokenVersion) throw new Error('TOKEN_REVOKED')

  return {
    id: user.id,
    userId: user.id,
    role: user.role,
    isAdmin: user.isAdmin,
  }
}

async function authenticate(req, res, next) {
  if (req.user?.id) return next()

  const token = bearerToken(req)
  if (!token) return res.status(401).json({ error: 'NO_TOKEN' })

  try {
    req.user = await verifyAccessToken(token)
    return next()
  } catch (error) {
    if (error.code === 'SERVER_MISCONFIG') return next(error)
    return res.status(401).json({ error: 'INVALID_TOKEN' })
  }
}

authenticate.verifyAccessToken = verifyAccessToken
authenticate.ISSUER = ISSUER
authenticate.AUDIENCE = AUDIENCE

module.exports = authenticate
