const router = require('express').Router()
const prisma = require('../utils/prismaClient')
const requireAuth = require('../middlewares/authMiddleware')

// utilitaire: récupérer io
const getIO = (req) => req.app.get('io')

// génère un tag anonyme unique (entier) — simple et efficace
async function generateUniqueAnonymousTag() {
  while (true) {
    const tag = Math.floor(100 + Math.random() * 9899) // 100..9999
    const exists = await prisma.forumUser.findUnique({ where: { anonymousTag: tag } })
    if (!exists) return tag
  }
}

// assure qu’un ForumUser existe pour l’utilisateur connecté
async function ensureForumUser(userId) {
  let fu = await prisma.forumUser.findFirst({ where: { userId } })
  if (!fu) {
    fu = await prisma.forumUser.create({
      data: {
        userId,
        anonymousTag: await generateUniqueAnonymousTag(),
      }
    })
  }
  return fu
}

// ── Moi (forum) ───────────────────────────────────────────
// retourne le ForumUser (crée si absent)
router.get('/me', requireAuth, async (req, res) => {
  try {
    const fu = await ensureForumUser(req.user.id)
    res.json(fu)
  } catch (e) {
    res.status(500).json({ error: 'FORUM_ME_FAILED' })
  }
})

// ── Threads : liste paginée ───────────────────────────────
router.get('/threads', requireAuth, async (req, res) => {
  try {
    const take = parseInt(req.query.take || '20', 10)
    const threads = await prisma.thread.findMany({
      orderBy: { createdAt: 'desc' },
      take,
      include: {
        author: true,
        _count: { select: { replies: true } }
      }
    })
    res.json(threads)
  } catch (e) {
    res.status(500).json({ error: 'THREAD_LIST_FAILED' })
  }
})

// ── Thread : création ─────────────────────────────────────
router.post('/threads', requireAuth, async (req, res) => {
  try {
    const { title, content } = req.body || {}
    const forumUser = await ensureForumUser(req.user.id)
    const thread = await prisma.thread.create({
      data: {
        title,
        content,
        authorId: forumUser.id
      },
      include: { author: true }
    })
    getIO(req).emit('thread:new', thread)
    res.json(thread)
  } catch (e) {
    res.status(500).json({ error: 'THREAD_CREATE_FAILED' })
  }
})

// ── Thread : détails + réponses ───────────────────────────
router.get('/threads/:id', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10)
    const thread = await prisma.thread.findUnique({
      where: { id },
      include: {
        author: true,
        replies: {
          orderBy: { createdAt: 'asc' },
          include: { author: true }
        }
      }
    })
    if (!thread) return res.status(404).json({ error: 'NOT_FOUND' })
    res.json(thread)
  } catch (e) {
    res.status(500).json({ error: 'THREAD_GET_FAILED' })
  }
})

// ── Réponse : création ────────────────────────────────────
router.post('/threads/:id/replies', requireAuth, async (req, res) => {
  try {
    const threadId = parseInt(req.params.id, 10)
    const { content } = req.body || {}
    const forumUser = await ensureForumUser(req.user.id)

    // vérifie que le thread existe
    const th = await prisma.thread.findUnique({ where: { id: threadId } })
    if (!th) return res.status(404).json({ error: 'THREAD_NOT_FOUND' })

    const reply = await prisma.reply.create({
      data: {
        content,
        authorId: forumUser.id,
        threadId
      },
      include: { author: true, thread: true }
    })

    // event spécifique au thread
    getIO(req).to(`thread:${threadId}`).emit('reply:new', reply)
    res.json(reply)
  } catch (e) {
    res.status(500).json({ error: 'REPLY_CREATE_FAILED' })
  }
})

// ── Socket.io rooms par thread ────────────────────────────
// NB: on expose un endpoint pour rejoindre une room via HTTP + handshake socket côté front
router.post('/threads/:id/subscribe', requireAuth, async (req, res) => {
  try {
    // rien à faire côté HTTP; l’inscription à la room se fait côté socket
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: 'SUBSCRIBE_FAILED' })
  }
})
router.put('/me/avatar', requireAuth, async (req, res) => {
  try {
    const { url } = req.body || {}
    const fu = await ensureForumUser(req.user.id)
    const updated = await prisma.forumUser.update({
      where: { id: fu.id },
      data: { avatarUrl: url }
    })
    res.json(updated)
  } catch (e) {
    res.status(500).json({ error: 'FORUM_AVATAR_UPDATE_FAILED' })
  }
})

module.exports = router
