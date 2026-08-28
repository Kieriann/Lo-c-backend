const test = require('node:test')
const assert = require('node:assert/strict')
const {
  addUtcMonths,
  getInactivityMilestone,
  getReferenceAt,
  warningEmail,
} = require('../src/jobs/inactivityWarnings')

const createdAt = new Date('2024-01-31T12:00:00.000Z')

function user(overrides = {}) {
  return {
    id: 1,
    email: 'user@example.com',
    createdAt,
    firstLoginAt: null,
    lastLoginAt: null,
    inactivity22WarningSentAt: null,
    inactivity23WarningSentAt: null,
    ...overrides,
  }
}

test('ajoute les mois sans dépasser la fin du mois', () => {
  assert.equal(addUtcMonths(createdAt, 1).toISOString(), '2024-02-29T12:00:00.000Z')
})

test('utilise en priorité la dernière connexion', () => {
  const lastLoginAt = new Date('2025-06-15T10:00:00.000Z')
  assert.equal(getReferenceAt(user({ lastLoginAt })), lastLoginAt)
})

test('déclenche un seul rappel à 22 puis 23 mois', () => {
  assert.equal(getInactivityMilestone(user(), new Date('2025-11-30T12:00:00.000Z')), 22)
  assert.equal(getInactivityMilestone(user(), new Date('2025-12-31T12:00:00.000Z')), 23)
  assert.equal(getInactivityMilestone(user({ inactivity23WarningSentAt: new Date() }), new Date('2025-12-31T12:00:00.000Z')), null)
})

test('le message avertit sans annoncer de suppression automatique', () => {
  const email = warningEmail(user(), 23)
  assert.match(email.subject, /Dernier rappel/)
  assert.match(email.text, /Aucune suppression automatique/)
  assert.match(email.text, /Se connecter|Accéder/)
})
