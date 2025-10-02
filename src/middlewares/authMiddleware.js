const jwt = require('jsonwebtoken')

module.exports = function authenticate(req, res, next) {
  try {
    const h = req.headers['authorization'] || ''
    const token = h.startsWith('Bearer ') ? h.slice(7) : null
    if (!token) return res.status(401).json({ error: 'NO_TOKEN' })

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
