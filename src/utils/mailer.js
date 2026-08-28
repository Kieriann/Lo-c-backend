const sgMail = require('@sendgrid/mail')

const apiKey = process.env.SENDGRID_API_KEY || ''
const enabled = apiKey.startsWith('SG.')

if (enabled) sgMail.setApiKey(apiKey)

async function sendEmail({ to, subject, text, html }) {
  if (!enabled) {
    const error = new Error('Service e-mail non configuré')
    error.code = 'EMAIL_NOT_CONFIGURED'
    throw error
  }

  const from = process.env.EMAIL_FROM || 'no-reply@freesbiz.fr'
  await sgMail.send({ to, from, subject, text, html })
  return { sent: true }
}

module.exports = { sendEmail }
