const crypto = require('crypto')

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const COMMON_PASSWORDS = new Set([
  'password1234',
  'motdepasse123',
  'azertyuiop12',
  '123456789012',
  'qwertyuiop12',
])

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase()
}

function isValidEmail(value) {
  const email = normalizeEmail(value)
  return email.length <= 254 && EMAIL_RE.test(email)
}

function validatePassword(value) {
  if (typeof value !== 'string') return 'Mot de passe requis'
  if (value.length < 12) return 'Le mot de passe doit contenir au moins 12 caractères'
  if (value.length > 128) return 'Le mot de passe est trop long'
  if (Buffer.byteLength(value, 'utf8') > 256) return 'Le mot de passe est trop long'
  if (COMMON_PASSWORDS.has(value.toLowerCase())) return 'Ce mot de passe est trop courant'
  return null
}

function hashToken(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex')
}

function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex')
}

function cleanText(value, { max = 255, required = false } = {}) {
  const text = String(value ?? '').trim()
  if (required && !text) return null
  return text.slice(0, max)
}

function positiveInt(value, { min = 0, max = Number.MAX_SAFE_INTEGER, fallback = null } = {}) {
  if (value === '' || value == null) return fallback
  const number = Number(value)
  if (!Number.isInteger(number)) return fallback
  return Math.max(min, Math.min(max, number))
}

function safeHttpUrl(value, { max = 500 } = {}) {
  const text = cleanText(value, { max })
  if (!text) return null
  try {
    const url = new URL(text)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null
  } catch {
    return null
  }
}

module.exports = {
  cleanText,
  hashToken,
  isValidEmail,
  normalizeEmail,
  positiveInt,
  randomToken,
  safeHttpUrl,
  validatePassword,
}
