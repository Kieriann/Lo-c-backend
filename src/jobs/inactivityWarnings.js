const prisma = require('../utils/prismaClient')
const { sendEmail } = require('../utils/mailer')

const DAY_MS = 24 * 60 * 60 * 1000
const DEFAULT_INITIAL_DELAY_MS = 60 * 1000

function addUtcMonths(value, months) {
  const date = new Date(value)
  const day = date.getUTCDate()
  date.setUTCDate(1)
  date.setUTCMonth(date.getUTCMonth() + months)
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate()
  date.setUTCDate(Math.min(day, lastDay))
  return date
}

function getReferenceAt(user) {
  return user.lastLoginAt || user.firstLoginAt || user.createdAt
}

function getInactivityMilestone(user, now = new Date()) {
  const referenceAt = getReferenceAt(user)
  if (addUtcMonths(referenceAt, 23) <= now) {
    return user.inactivity23WarningSentAt ? null : 23
  }
  if (addUtcMonths(referenceAt, 22) <= now && !user.inactivity22WarningSentAt) return 22
  return null
}

function warningEmail(user, milestone) {
  const referenceAt = getReferenceAt(user)
  const reviewAt = addUtcMonths(referenceAt, 24)
  const formattedReviewAt = new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'long',
    timeZone: 'Europe/Paris',
  }).format(reviewAt)
  const isFinalReminder = milestone === 23
  const subject = isFinalReminder
    ? 'Dernier rappel concernant votre compte Free’s Biz'
    : 'Votre compte Free’s Biz est inactif'
  const intro = isFinalReminder
    ? 'Votre compte Free’s Biz approche de 24 mois sans connexion.'
    : 'Votre compte Free’s Biz est sans connexion depuis 22 mois.'
  const action = `Reconnectez-vous avant le ${formattedReviewAt} pour confirmer que vous souhaitez conserver votre compte.`
  const policy = 'Sans reconnexion, votre compte pourra être examiné pour suppression. Aucune suppression automatique n’est actuellement activée.'

  return {
    to: user.email,
    subject,
    text: `${intro}\n\n${action}\n\n${policy}\n\nAccéder à Free’s Biz : ${process.env.FRONT_URL || 'https://freesbiz.fr'}`,
    html: `<p>${intro}</p><p>${action}</p><p>${policy}</p><p><a href="${process.env.FRONT_URL || 'https://freesbiz.fr'}">Se connecter à Free’s Biz</a></p>`,
  }
}

async function claimWarning(user, milestone, claimedAt) {
  const field = milestone === 23 ? 'inactivity23WarningSentAt' : 'inactivity22WarningSentAt'
  return prisma.user.updateMany({
    where: { id: user.id, [field]: null },
    data: { [field]: claimedAt },
  })
}

async function releaseWarning(userId, milestone, claimedAt) {
  const field = milestone === 23 ? 'inactivity23WarningSentAt' : 'inactivity22WarningSentAt'
  await prisma.user.updateMany({
    where: { id: userId, [field]: claimedAt },
    data: { [field]: null },
  })
}

async function runInactivityWarnings({ now = new Date(), dryRun = false } = {}) {
  const oldestEligibleCreation = addUtcMonths(now, -22)
  const users = await prisma.user.findMany({
    where: {
      isAdmin: false,
      emailConfirmed: true,
      createdAt: { lte: oldestEligibleCreation },
    },
    select: {
      id: true,
      email: true,
      createdAt: true,
      firstLoginAt: true,
      lastLoginAt: true,
      inactivity22WarningSentAt: true,
      inactivity23WarningSentAt: true,
    },
  })

  const report = { checked: users.length, due22: 0, due23: 0, sent: 0, failed: 0 }
  for (const user of users) {
    const milestone = getInactivityMilestone(user, now)
    if (!milestone) continue
    report[milestone === 23 ? 'due23' : 'due22'] += 1
    if (dryRun) continue

    const claimedAt = new Date()
    const claim = await claimWarning(user, milestone, claimedAt)
    if (claim.count !== 1) continue

    try {
      await sendEmail(warningEmail(user, milestone))
      report.sent += 1
    } catch (error) {
      report.failed += 1
      await releaseWarning(user.id, milestone, claimedAt)
      console.error(`Inactivity warning failed for user ${user.id}:`, error.code || error.message)
    }
  }

  return report
}

function startInactivityWarningScheduler() {
  const configuredDelay = Number(process.env.INACTIVITY_WARNINGS_INITIAL_DELAY_MS)
  const initialDelay = Number.isFinite(configuredDelay) && configuredDelay >= 0
    ? configuredDelay
    : DEFAULT_INITIAL_DELAY_MS
  const run = () => runInactivityWarnings()
    .then(report => console.log('Inactivity warnings:', report))
    .catch(error => console.error('Inactivity warnings job failed:', error.message))

  const timeout = setTimeout(() => {
    run()
    const interval = setInterval(run, DAY_MS)
    interval.unref()
  }, initialDelay)
  timeout.unref()
}

module.exports = {
  addUtcMonths,
  getInactivityMilestone,
  getReferenceAt,
  runInactivityWarnings,
  startInactivityWarningScheduler,
  warningEmail,
}
