const express = require('express');
const router = express.Router();

router.get('/health', (req, res) => {
  res.json({ message: 'publicRoutes working' });
});

module.exports = router;
