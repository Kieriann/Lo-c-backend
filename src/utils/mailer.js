// src/utils/mailer.js

/**
 * sendEmail({ to, subject, text })
 * Pour l’instant, on simule l’envoi en loggant tout simplement.
 * Retourne une promesse qui résout en { to, subject, text }.
 */
async function sendEmail({ to, subject, text }) {
  console.log('=== Simulated e-mail send ===')
  console.log(`To      : ${to}`)
  console.log(`Subject : ${subject}`)
  console.log('Content :')
  console.log(text)
  console.log('=== End of simulation ===')
  return { to, subject, text }
}

module.exports = { sendEmail }
