require('dotenv').config()
const bcrypt = require('bcrypt')
const prisma = require('../src/utils/prismaClient')
const { isValidEmail, normalizeEmail, validatePassword } = require('../src/utils/security')

async function upsertAccount({ email, username, password, isAdmin, role }) {
  const normalizedEmail = normalizeEmail(email)
  const passwordError = validatePassword(password)
  if (!isValidEmail(normalizedEmail) || passwordError) {
    throw new Error(`Configuration seed invalide pour ${normalizedEmail || 'un compte'}${passwordError ? ` : ${passwordError}` : ''}`)
  }
  const passwordHash = await bcrypt.hash(password, 12)
  return prisma.user.upsert({
    where: { email: normalizedEmail },
    update: { username, password: passwordHash, isAdmin, role, emailConfirmed: true },
    create: { email: normalizedEmail, username, password: passwordHash, isAdmin, role, emailConfirmed: true },
    select: { id: true, email: true, role: true },
  })
}

async function main() {
  if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) {
    throw new Error('ADMIN_EMAIL et ADMIN_PASSWORD sont requis pour exécuter le seed')
  }

  const admin = await upsertAccount({
    email: process.env.ADMIN_EMAIL,
    username: process.env.ADMIN_USERNAME || 'Administrateur',
    password: process.env.ADMIN_PASSWORD,
    isAdmin: true,
    role: 'ADMIN',
  })
  console.log(`Compte administrateur prêt : ${admin.email}`)

  if (process.env.SEED_TEST_USER === 'true') {
    await upsertAccount({
      email: process.env.TEST_USER_EMAIL,
      username: process.env.TEST_USER_USERNAME || 'Utilisateur test',
      password: process.env.TEST_USER_PASSWORD,
      isAdmin: false,
      role: 'INDEP',
    })
    console.log('Compte de test créé sans afficher ses identifiants')
  }

  await prisma.city.createMany({
    data: [
      { name: 'Paris', country: 'France', countryCode: 'FR' },
      { name: 'Lyon', country: 'France', countryCode: 'FR' },
      { name: 'Marseille', country: 'France', countryCode: 'FR' },
      { name: 'Toulouse', country: 'France', countryCode: 'FR' },
      { name: 'London', country: 'United Kingdom', countryCode: 'GB' },
      { name: 'New York', country: 'United States', countryCode: 'US' },
    ],
    skipDuplicates: true,
  })
}

main()
  .catch(error => {
    console.error(error.message)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
