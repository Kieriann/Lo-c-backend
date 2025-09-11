const prisma = require('../utils/prismaClient')

async function run() {
  const users = await prisma.user.findMany()
  for (const user of users) {
    const lower = user.email.toLowerCase()
    if (user.email !== lower) {
      await prisma.user.update({
        where: { id: user.id },
        data: { email: lower },
      })
      console.log(`✅ Email corrigé pour l'utilisateur ${user.id}`)
    }
  }
  await prisma.$disconnect()
}

run()
