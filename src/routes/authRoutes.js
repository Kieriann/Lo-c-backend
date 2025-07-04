const express = require('express')
const { signup, confirmEmail, login, me, resetPassword } = require('../controllers/authController')
const authMiddleware  = require('../middlewares/authMiddleware')

const router = express.Router()

router.post('/signup', signup)
router.get('/confirm-email', confirmEmail)
router.post('/login', login)
router.post('/reset-password', resetPassword)
router.get('/me', authMiddleware, me)
router.post('/delete-user', deleteUser)



module.exports = router