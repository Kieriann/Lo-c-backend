const { Client } = require('pg')
require('dotenv').config()

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL manquant')
  const client = new Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()
  try {
    const result = await client.query('select count(*)::int as count from "User"')
    console.log({ reachable: true, userCount: result.rows[0].count })
  } finally {
    await client.end()
  }
}

main().catch(error => {
  console.error(error.message)
  process.exitCode = 1
})
