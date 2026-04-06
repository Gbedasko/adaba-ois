const express = require('express');
const router  = express.Router();
const db      = require('../db');

router.get('/', async (req, res) => {
  const result = await db.query(
    `SELECT o.*, r.body AS source_message
     FROM orders o
     LEFT JOIN raw_messages r ON o.raw_message_id = r.id
     ORDER BY o.created_at DESC LIMIT 100`
  );
  res.json(result.rows);
});

module.exports = router;
