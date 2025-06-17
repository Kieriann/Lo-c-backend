const nodemailer = require('nodemailer')

// Configuration du transport SMTP à partir des variables d'environnement
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: Number(process.env.SMTP_PORT) === 465, // true pour port 465, false pour les autres
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

/**
 * sendEmail({ to, subject, text, html })
 * Envoie un e-mail via Nodemailer.
 * @returns {Promise<Object>} Le résultat de l’envoi
 */
async function sendEmail({ to, subject, text, html }) {
  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to,
    subject,
    text,
    html,
  }

  try {
    const info = await transporter.sendMail(mailOptions)
    console.log('=== E-mail envoyé ===')
    console.log(`MessageId: ${info.messageId}`)
    return info
  } catch (err) {
    console.error('Erreur lors de l’envoi d’e-mail :', err)
    throw err
  }
}

module.exports = { sendEmail }
