function requireRole(...allowedRoles) {
  const allowed = new Set(allowedRoles)
  return function checkRole(req, res, next) {
    if (!req.user?.id) return res.status(401).json({ error: 'UNAUTHENTICATED' })
    if (req.user.isAdmin || allowed.has(req.user.role)) return next()
    return res.status(403).json({ error: 'FORBIDDEN' })
  }
}

function requireAdmin(req, res, next) {
  if (!req.user?.id) return res.status(401).json({ error: 'UNAUTHENTICATED' })
  if (!req.user.isAdmin) return res.status(403).json({ error: 'FORBIDDEN' })
  return next()
}

module.exports = { requireAdmin, requireRole }
