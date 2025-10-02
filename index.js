
const express = require('express')
const cors = require('cors')
const dotenv = require('dotenv')
const path = require('path')

dotenv.config()
if (!process.env.JWT_SECRET) {
  console.warn('⚠️ JWT_SECRET manquant dans .env')
}


// ─── Création de l'app Express ───────────────────────────────────────
const app = express()
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



// ─── Routes API ──────────────────────────────────────────────────────
app.use('/api/auth',    authRoutes)
app.use('/api/profile', profileRoutes)
app.use('/api/admin',   adminRoutes)
app.use('/api/documents', documentRoutes)
app.use('/api/realisations', realisationRoutes);
app.use('/api/forgot-password', forgotPasswordRoutes)
app.use('/api/reset-password', resetPasswordRoutes)
app.use('/api/sponsor', require('./src/routes/sponsor'))
app.use('/api/client/requests', clientRequestsRouter)
app.use('/api/cities', citiesRouter)
app.use('/api/messages', messageRoutes)
app.use('/api/client/profile', clientProfileRouter)
app.use('/api/suggestions', suggestionsRouter)
app.use('/api/client/requests', require('./src/routes/clientRequests'))
app.use('/api/service-requests', serviceRequestRouter)
app.use('/api/shortlist', require('./src/routes/shortlist.js'))

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

// ─── Lancement du serveur ────────────────────────────────────────────
const PORT = process.env.PORT || 4000
app.listen(PORT, () => {
  console.log(`Serveur démarré sur http://localhost:${PORT}`)
})
