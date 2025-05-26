console.log('Fichier index.js exécuté');

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const testRoutes = require('./src/routes/test.js');
const authRoutes = require('./src/routes/authRoutes.js');
const profileRoutes = require('./src/routes/profile.js');
const adminRoutes = require('./src/routes/admin')



const app = express();

app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true,
}));


app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/test', testRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/admin', adminRoutes);


app.get('/test', (req, res) => {
  console.log('✅ /test appelé');
  res.send('ok');
});

app.get('/', (req, res) => {
  res.send('API Loïc en ligne ✅');
});

app.use((err, req, res, next) => {
  console.error('🔥 Erreur serveur :', err.stack);
  res.status(500).send('Erreur interne du serveur');
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`);
});
