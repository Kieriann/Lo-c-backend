const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcrypt')

const prisma = new PrismaClient()

async function main() {
  // 1) Création / mise à jour de l'admin Loïc
  const loicPassword = await bcrypt.hash('admin', 10)
  const loic = await prisma.user.upsert({
    where: { email: 'loic.bernard15@yahoo.fr' },
    update: {
      password: loicPassword,
      emailConfirmed: true,
    },
    create: {
      email: 'loic.bernard15@yahoo.fr',
      username: 'Loïc',
      password: loicPassword,
      isAdmin: true,
      emailConfirmed: true,
    },
  })
  console.log('✅ Utilisateur Loïc créé / mis à jour :', loic.email)

  // 2) Création / mise à jour de l'utilisateur de test
  const testPasswordPlain = 'test1234'
  const testPasswordHash = await bcrypt.hash(testPasswordPlain, 10)
  const testUser = await prisma.user.upsert({
    where: { email: 'test@freesbiz.fr' },
    update: {
      password: testPasswordHash,
      emailConfirmed: true,
    },
    create: {
      email: 'test@freesbiz.fr',
      username: 'testuser',
      password: testPasswordHash,
      isAdmin: false,
      emailConfirmed: true,
    },
  })
  console.log('✅ Utilisateur de test créé / mis à jour :')
  console.log(`   email: ${testUser.email}`)
  console.log(`   mdp  : ${testPasswordPlain}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
