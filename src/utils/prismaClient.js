// utils/prismaClient.js
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

prisma.$use(async (params, next) => {
  if (
    params.model === 'User' &&
    ['create', 'update', 'upsert'].includes(params.action)
  ) {
    const data = params.args.data
    if (data?.email) {
      data.email = data.email.toLowerCase()
    }
  }
  return next(params)
})

prisma.$use(async (params, next) => {
  if (params.model === 'User' && ['create', 'update'].includes(params.action)) {
    if (params.args.data?.email) {
      params.args.data.email = params.args.data.email.toLowerCase()
    }
  }
  return next(params)
})


module.exports = prisma
