const { Client } = require('pg')

async function check(dbname) {
  const client = new Client({
    connectionString: `postgresql://base_de_donnees_freesbiz_user:xC2ffaQsqSWfS1LG7VeEHl9tnvO0K3S1@dpg-d15bh6e3jp1c73fn0u90-a.frankfurt-postgres.render.com/${dbname}`,
    ssl: { rejectUnauthorized: false }
  })
  await client.connect()
  let count
  try {
    const r = await client.query('select count(*)::int as c from "User"')
    count = r.rows[0].c
  } catch {
    count = 'no User table'
  } finally {
    await client.end()
  }
  return { db: dbname, count }
}

async function main() {
  const dbs = [
    'base_de_donnees_freesbiz',
    'postgres',
    'template0',
    'template1',
    'prisma_migrate_shadow_db_08f1c9b6-2994-45f9-9818-8fcab8578ff1',
    'prisma_migrate_shadow_db_095c3495-8648-4691-a436-9a4437752102',
    'prisma_migrate_shadow_db_0e280817-cc47-459f-9857-ac06216be922',
    'prisma_migrate_shadow_db_19d6438a-9b0d-4cd8-a45c-c5c964400605',
    'prisma_migrate_shadow_db_2a5c759e-8c33-4561-b0ff-d9546c0ebe09',
    'prisma_migrate_shadow_db_8158e899-2323-4b12-b488-3553d4cc7d97',
    'prisma_migrate_shadow_db_b04448c6-30cb-4e71-9820-b7e755506f26',
    'prisma_migrate_shadow_db_c3ed6304-8499-4a23-aef3-29dec889949c',
    'prisma_migrate_shadow_db_d8fc3c2c-de09-412f-a220-a6ec6bc64a2d',
    'prisma_migrate_shadow_db_e6863dee-fb69-4ec1-a388-fa690d5b4a07',
    'prisma_migrate_shadow_db_f2c76e1c-4667-447d-a0c7-a24b8e612d25',
    'prisma_migrate_shadow_db_f50e4693-2de2-4361-9a0f-891a0bd7cf3b',
    'prisma_migrate_shadow_db_f78d442c-885c-44f2-856d-f8e23f2ab376',
    'prisma_migrate_shadow_db_f920834a-ce0f-41ba-8302-a8cbbd8fefb6',
  ]
  for (const db of dbs) {
    console.log(await check(db))
  }
}

main()
