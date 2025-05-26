const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const loic = await prisma.user.upsert({
    where: { email: 'loic.bernard15@yahoo.fr' },
    update: {},
    create: {
      email: 'loic.bernard15@yahoo.fr',
      username: 'Loïc',
      password: 'admin', // à remplacer plus tard par un hashé
      isAdmin: true,
    },
  })

  console.log('✅ Utilisateur Loïc créé :', loic)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => {
    prisma.$disconnect()
  })
