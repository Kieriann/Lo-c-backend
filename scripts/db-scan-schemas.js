const { Client } = require('pg')

async function main(){
  const client = new Client({
    connectionString: 'postgresql://base_de_donnees_freesbiz_user:xC2ffaQsqSWfS1LG7VeEHl9tnvO0K3S1@dpg-d15bh6e3jp1c73fn0u90-a.frankfurt-postgres.render.com/base_de_donnees_freesbiz',
    ssl: { rejectUnauthorized: false }
  })
  await client.connect()

  const { rows: schemas } = await client.query(`
    select schema_name from information_schema.schemata
    where schema_name not in ('pg_catalog','information_schema')
    order by 1
  `)

  for (const s of schemas){
    let count = 'no User table'
    try{
      const r = await client.query(`select count(*)::int as c from "${s.schema_name}"."User"`)
      count = r.rows[0].c
    }catch{}
    console.log({ schema: s.schema_name, user_count: count })
  }

  await client.end()
}

main().catch(console.error)
