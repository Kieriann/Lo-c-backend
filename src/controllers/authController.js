const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const prisma = require('../utils/prismaClient');

async function signup(req, res) {
  console.log('📨 Requête reçue dans signup :', req.body);
  console.log('📦 Contenu reçu dans req.body =', req.body);

  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email et mot de passe requis' });
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return res.status(409).json({ error: 'Email déjà utilisé' });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const username = email.split('@')[0];

  const user = await prisma.user.create({
    data: {
      email,
      username,
      password: hashedPassword,
    },
  });

  console.log('🧪 User créé :', user);

const token = jwt.sign(
  { userId: user.id, isAdmin: user.isAdmin },
  process.env.JWT_SECRET,
  { expiresIn: '7d' }
);

  console.log('🎫 Token généré avec userId :', user.id);

  res.json({ token, user: { id: user.id, email: user.email } });
}

async function login(req, res) {
  console.log('📨 Requête reçue dans login :', req.body);

  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email et mot de passe requis' });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return res.status(404).json({ error: 'Utilisateur non trouvé' });
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    return res.status(401).json({ error: 'Mot de passe incorrect' });
  }

  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
    expiresIn: '7d',
  });

  res.json({ token, user: { id: user.id, email: user.email } });
}

async function me(req, res) {
  console.log('📨 /me userId =', req.user.id);

  if (!req.user.id) {
    return res.status(401).json({ error: 'Utilisateur non authentifié' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, email: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    res.json(user);
  } catch (err) {
    console.log('❌ Erreur dans la fonction me :', err);
    res.status(500).json({ error: 'Erreur interne' });
  }
}



module.exports = { signup, login, me };
