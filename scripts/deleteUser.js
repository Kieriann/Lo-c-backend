const prisma = require('../utils/prismaClient')

async function run() {
  const userId = 44

  const user = await prisma.user.findFirst({ where: { id: userId } })
  if (!user) {
    console.log('❌ Utilisateur non trouvé.')
    return
  }

  try {
    await prisma.prestation.deleteMany({ where: { userId } })
    await prisma.document.deleteMany({ where: { userId } })
    await prisma.experience.deleteMany({ where: { userId } })

    const profile = await prisma.profile.findUnique({ where: { userId } })
    if (profile) {
      await prisma.address.deleteMany({ where: { profileId: profile.id } })
      await prisma.profile.delete({ where: { id: profile.id } })
    }

    await prisma.user.delete({ where: { id: userId } })

    console.log('✅ Utilisateur et toutes les données liées ont été supprimés.')
  } catch (err) {
    console.error('❌ Erreur :', err.message)
  } finally {
    await prisma.$disconnect()
  }
}

run()
