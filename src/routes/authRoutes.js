const express = require('express')
const { signup, confirmEmail, login, me } = require('../controllers/authController')
const authenticate = require('../middlewares/authMiddleware')  // <-- la fonction

const router = express.Router()

router.post('/signup', signup)
router.get('/confirm-email', confirmEmail)
router.post('/login', login)
router.get('/me', authenticate, me)

module.exports = router
