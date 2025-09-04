const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const rows = await prisma.$queryRawUnsafe(
    `select current_database() as db, current_user as usr, inet_server_addr()::text as addr`
  )
  console.log(rows[0])
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect()
  })
