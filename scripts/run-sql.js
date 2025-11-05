const { PrismaClient } = require('@prisma/client')
const fs = require('fs')

const prisma = new PrismaClient()

async function main() {
  const path = 'prisma/manual/forum.sql'
  if (!fs.existsSync(path)) {
    console.error('❌ Fichier introuvable :', path)
    process.exit(1)
  }
  const raw = fs.readFileSync(path, 'utf8')

  // nettoie commentaires et lignes vides
  const cleaned = raw
    .split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('--'))
    .join('\n')

  // split par “;” de fin d’instruction
  const statements = cleaned
    .split(/;\s*(?:\r?\n|$)/g)
    .map(s => s.trim())
    .filter(Boolean)

  console.log(`▶️ Exécution de ${statements.length} statements SQL…`)
  for (let i = 0; i < statements.length; i++) {
    const sql = statements[i]
    console.log(`  - [${i + 1}/${statements.length}]`)
    await prisma.$executeRawUnsafe(sql)
  }
  console.log('✅ Terminé.')
}

main()
  .catch(e => { console.error('❌ Erreur SQL:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
