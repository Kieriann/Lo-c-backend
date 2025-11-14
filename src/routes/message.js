const express = require('express')
const router = express.Router()
const prisma = require('../utils/prismaClient')
const authenticate = require('../middlewares/authMiddleware')

/**
 * Envoyer un message
 */
router.post('/', authenticate, async (req, res) => {
  if (!req.user?.id) return res.status(401).json({ error: 'Non authentifié' })

  const { receiverId, content } = req.body
  const receiver = parseInt(receiverId, 10)
  if (!receiver || !content) return res.status(400).json({ error: 'Données invalides' })

  try {
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

  const messageId = parseInt(req.params.id, 10)
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

  const otherId = parseInt(req.params.otherId, 10)
  if (!otherId) return res.status(400).json({ error: 'otherId invalide' })

  try {
    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: req.user.id, receiverId: otherId },
          { senderId: otherId, receiverId: req.user.id },
        ],
      },
      orderBy: { createdAt: 'asc' },
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

    res.json(messages)
  } catch (error) {
    console.error('GET /api/messages/:otherId failed:', error)
    res.status(500).json({ error: 'Erreur lors de la récupération des messages' })
  }
})

module.exports = router
