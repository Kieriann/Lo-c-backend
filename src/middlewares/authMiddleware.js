const jwt = require('jsonwebtoken')
const authenticate = require('./src/middleware/authMiddleware')


module.exports = function authenticate(req, res, next) {
  try {
    const h = req.headers['authorization'] || ''
    const token = h.startsWith('Bearer ') ? h.slice(7) : null
    if (!token) return res.status(401).json({ error: 'NO_TOKEN' })

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ error: 'SERVER_MISCONFIG' })
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    const id = Number(decoded.userId)
    req.user = {
      id,            
      userId: id,    
      role: decoded.role,
      isAdmin: !!decoded.isAdmin,
    }
    if (!req.user.id) return res.status(401).json({ error: 'INVALID_TOKEN' })
    next()
  } catch {
    return res.status(401).json({ error: 'INVALID_TOKEN' })
  }
}
