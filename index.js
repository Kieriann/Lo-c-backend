const express = require('express')
const cors = require('cors')
const dotenv = require('dotenv')
const http = require('http')
const path = require('path')
const multer = require('multer')
const { Server } = require('socket.io')

dotenv.config()

if (!process.env.JWT_SECRET || Buffer.byteLength(process.env.JWT_SECRET, 'utf8') < 32) {
  throw new Error('JWT_SECRET doit contenir au moins 32 octets aléatoires')
}

const app = express()
const server = http.createServer(app)
const isProduction = process.env.NODE_ENV === 'production'
const defaultOrigins = [
  'https://freesbiz.fr',
  'https://www.freesbiz.fr',
  'https://loic-frontend.vercel.app',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
]
const allowedOrigins = new Set(
  (process.env.CORS_ORIGINS || defaultOrigins.join(','))
    .split(',')
    .map(value => value.trim())
    .filter(Boolean)
)
const originAllowed = origin => !origin || allowedOrigins.has(origin)

app.disable('x-powered-by')
app.set('trust proxy', 1)

app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
  })
  if (isProduction) res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  next()
})

app.use(cors({
  origin: (origin, callback) => callback(originAllowed(origin) ? null : Object.assign(new Error('CORS_DENIED'), { status: 403 }), originAllowed(origin)),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 204,
}))
app.use(express.json({ limit: '200kb', strict: true }))

app.get('/healthz', (_req, res) => res.status(200).json({ ok: true }))

const authenticate = require('./src/middlewares/authMiddleware')

app.use('/api/auth', require('./src/routes/authRoutes'))
app.use('/api/forgot-password', require('./src/routes/forgotPassword'))
app.use('/api/reset-password', require('./src/routes/resetPassword'))
app.use('/api/cities', require('./src/routes/cities'))
app.use('/api/profile', authenticate, require('./src/routes/profile'))
app.use('/api/admin', authenticate, require('./src/routes/admin'))
app.use('/api/documents', require('./src/routes/documentRoutes'))
app.use('/api/realisations', authenticate, require('./src/routes/realisations'))
app.use('/api/sponsor', authenticate, require('./src/routes/sponsor'))
app.use('/api/client/requests', authenticate, require('./src/routes/clientRequests'))
app.use('/api/messages', authenticate, require('./src/routes/message'))
app.use('/api/client/profile', authenticate, require('./src/routes/clientProfile'))
app.use('/api/suggestions', authenticate, require('./src/routes/suggestions'))
app.use('/api/shortlist', authenticate, require('./src/routes/shortlist'))
app.use('/api/forum', authenticate, require('./src/routes/forum'))
app.use('/api/avatars', authenticate, require('./src/routes/avatars'))
app.use('/api/client-saved-searches', authenticate, require('./src/routes/clientSavedSearches'))
app.use('/avatars', express.static(path.join(__dirname, 'public', 'avatars'), { fallthrough: false, maxAge: '1d' }))

app.get('/', (_req, res) => res.json({ name: 'Freesbiz API', status: 'ok' }))
app.use('/api', (_req, res) => res.status(404).json({ error: 'NOT_FOUND' }))
app.use((_req, res) => res.status(404).json({ error: 'NOT_FOUND' }))

app.use((err, req, res, _next) => {
  const isUploadError = err instanceof multer.MulterError
  const status = isUploadError
    ? (err.code === 'LIMIT_FILE_SIZE' ? 413 : 400)
    : Number.isInteger(err.status) && err.status >= 400 && err.status < 600
      ? err.status
      : 500
  if (status >= 500) {
    console.error(`[${req.method} ${req.originalUrl}]`, isProduction ? err.message : err)
  }
  const message = status === 500
    ? 'Erreur serveur'
    : err.message === 'CORS_DENIED'
      ? 'Accès refusé'
    : isUploadError
      ? 'Fichier refusé ou trop volumineux'
      : err.message || 'Requête invalide'
  res.status(status).json({ error: message })
})

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => callback(originAllowed(origin) ? null : new Error('CORS_DENIED'), originAllowed(origin)),
    credentials: true,
  },
})
app.set('io', io)

if (process.env.INACTIVITY_WARNINGS_ENABLED === 'true') {
  const { startInactivityWarningScheduler } = require('./src/jobs/inactivityWarnings')
  startInactivityWarningScheduler()
}

io.use(async (socket, next) => {
  const authHeader = socket.handshake.headers.authorization || ''
  const token = socket.handshake.auth?.token || (authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null)
  if (!token) return next(new Error('UNAUTHENTICATED'))
  try {
    socket.data.user = await authenticate.verifyAccessToken(token)
    return next()
  } catch {
    return next(new Error('UNAUTHENTICATED'))
  }
})

io.on('connection', socket => {
  socket.on('join', payload => {
    const room = String(payload?.room || '')
    if (/^thread:[1-9]\d*$/.test(room)) socket.join(room)
  })
  socket.on('leave', payload => {
    const room = String(payload?.room || '')
    if (/^thread:[1-9]\d*$/.test(room)) socket.leave(room)
  })
})

const PORT = Number(process.env.PORT) || 4000
server.listen(PORT, () => console.log(`Serveur Freesbiz démarré sur le port ${PORT}`))
