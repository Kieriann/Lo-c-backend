// scripts/db-count.js
const prisma = require('../utils/prismaClient')

const KEYS = [
  'User','Profile','Address','Experience','Prestation',
  'Realisation','RealisationFile','ClientRequest','documents' // <- table en minuscules
]

async function countTable(schema, name) {
  const exists = await prisma.$queryRawUnsafe(`
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='${schema}' AND table_name='${name}'
    LIMIT 1;
  `)
  if (!exists.length) return null
  const [{ count }] = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*)::int AS count FROM "${schema}"."${name}"`
  )
  return count
}

;(async () => {
  for (const schema of ['public','shadow']) {
    const result = {}
    for (const name of KEYS) {
      try {
        const c = await countTable(schema, name)
        if (c !== null) result[name] = c
      } catch (e) { /* ignore */ }
    }
    console.log(schema, result)
  }
  process.exit(0)
})().catch(e => { console.error(e); process.exit(1) })
