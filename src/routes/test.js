const { Router } = require('express');

const router = Router();

router.get('/', (req, res) => {
  res.json({ message: '✅ Test route ok' });
});

module.exports = router;
