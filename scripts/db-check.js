// loic-backend/scripts/db-check.js
const prisma = require('../utils/prismaClient')

const mask = s => (s || '').replace(/:\/\/([^:]+):([^@]+)@/, '://***:***@')

;(async ()=>{
  console.log('DATABASE_URL =', mask(process.env.DATABASE_URL))
  const [users, profiles, clientRequests] = await Promise.all([
    prisma.user.count(),
    prisma.profile.count(),
    prisma.clientRequest.count(),
  ])
  console.log({ users, profiles, clientRequests })
  process.exit(0)
})().catch(e=>{ console.error(e); process.exit(1) })
