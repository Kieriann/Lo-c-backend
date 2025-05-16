import { Router } from 'express'

const router = Router()

router.post('/ping', (req, res) => {
  console.log('✅ POST /ping atteinte')
  res.send('pong')
})

export default router
