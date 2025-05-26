console.log('🧩 middleware appelé')

const jwt = require('jsonwebtoken')

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization']
  console.log('🔵 Header reçu :', authHeader)

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token manquant ou mal formé' })
  }

  const token = authHeader.split(' ')[1]

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    console.log('✅ Token décodé :', payload)
    req.user = { id: payload.userId }
    next()
  } catch (err) {
    console.log('❌ Erreur jwt.verify :', err.message)
    return res.status(401).json({ error: 'Token invalide' })
  }
}

module.exports = authenticateToken
