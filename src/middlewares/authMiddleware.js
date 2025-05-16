import jwt from 'jsonwebtoken'

export function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization
  if (!authHeader) {
    return res.status(401).json({ error: 'Token manquant' })
  }

  const token = authHeader.split(' ')[1]
  if (!token) {
    return res.status(401).json({ error: 'Token manquant' })
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    req.userId = payload.userId
    next()
  } catch (err) {
    return res.status(401).json({ error: 'Token invalide' })
  }
}
