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
        receiverId: receiver, // <- utilisation de "receiver" parsé
        content,
      },
    })
    res.json(message)
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de l’envoi du message' })
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
        profile: { select: { workerStatus: true } },
      },
    },
  },
})

    // Marquer comme lus les messages reçus non lus
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

/**
 * Marquer un message comme lu
 */
router.patch('/:id/read', authenticate, async (req, res) => {
  if (!req.user?.id) return res.status(401).json({ error: 'Non authentifié' })

  const messageId = parseInt(req.params.id, 10)
  if (!messageId) return res.status(400).json({ error: 'id invalide' })

  try {
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

module.exports = router
