const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT relname AS table, n_live_tup AS approx_rows
    FROM pg_stat_user_tables
    ORDER BY relname;
  `)
  console.log(rows)
}

main()
  .catch(console.error)
  .finally(async () => { await prisma.$disconnect() })
