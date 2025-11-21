
const express = require('express')
const cors = require('cors')
const dotenv = require('dotenv')
const app = express()

dotenv.config()
if (!process.env.JWT_SECRET) {
  console.warn('⚠️ JWT_SECRET manquant dans .env')
}


// ─── Création de l'app Express ───────────────────────────────────────
app.get('/db-ping', async (_req, res) => {
  try {
    await require('./src/utils/prismaClient').$queryRaw`SELECT 1`
    res.json({ ok: true })
  } catch (e) {
    console.error('DB PING ERROR:', e)
    res.status(500).json({ ok: false, error: e.code || e.message })
  }
})


// ─── Health check ────────────────────────────────────────────────────
app.get('/healthz', (_req, res) => {
  res.status(200).send('OK')
})

// ─── CORS ────────────────────────────────────────────────────────────
app.use(cors({
  origin: (origin, callback) => {
    const allowed = [
      'https://freesbiz.fr',
      'https://loic-frontend.vercel.app',
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://localhost:4173',     
      'http://127.0.0.1:4173'
    ]
    const isVercelPreview = /^https:\/\/loic-frontend-[\w-]+\.vercel\.app$/.test(origin || '')

    if (!origin || allowed.includes(origin) || isVercelPreview) {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'))
    }
  },
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
  optionsSuccessStatus: 204
}))



// ─── Middlewares globaux ─────────────────────────────────────────────
app.use(express.json())

// ─── Import des routes ───────────────────────────────────────────────
const authRoutes    = require('./src/routes/authRoutes.js')
const authenticate = require('./src/middlewares/authMiddleware')
const forgotPasswordRoutes = require('./src/routes/forgotPassword')
const profileRoutes = require('./src/routes/profile.js')
const adminRoutes   = require('./src/routes/admin')
const documentRoutes = require('./src/routes/documentRoutes')
const resetPasswordRoutes = require('./src/routes/resetPassword')
const realisationRoutes = require('./src/routes/realisations');
const clientRequestsRouter = require('./src/routes/clientRequests.js')
const citiesRouter = require('./src/routes/cities.js')
const messageRoutes = require('./src/routes/message.js')
const clientProfileRouter = require('./src/routes/clientProfile')
const suggestionsRouter = require('./src/routes/suggestions')
const serviceRequestRouter = require('./src/routes/serviceRequest')
const clientSavedSearchesRouter = require('./src/routes/clientSavedSearches')




// ─── Routes API ──────────────────────────────────────────────────────
app.use('/api/auth', authRoutes)
app.use('/api/forgot-password', forgotPasswordRoutes)
app.use('/api/reset-password', resetPasswordRoutes)
app.use('/api/cities', citiesRouter)

app.use('/api/profile', authenticate, profileRoutes)
app.use('/api/admin', authenticate, adminRoutes)
app.use('/api/documents', authenticate, documentRoutes)
app.use('/api/realisations', authenticate, realisationRoutes)
app.use('/api/sponsor', authenticate, require('./src/routes/sponsor'))
app.use('/api/client/requests', authenticate, clientRequestsRouter)
app.use('/api/messages', authenticate, messageRoutes)
app.use('/api/client/profile', authenticate, clientProfileRouter)
app.use('/api/suggestions', authenticate, suggestionsRouter)
app.use('/api/service-requests', authenticate, serviceRequestRouter)
app.use('/api/shortlist', authenticate, require('./src/routes/shortlist.js'))
app.use('/api/forum', authenticate, require('./src/routes/forum'))
app.use('/api/avatars', authenticate, require('./src/routes/avatars'))
app.use('/api/client-saved-searches', authenticate, clientSavedSearchesRouter)


app.use('/avatars', express.static(require('path').join(__dirname, 'public', 'avatars')))


// ─── Routes de test/debug ───────────────────────────────────────────
app.get('/test', (req, res) => {
  console.log('/test appelé')
  res.send('ok')
})

app.get('/', (req, res) => {
  res.send('API Loïc en ligne')
})

// ─── Gestion globale des erreurs ────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('💥 Erreur serveur :', err.stack)
  res
    .status(500)
    .json({ error: err.message, stack: err.stack.split('\n').slice(0,5) })
})
// ── Socket.io + lancement serveur ────────────────────────────────────
const http = require('http')
const { Server } = require('socket.io')
const server = http.createServer(app)
const io = new Server(server, {
  cors: { origin: ['http://localhost:5173'], credentials: true }
})
app.set('io', io)
io.on('connection', (socket) => {
  socket.on('join',  ({ room }) => socket.join(room))
  socket.on('leave', ({ room }) => socket.leave(room))
})

const PORT = process.env.PORT || 4000
server.listen(PORT, () => {
  console.log(`Serveur démarré sur http://localhost:${PORT}`)
})
