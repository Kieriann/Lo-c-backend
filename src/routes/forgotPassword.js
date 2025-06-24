const express = require('express')
const router = express.Router()
const nodemailer = require('nodemailer')
const jwt = require('jsonwebtoken')
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

router.post('/', async (req, res) => {
  const { email } = req.body
  if (!email) return res.status(400).json({ error: 'Email requis' })

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) return res.status(200).json({ success: true }) // ne pas révéler si l'email existe

  const token = jwt.sign(
    { userId: user.id },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }
  )

  const resetLink = `${process.env.FRONT_URL}/reset-password/${token}`

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS,
    },
  })

  try {
    await transporter.sendMail({
      from: process.env.MAIL_USER,
      to: email,
      subject: 'Réinitialisation de votre mot de passe',
      text: `Voici votre lien pour réinitialiser votre mot de passe : ${resetLink}`,
    })

    res.json({ success: true })
  } catch (err) {
    console.error('Erreur envoi email', err)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

module.exports = router
