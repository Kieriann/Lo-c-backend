const express = require('express')
const router = express.Router()
const jwt = require('jsonwebtoken')
const bcrypt = require('bcrypt')
const prisma = require('../utils/prismaClient')

router.post('/', async (req, res) => {
  const { token, password } = req.body
  if (!token || !password) return res.status(400).json({ error: 'Données manquantes' })

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    const hashed = await bcrypt.hash(password, 10)

    await prisma.user.update({
      where: { id: decoded.userId },
      data: { password: hashed },
    })

    res.json({ success: true })
  } catch (err) {
    res.status(400).json({ error: 'Token invalide ou expiré' })
  }
})

module.exports = router
