const express = require('express')
const router = express.Router()
const jwt = require('jsonwebtoken')
const prisma = require('../utils/prismaClient')
const sgMail = require('@sendgrid/mail')
sgMail.setApiKey(process.env.SENDGRID_API_KEY)

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

  try {
    await sgMail.send({
      to: email,
      from: 'no-reply@freesbiz.fr',
      subject: 'Réinitialisation de votre mot de passe',
      text: `Voici votre lien pour réinitialiser votre mot de passe : ${resetLink}`,
      html: `<p>Voici votre lien pour réinitialiser votre mot de passe : <a href="${resetLink}">${resetLink}</a></p>`
    })

    res.json({ success: true })
  } catch (err) {
    console.error('Erreur envoi email', err)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

module.exports = router
