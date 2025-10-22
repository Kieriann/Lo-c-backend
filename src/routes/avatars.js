const router = require('express').Router()
const fs = require('fs')
const path = require('path')

router.get('/', (req, res) => {
  const dir = path.join(__dirname, '..', 'public', 'avatars')
  const files = (fs.existsSync(dir) ? fs.readdirSync(dir) : []).filter(f => f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.jpeg'))
  res.json(files.map(f => `/avatars/${f}`))
})

module.exports = router
