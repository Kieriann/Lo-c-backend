const express = require('express')
const router = express.Router()
const prisma = require('../utils/prismaClient')
const authenticate = require('../middlewares/authMiddleware')


// Créer une demande
router.post('/', authenticate, async (req, res) => {
  try {
    const { title = '', description, minRate, maxRate, deadline, items = [] } = req.body
    if (!description || minRate == null || maxRate == null) return res.status(400).json({ error: 'Missing fields' })

    const sr = await prisma.serviceRequest.create({
      data: {
        ownerId: req.user.userId,
        title,
        description,
        minRate: Number(minRate),
        maxRate: Number(maxRate),
        deadline: deadline ? new Date(deadline) : null,
        status: 'OPEN',
        items: {
          create: items.map(i => ({ skillLabel: i.skillLabel, level: i.level })),
        },
      },
      include: { items: true }
    })
    res.json(sr)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'SERVER_ERROR' })
  }
})

// Mes demandes
router.get('/mine', authenticate, async (req, res) => {
  const list = await prisma.serviceRequest.findMany({
    where: { ownerId: req.user.userId },
    include: { items: true, shortlist: true },
    orderBy: { createdAt: 'desc' }
  })
  res.json(list)
})

// Ajouter une shortlist (liste d’IDs d’indep)
router.post('/:id/shortlist', authenticate, async (req, res) => {
  const { candidateIds = [] } = req.body
  const id = Number(req.params.id)
  const sr = await prisma.serviceRequest.findFirst({ where: { id, ownerId: req.user.userId } })
  if (!sr) return res.status(404).json({ error: 'NOT_FOUND' })

  const data = candidateIds.map(cid => ({
    serviceRequestId: id,
    candidateId: Number(cid),
  }))

  await prisma.serviceShortlist.createMany({ data, skipDuplicates: true })
  const updated = await prisma.serviceRequest.findUnique({
    where: { id },
    include: { items: true, shortlist: true }
  })
  res.json(updated)
})

// Marquer CONTACTED (facilite l’UI quand on ouvre la messagerie)
router.post('/:id/contact', authenticate, async (req, res) => {
  const id = Number(req.params.id)
  const { candidateIds = [] } = req.body
  const sr = await prisma.serviceRequest.findFirst({ where: { id, ownerId: req.user.userId } })
  if (!sr) return res.status(404).json({ error: 'NOT_FOUND' })

  await prisma.serviceShortlist.updateMany({
    where: { serviceRequestId: id, candidateId: { in: candidateIds.map(Number) } },
    data: { status: 'CONTACTED' }
  })
  res.json({ ok: true })
})

module.exports = router
