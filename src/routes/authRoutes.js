const express = require('express')
const { signup, confirmEmail, login, logout, me, resendConfirmation } = require('../controllers/authController')
const authMiddleware  = require('../middlewares/authMiddleware')
const rateLimit = require('../middlewares/rateLimit')

const router = express.Router()

router.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store')
  next()
})

router.post('/signup', rateLimit({ windowMs: 60 * 60 * 1000, max: 8, name: 'signup' }), signup)
router.post('/resend-confirmation', rateLimit({ windowMs: 60 * 60 * 1000, max: 5, name: 'resend-confirmation' }), resendConfirmation)
router.get('/confirm-email', rateLimit({ windowMs: 15 * 60 * 1000, max: 30, name: 'confirm-email' }), confirmEmail)
router.post('/login', rateLimit({ windowMs: 15 * 60 * 1000, max: 8, name: 'login' }), login)
router.get('/me', authMiddleware, me)
router.post('/logout', authMiddleware, logout)



module.exports = router
