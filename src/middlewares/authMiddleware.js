const jwt = require('jsonwebtoken')

module.exports = function authenticate(req, res, next) {
  try {
    const h = req.headers['authorization'] || ''
    const token = h.startsWith('Bearer ') ? h.slice(7) : null
    if (!token) return res.status(401).json({ error: 'NO_TOKEN' })

    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    req.user = {
      userId : Number(decoded.userId),
      role   : decoded.role,
      isAdmin: !!decoded.isAdmin,
    }
    if (!req.user.userId) return res.status(401).json({ error: 'INVALID_TOKEN' })
    next()
  } catch (e) {
    return res.status(401).json({ error: 'INVALID_TOKEN' })
  }
}
