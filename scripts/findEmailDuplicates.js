const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function run() {
  const users = await prisma.user.findMany()
  const map = new Map()
  const duplicates = []

  for (const user of users) {
    const lower = user.email.toLowerCase()
    if (map.has(lower)) {
      duplicates.push({ id: user.id, email: user.email })
    } else {
      map.set(lower, user)
    }
  }

  if (duplicates.length === 0) {
    console.log('✅ Aucun doublon trouvé.')
  } else {
    console.log('⚠ Doublons à corriger manuellement :')
    console.table(duplicates)
  }

  await prisma.$disconnect()
}

run()
