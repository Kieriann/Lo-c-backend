const test = require('node:test')
const assert = require('node:assert/strict')
const {
  cleanText,
  hashToken,
  isValidEmail,
  normalizeEmail,
  positiveInt,
  randomToken,
  safeHttpUrl,
  validatePassword,
} = require('../src/utils/security')
const rateLimit = require('../src/middlewares/rateLimit')

test('normalise et valide les adresses e-mail', () => {
  assert.equal(normalizeEmail('  User@Example.COM '), 'user@example.com')
  assert.equal(isValidEmail('user@example.com'), true)
  assert.equal(isValidEmail('not-an-email'), false)
})

test('refuse les mots de passe faibles et accepte une phrase longue', () => {
  assert.match(validatePassword('court'), /12 caractères/)
  assert.ok(validatePassword('password1234'))
  assert.equal(validatePassword('Une phrase solide 2026 !'), null)
})

test('génère et hache des jetons sans conserver leur valeur brute', () => {
  const token = randomToken(32)
  assert.equal(token.length, 64)
  assert.notEqual(hashToken(token), token)
  assert.equal(hashToken(token), hashToken(token))
})

test('borne les nombres, les textes et les URL', () => {
  assert.equal(cleanText('  abcdef ', { max: 3 }), 'abc')
  assert.equal(positiveInt('12', { min: 1, max: 10 }), 10)
  assert.equal(positiveInt('x', { fallback: 4 }), 4)
  assert.equal(safeHttpUrl('javascript:alert(1)'), null)
  assert.equal(safeHttpUrl('https://example.com/path'), 'https://example.com/path')
})

test('limite les requêtes par adresse IP', () => {
  const middleware = rateLimit({ windowMs: 60_000, max: 2, name: `test-${Date.now()}` })
  const makeResponse = () => ({
    headers: {},
    statusCode: 200,
    body: null,
    set(name, value) { this.headers[name] = value; return this },
    status(code) { this.statusCode = code; return this },
    json(body) { this.body = body; return this },
  })
  const request = { ip: '203.0.113.10', socket: {} }
  let nextCalls = 0
  middleware(request, makeResponse(), () => { nextCalls += 1 })
  middleware(request, makeResponse(), () => { nextCalls += 1 })
  const rejected = makeResponse()
  middleware(request, rejected, () => { nextCalls += 1 })
  assert.equal(nextCalls, 2)
  assert.equal(rejected.statusCode, 429)
  assert.deepEqual(rejected.body, { error: 'TOO_MANY_REQUESTS' })
})
