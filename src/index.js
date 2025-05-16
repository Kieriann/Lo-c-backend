import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import authRoutes from './routes/authRoutes.js'


dotenv.config()

const app = express()
app.use(cors())
app.use(express.json())
app.use('/api/auth', authRoutes)


app.get('/', (req, res) => {
  res.send('API Loïc en ligne ✅')
})

const PORT = process.env.PORT || 4000
app.listen(PORT, () => {
  console.log(`Serveur démarré sur http://localhost:${PORT}`)
})
