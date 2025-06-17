// src/utils/mailer.js

/**
 * sendEmail({ to, subject, text })
 * Pour l’instant on logge simplement, plus tard on pourra
 * brancher un vrai provider (Sendgrid, Mailgun, Nodemailer…).
 *
 * Retourne une promesse qui résout en { to, subject, text }
 * ou rejette en cas d’erreur simulée.
 */
async function sendEmail({ to, subject, text }) {
  try {
    console.log('=== Envoi d’un e-mail ===')
    console.log(`À     : ${to}`)
    console.log(`Objet : ${subject}`)
    console.log('Contenu :')
    console.log(text)
    console.log('=== Email simulé envoyé ===')
    // on renvoie le payload pour test unitaire / chaining
    return { to, subject, text }
  } catch (err) {
    console.error('Erreur lors de l’envoi d’e-mail simulé :', err)
    // on rejette pour qu’un appelant puisse faire un catch
    throw err
  }
}

module.exports = { sendEmail }
