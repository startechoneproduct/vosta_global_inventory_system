const express = require('express');
const { getExchangeRate } = require('../utils/exchangeRate');

const router = express.Router();

// Not sensitive data and needed before login (currency can be previewed
// pre-auth), so this endpoint is intentionally public - no verifyToken.
router.get('/', (req, res) => {
  const { rate, updatedAt, source } = getExchangeRate();
  res.json({ success: true, data: { rate, updatedAt, source } });
});

module.exports = router;
