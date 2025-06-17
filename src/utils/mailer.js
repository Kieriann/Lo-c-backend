// src/utils/mailer.js
/**
 * sendEmail({ to, subject, text })
 * Pour l’instant on logge simplement, plus tard on pourra
 * brancher un vrai provider (Sendgrid, Mailgun, Nodemailer…).
 */
async function sendEmail({ to, subject, text }) {
  console.log('=== Envoi d’un e-mail ===')
  console.log(`À     : ${to}`)
  console.log(`Objet : ${subject}`)
  console.log('Contenu :')
  console.log(text)
  console.log('=== Email simulé envoyé ===')
  // ici tu pourrais renvoyer un résultat ou lever une erreur si besoin
}

module.exports = { sendEmail }
