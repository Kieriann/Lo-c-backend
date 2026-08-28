require('dotenv').config()

const prisma = require('../src/utils/prismaClient')
const { runInactivityWarnings } = require('../src/jobs/inactivityWarnings')

const dryRun = process.argv.includes('--dry-run')

runInactivityWarnings({ dryRun })
  .then(report => {
    console.log(JSON.stringify({ dryRun, ...report }))
  })
  .catch(error => {
    console.error(error.message)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
