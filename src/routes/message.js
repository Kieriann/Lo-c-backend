const express = require('express')
const router = express.Router()
const prisma = require('../utils/prismaClient')
const authenticate = require('../middlewares/authMiddleware')
const rateLimit = require('../middlewares/rateLimit')
const { cleanText, positiveInt } = require('../utils/security')

const sendLimit = rateLimit({ windowMs: 60 * 1000, max: 20, name: 'messages' })

/**
 * Envoyer un message
 */
router.post('/', authenticate, sendLimit, async (req, res) => {
  if (!req.user?.id) return res.status(401).json({ error: 'Non authentifié' })

  const receiver = positiveInt(req.body?.receiverId, { min: 1 })
  const content = cleanText(req.body?.content, { max: 5000 })
  if (!receiver || !content) return res.status(400).json({ error: 'Données invalides' })
  if (receiver === req.user.id) return res.status(400).json({ error: 'Destinataire invalide' })

  try {
    const recipient = await prisma.user.findUnique({
      where: { id: receiver },
      select: {
        id: true,
        role: true,
        emailConfirmed: true,
        Profile: { select: { diffusionAutorisee: true } },
      },
    })
    if (!recipient?.emailConfirmed) return res.status(404).json({ error: 'Destinataire introuvable' })

    if (!req.user.isAdmin && req.user.role === 'CLIENT') {
      if (recipient.role !== 'INDEP' || !recipient.Profile?.diffusionAutorisee) {
        return res.status(403).json({ error: 'Conversation non autorisée' })
      }
    } else if (!req.user.isAdmin && req.user.role === 'INDEP') {
      const existingConversation = await prisma.message.findFirst({
        where: {
          OR: [
            { senderId: req.user.id, receiverId: receiver },
            { senderId: receiver, receiverId: req.user.id },
          ],
        },
        select: { id: true },
      })
      if (recipient.role !== 'CLIENT' || !existingConversation) {
        return res.status(403).json({ error: 'Conversation non autorisée' })
      }
    } else if (!req.user.isAdmin) {
      return res.status(403).json({ error: 'Conversation non autorisée' })
    }
    const message = await prisma.message.create({
      data: {
        senderId: req.user.id,
        receiverId: receiver,
        content,
      },
    })
    res.json(message)
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de l’envoi du message' })
  }
})

/**
 * Liste des fils (autres interlocuteurs) avec dernier message + non lus
 */
router.get('/threads', authenticate, async (req, res) => {
  const me = req.user.id

  try {
    const last50 = await prisma.message.findMany({
      where: {
        OR: [{ senderId: me }, { receiverId: me }],
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    const unreadByOther = await prisma.message.groupBy({
      by: ['senderId'],
      where: { receiverId: me, isRead: false },
      _count: { senderId: true },
    })
    const unreadMap = new Map(unreadByOther.map(u => [u.senderId, u._count.senderId]))

    const map = new Map()
    for (const m of last50) {
      const other = m.senderId === me ? m.receiverId : m.senderId
      if (!map.has(other)) {
        map.set(other, {
          otherId: other,
          lastMessage: m,
          unread: unreadMap.get(other) || 0,
        })
      }
    }

    res.json(Array.from(map.values()))
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la récupération des threads' })
  }
})

/**
 * Compter les non lus du user connecté
 */
router.get('/unread/count', authenticate, async (req, res) => {
  if (!req.user?.id) return res.status(401).json({ error: 'Non authentifié' })

  try {
    const count = await prisma.message.count({
      where: {
        receiverId: req.user.id,
        isRead: false,
      },
    })
    res.json({ unreadCount: count })
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors du comptage des messages non lus' })
  }
})

/**
 * Marquer un message comme lu
 */
router.patch('/:id/read', authenticate, async (req, res) => {
  if (!req.user?.id) return res.status(401).json({ error: 'Non authentifié' })

  const messageId = positiveInt(req.params.id, { min: 1 })
  if (!messageId) return res.status(400).json({ error: 'id invalide' })

  try {
    const existing = await prisma.message.findUnique({
      where: { id: messageId },
    })

    if (!existing) {
      return res.status(404).json({ error: 'Message introuvable' })
    }

    // on ne peut marquer comme lu que SES propres messages reçus
    if (existing.receiverId !== req.user.id) {
      return res.status(403).json({ error: 'Interdit' })
    }

    const updated = await prisma.message.update({
      where: { id: messageId },
      data: { isRead: true },
    })

    res.json(updated)
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la mise à jour du statut' })
  }
})


/**
 * Récupérer la conversation avec un utilisateur + marquer reçus comme lus
 */
router.get('/:otherId', authenticate, async (req, res) => {
  if (!req.user?.id) return res.status(401).json({ error: 'Non authentifié' })

  const otherId = positiveInt(req.params.otherId, { min: 1 })
  if (!otherId) return res.status(400).json({ error: 'otherId invalide' })

  try {
    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: req.user.id, receiverId: otherId },
          { senderId: otherId, receiverId: req.user.id },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
      include: {
        sender: {
          select: {
            id: true,
            Profile: { select: { workerStatus: true } },
          },
        },
      },
    })

    await prisma.message.updateMany({
      where: {
        senderId: otherId,
        receiverId: req.user.id,
        isRead: false,
      },
      data: { isRead: true },
    })

    res.json(messages.reverse())
  } catch (error) {
    console.error('GET /api/messages/:otherId failed:', error)
    res.status(500).json({ error: 'Erreur lors de la récupération des messages' })
  }
})

module.exports = router
