console.log('Fichier index.js exécuté')

const express = require('express')
const cors = require('cors')
const dotenv = require('dotenv')
const path = require('path')

dotenv.config()

// ─── Création de l'app Express ───────────────────────────────────────
const app = express()

// ─── Health check ────────────────────────────────────────────────────
app.get('/healthz', (_req, res) => {
  res.status(200).send('OK')
})

// ─── CORS ────────────────────────────────────────────────────────────
app.use(cors({
  origin: 'https://freesbiz.fr',
  credentials: true,
}))

// ─── Middlewares globaux ─────────────────────────────────────────────
app.use(express.json())

// ─── Import des routes ───────────────────────────────────────────────
const authRoutes    = require('./src/routes/authRoutes.js')
const profileRoutes = require('./src/routes/profile.js')
const adminRoutes   = require('./src/routes/admin')
const documentRoutes = require('./src/routes/documentRoutes')
const realisationRoutes = require('./src/routes/realisations')


// ─── Routes API ──────────────────────────────────────────────────────
app.use('/api/auth',    authRoutes)
app.use('/api/profile', profileRoutes)
app.use('/api/admin',   adminRoutes)
app.use('/api/documents', documentRoutes)
app.use('/api/realisations', realisationRoutes)


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
