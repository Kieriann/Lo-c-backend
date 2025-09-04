const { Client } = require('pg')

async function main() {
  const client = new Client({
    connectionString: 'postgresql://base_de_donnees_freesbiz_user:xC2ffaQsqSWfS1LG7VeEHl9tnvO0K3S1@dpg-d15bh6e3jp1c73fn0u90-a.frankfurt-postgres.render.com/base_de_donnees_freesbiz',
    ssl: { rejectUnauthorized: false }
  })
  await client.connect()
  const { rows } = await client.query(`SELECT datname FROM pg_database ORDER BY datname`)
  console.log(rows.map(r => r.datname))
  await client.end()
}

main().catch(console.error)
