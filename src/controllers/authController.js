import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function signup(req, res) {
  const { email, password } = req.body

  if (!email || !password) {
    return res.status(400).json({ error: 'Email et mot de passe requis' })
  }

  const existingUser = await prisma.user.findUnique({ where: { email } })
  if (existingUser) {
    return res.status(409).json({ error: 'Email déjà utilisé' })
  }

  const hashedPassword = await bcrypt.hash(password, 10)

  const user = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
    },
  })

  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
    expiresIn: '7d',
  })

  res.json({ token, user: { id: user.id, email: user.email } })
}

export async function login(req, res) {
  const { email, password } = req.body

  if (!email || !password) {
    return res.status(400).json({ error: 'Email et mot de passe requis' })
  }

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    return res.status(404).json({ error: 'Utilisateur non trouvé' })
  }

  const isPasswordValid = await bcrypt.compare(password, user.password)
  if (!isPasswordValid) {
    return res.status(401).json({ error: 'Mot de passe incorrect' })
  }

  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
    expiresIn: '7d',
  })

  res.json({ token, user: { id: user.id, email: user.email } })
}

export async function me(req, res) {
  if (!req.userId) {
    return res.status(401).json({ error: 'Utilisateur non authentifié' })
  }

  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { id: true, email: true },
  })

  if (!user) {
    return res.status(404).json({ error: 'Utilisateur non trouvé' })
  }

  res.json(user)
}

