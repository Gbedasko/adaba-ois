const express = require('express');
const router  = express.Router();
const db      = require('../db');

router.get('/', async (req, res) => {
  const result = await db.query(
    `SELECT r.*, m.body AS source_message
     FROM remittances r
     LEFT JOIN raw_messages m ON r.raw_message_id = m.id
     ORDER BY r.created_at DESC LIMIT 100`
  );
  res.json(result.rows);
});

module.exports = router;
