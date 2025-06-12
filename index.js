console.log('Fichier index.js exécuté')

const express = require('express')
const cors = require('cors')
const dotenv = require('dotenv')
const path = require('path')

dotenv.config()

// ─── Import des routes ─────────────────────────────────────────────

const authRoutes = require('./src/routes/authRoutes.js')
const profileRoutes = require('./src/routes/profile.js')
const adminRoutes = require('./src/routes/admin')

const app = express()

// ─── Middlewares globaux ───────────────────────────────────────────

app.use(cors({
  origin: ['http://localhost:5173', 'https://loic-frontend.vercel.app'],
  credentials: true,
}))


app.use(express.json())
app.use('/uploads', express.static(path.join(__dirname, 'uploads')))

// ─── Routes API ─────────────────────────────────────────────────────

app.use('/api/auth', authRoutes)
app.use('/api/profile', profileRoutes)
app.use('/api/admin', adminRoutes)

// ─── Routes de test/debug ──────────────────────────────────────────

app.get('/test', (req, res) => {
  console.log('/test appelé')
  res.send('ok')
})

app.get('/', (req, res) => {
  res.send('API Loïc en ligne')
})

// ─── Gestion globale des erreurs ───────────────────────────────────

app.use((err, req, res, next) => {
  console.error('Erreur serveur :', err.stack)
  res.status(500).send('Erreur interne du serveur')
})

// ─── Lancement du serveur ──────────────────────────────────────────

const PORT = process.env.PORT || 4000
app.listen(PORT, () => {
  console.log(`Serveur démarré sur http://localhost:${PORT}`)
})
