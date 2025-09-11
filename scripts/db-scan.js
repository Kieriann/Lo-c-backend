// loic-backend/scripts/db-scan.js
const prisma = require('../utils/prismaClient')

const mask = s => (s || '').replace(/:\/\/([^:]+):([^@]+)@/, '://***:***@')

;(async () => {
  console.log('DATABASE_URL =', mask(process.env.DATABASE_URL))

  // 1) Schémas existants
  const schemas = await prisma.$queryRaw`
    SELECT schema_name
    FROM information_schema.schemata
    WHERE schema_name NOT IN ('pg_catalog','information_schema')
    ORDER BY schema_name;
  `
  console.log('Schemas:', schemas.map(s => s.schema_name).join(', ') || '(aucun)')

  // 2) Tables + estimations de lignes (tous schémas)
  const tables = await prisma.$queryRawUnsafe(`
    SELECT n.nspname AS schema, c.relname AS table, c.reltuples::bigint AS estimate_rows
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'r'
      AND n.nspname NOT IN ('pg_catalog','information_schema')
    ORDER BY estimate_rows DESC, n.nspname, c.relname;
  `)
  console.log('Tables (estimate):')
  tables.slice(0, 50).forEach(t => {
    console.log(` - ${t.schema}.${t.table} ≈ ${t.estimate_rows}`)
  })
  if (tables.length > 50) console.log(`… (${tables.length - 50} de plus)`)

  // 3) Comptages précis si tables clés existent dans d'autres schémas
  const keyTables = ['User','Profile','ClientRequest','Document','Experience','Prestation','Address','Realisation']
  for (const sch of schemas.map(s => s.schema_name)) {
    for (const name of keyTables) {
      try {
        const exists = await prisma.$queryRawUnsafe(`
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema='${sch}' AND table_name='${name}'
          LIMIT 1;
        `)
        if (exists.length) {
          const [{ count }] = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS count FROM "${sch}"."${name}"`)
          if (count > 0) {
            console.log(`[FOUND] ${sch}.${name}: ${count}`)
          }
        }
      } catch (_) {}
    }
  }

  process.exit(0)
})().catch(e => {
  console.error(e)
  process.exit(1)
})
