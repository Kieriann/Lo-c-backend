const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

// ─── Création de l'utilisateur administrateur Loïc ────────────────

async function main() {
  const loic = await prisma.user.upsert({
    where: { email: 'loic.bernard15@yahoo.fr' },
    update: {},
    create: {
      email: 'loic.bernard15@yahoo.fr',
      username: 'Loïc',
      password: 'admin', //  à remplacer par un mot de passe hashé en prod
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
