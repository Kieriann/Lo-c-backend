// prisma/seed.js

require('dotenv').config()           
const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcrypt')

const prisma = new PrismaClient()

async function main() {
  // 1) Admin Loïc
  const loicPasswordHash = await bcrypt.hash('loicisadmin', 10)
  const loic = await prisma.user.upsert({
    where: { email: 'loic.bernard15@yahoo.fr' },
    update: {
      password: loicPasswordHash,
       emailConfirmed: true,
    },
    create: {
      email: 'loic.bernard15@yahoo.fr',
      username: 'Loïc',
      password: loicPasswordHash,
      isAdmin: true,
      emailConfirmed: true,
    },
  })
  console.log('✅ Loïc prêt :', loic.email)

  // 2) Utilisateur de test
  const testPlain = 'test1234'
  const testHash = await bcrypt.hash(testPlain, 10)
  const testUser = await prisma.user.upsert({
    where: { email: 'test@freesbiz.fr' },
    update: {
      password: testHash,
      emailConfirmed: true,
    },
    create: {
      email: 'test@freesbiz.fr',
      username: 'testuser',
      password: testHash,
      isAdmin: false,
      emailConfirmed: true,
    },
  })
  console.log('✅ Test prêt :', testUser.email, '/', testPlain)
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
