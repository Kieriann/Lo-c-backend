const router = require('express').Router()
const prisma = require('../utils/prismaClient')
const requireAuth = require('../middlewares/authMiddleware')
const rateLimit = require('../middlewares/rateLimit')
const { cleanText, positiveInt } = require('../utils/security')

const writeLimit = rateLimit({ windowMs: 60 * 1000, max: 12, name: 'forum-write' })


// utilitaire: récupérer io
const getIO = (req) => req.app.get('io')

// ── Helpers SQL ───────────────────────────────────────────
async function getForumUserByUserId(userId) {
  const rows = await prisma.$queryRaw`
    SELECT * FROM "ForumUser" WHERE "userId" = ${userId} LIMIT 1
  `
  return rows[0] || null
}

async function getForumUserByTag(tag) {
  const rows = await prisma.$queryRaw`
    SELECT * FROM "ForumUser" WHERE "anonymousTag" = ${tag} LIMIT 1
  `
  return rows[0] || null
}

async function createForumUser(userId, anonymousTag) {
  const rows = await prisma.$queryRaw`
    INSERT INTO "ForumUser" ("userId", "anonymousTag")
    VALUES (${userId}, ${anonymousTag})
    RETURNING *
  `
  return rows[0]
}

// génère un tag anonyme unique (entier)
async function generateUniqueAnonymousTag() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const tag = Math.floor(100 + Math.random() * 9899)
    const exists = await getForumUserByTag(tag)
    if (!exists) return tag
  }
  throw new Error('ANONYMOUS_TAG_EXHAUSTED')
}

// assure qu’un ForumUser existe pour l’utilisateur connecté
async function ensureForumUser(userId) {
  let fu = await getForumUserByUserId(userId)
  if (!fu) {
    const tag = await generateUniqueAnonymousTag()
    fu = await createForumUser(userId, tag)
  }
  return fu
}

// ── Listing groupes ───────────────────────────────────────
router.get('/groups', requireAuth, async (req, res) => {
  try {
    const rows = await prisma.$queryRaw`
      SELECT "group", COUNT(*)::int AS count
      FROM "Thread"
      GROUP BY "group"
      ORDER BY "group" ASC
    `
    res.json(rows.map(r => ({ name: r.group, count: r.count })))
  } catch (e) {
    console.error('FORUM /groups error:', e)
    res.status(500).json({ error: 'GROUP_LIST_FAILED' })
  }
})


// ── Moi (forum) ───────────────────────────────────────────
router.get('/me', requireAuth, async (req, res) => {
  try {
    const fu = await ensureForumUser(req.user.id)
    res.json(fu)
  } catch (e) {
    console.error('FORUM /me error:', e)
    res.status(500).json({ error: 'FORUM_ME_FAILED' })
  }
})

// ── Threads : liste paginée ───────────────────────────────
router.get('/threads', requireAuth, async (req, res) => {
  try {
    const group = cleanText(req.query.group || 'general', { max: 50 })
    const take = positiveInt(req.query.take, { min: 1, max: 100, fallback: 20 })
    if (!/^[\p{L}\p{N}_-]+$/u.test(group)) return res.status(400).json({ error: 'INVALID_GROUP' })
    const rows = await prisma.$queryRaw`
      SELECT
        t.id, t.title, t.content, t."group", t."createdAt", t."authorId", t.views,
        fu."anonymousTag" AS "authorAnonymousTag",
        COALESCE((
          SELECT COUNT(*)::int FROM "Reply" r WHERE r."threadId" = t.id
        ), 0) AS "repliesCount"
      FROM "Thread" t
      JOIN "ForumUser" fu ON fu.id = t."authorId"
      WHERE t."group" = ${group}
      ORDER BY t."createdAt" DESC
      LIMIT ${take}
    `
    const threads = rows.map(r => ({
      id: r.id,
      title: r.title,
      content: r.content,
      group: r.group,
      createdAt: r.createdAt,
      authorId: r.authorId,
      author: { anonymousTag: r.authorAnonymousTag },
      _count: { replies: r.repliesCount }
    }))
    res.json(threads)
  } catch (e) {
    console.error('FORUM /threads error:', e)
    res.status(500).json({ error: 'THREAD_LIST_FAILED' })
  }
})

// ── Thread : création ─────────────────────────────────────
router.post('/threads', requireAuth, writeLimit, async (req, res) => {
  try {
    const title = cleanText(req.body?.title, { max: 150 })
    const content = cleanText(req.body?.content, { max: 10000 })
    const group = cleanText(req.body?.group || 'general', { max: 50 })
    if (!title || !content || !/^[\p{L}\p{N}_-]+$/u.test(group)) {
      return res.status(400).json({ error: 'MISSING_FIELDS' })
    }
    const fu = await ensureForumUser(req.user.id)
    const rows = await prisma.$queryRaw`
      INSERT INTO "Thread" ("title","content","authorId","group")
      VALUES (${title}, ${content}, ${fu.id}, ${group})
      RETURNING id, title, content, "group", "createdAt", "authorId"
    `
    const th = rows[0]
    const authorRow = await prisma.$queryRaw`
      SELECT "anonymousTag" FROM "ForumUser" WHERE id = ${th.authorId} LIMIT 1
    `
    const thread = {
      ...th,
      author: { anonymousTag: authorRow[0]?.anonymousTag || null }
    }
    const io = getIO(req)
    if (io) io.emit('thread:new', thread)
    res.json(thread)
  } catch (e) {
    console.error('FORUM create thread error:', e)
    res.status(500).json({ error: 'THREAD_CREATE_FAILED' })
  }
})

// ── Thread : détails + réponses ───────────────────────────
router.get('/threads/:id', requireAuth, async (req, res) => {
  try {
    const id = positiveInt(req.params.id, { min: 1 })
    if (!id) return res.status(400).json({ error: 'INVALID_ID' })

    await prisma.$executeRaw`UPDATE "Thread" SET views = COALESCE(views,0) + 1 WHERE id = ${id}`


    const thrRows = await prisma.$queryRaw`
      SELECT
        t.id, t.title, t.content, t."group", t."createdAt", t."authorId", t.views,
        fu."anonymousTag" AS "authorAnonymousTag"
      FROM "Thread" t
      JOIN "ForumUser" fu ON fu.id = t."authorId"
      WHERE t.id = ${id}
      LIMIT 1
    `
    const th = thrRows[0]
    if (!th) return res.status(404).json({ error: 'NOT_FOUND' })

    const repRows = await prisma.$queryRaw`
      SELECT
        r.id, r.content, r."createdAt", r."authorId", r."threadId",
        fu."anonymousTag" AS "authorAnonymousTag"
      FROM "Reply" r
      JOIN "ForumUser" fu ON fu.id = r."authorId"
      WHERE r."threadId" = ${id}
      ORDER BY r."createdAt" ASC
    `
    const thread = {
      id: th.id,
      title: th.title,
      content: th.content,
      group: th.group,
      createdAt: th.createdAt,
      authorId: th.authorId,
      author: { anonymousTag: th.authorAnonymousTag },
      replies: repRows.map(r => ({
        id: r.id,
        content: r.content,
        createdAt: r.createdAt,
        authorId: r.authorId,
        threadId: r.threadId,
        author: { anonymousTag: r.authorAnonymousTag }
      }))
    }
    res.json(thread)
  } catch (e) {
    console.error('FORUM get thread error:', e)
    res.status(500).json({ error: 'THREAD_GET_FAILED' })
  }
})

// ── Réponse : création ────────────────────────────────────
router.post('/threads/:id/replies', requireAuth, writeLimit, async (req, res) => {
  try {
    const threadId = positiveInt(req.params.id, { min: 1 })
    const content = cleanText(req.body?.content, { max: 10000 })
    if (!threadId || !content) return res.status(400).json({ error: 'MISSING_CONTENT' })

    const fu = await ensureForumUser(req.user.id)

    const exists = await prisma.$queryRaw`
      SELECT 1 FROM "Thread" WHERE id = ${threadId} LIMIT 1
    `
    if (!exists[0]) return res.status(404).json({ error: 'THREAD_NOT_FOUND' })

    const rows = await prisma.$queryRaw`
      INSERT INTO "Reply" ("content","authorId","threadId")
      VALUES (${content}, ${fu.id}, ${threadId})
      RETURNING id, content, "createdAt", "authorId", "threadId"
    `
    const r = rows[0]
    const authorRow = await prisma.$queryRaw`
      SELECT "anonymousTag" FROM "ForumUser" WHERE id = ${r.authorId} LIMIT 1
    `
    const reply = {
      ...r,
      author: { anonymousTag: authorRow[0]?.anonymousTag || null }
    }

  const io = getIO(req)
  if (io) io.to(`thread:${threadId}`).emit('reply:new', reply)
    res.json(reply)
  } catch (e) {
    console.error('FORUM create reply error:', e)
    res.status(500).json({ error: 'REPLY_CREATE_FAILED' })
  }
})

// ── Avatar update ─────────────────────────────────────────
router.put('/me/avatar', requireAuth, async (req, res) => {
  try {
    const url = cleanText(req.body?.url, { max: 200 })
    if (url && !/^\/avatars\/[a-zA-Z0-9._-]+\.(png|jpe?g)$/i.test(url)) {
      return res.status(400).json({ error: 'INVALID_AVATAR' })
    }
    const fu = await ensureForumUser(req.user.id)
    const rows = await prisma.$queryRaw`
      UPDATE "ForumUser"
      SET "avatarUrl" = ${url || null}
      WHERE id = ${fu.id}
      RETURNING *
    `
    res.json(rows[0])
  } catch (e) {
    console.error('FORUM avatar update error:', e)
    res.status(500).json({ error: 'FORUM_AVATAR_UPDATE_FAILED' })
  }
})

// DELETE fil
router.delete('/threads/:id', requireAuth, async (req, res) => {
  const id = positiveInt(req.params.id, { min: 1 })
  if (!id) return res.status(400).json({ error: 'INVALID_ID' })

  const thrRows = await prisma.$queryRaw`
    SELECT id, "authorId" FROM "Thread" WHERE id = ${id} LIMIT 1
  `
  const thread = thrRows[0]
  if (!thread) return res.sendStatus(404)

  const fu = await ensureForumUser(req.user.id)
  if (thread.authorId !== fu.id) return res.sendStatus(403)

  await prisma.$transaction([
    prisma.$executeRaw`DELETE FROM "Reply"  WHERE "threadId" = ${id}`,
    prisma.$executeRaw`DELETE FROM "Thread" WHERE id = ${id}`,
  ])
  return res.sendStatus(204)
})

// DELETE réponse
router.delete('/reply/:id', requireAuth, async (req, res) => {
  const id = positiveInt(req.params.id, { min: 1 })
  if (!id) return res.status(400).json({ error: 'INVALID_ID' })

  const repRows = await prisma.$queryRaw`
    SELECT id, "authorId" FROM "Reply" WHERE id = ${id} LIMIT 1
  `
  const reply = repRows[0]
  if (!reply) return res.sendStatus(404)

  const fu = await ensureForumUser(req.user.id)
  if (reply.authorId !== fu.id) return res.sendStatus(403)

  await prisma.$executeRaw`DELETE FROM "Reply" WHERE id = ${id}`
  return res.sendStatus(204)
})


module.exports = router
