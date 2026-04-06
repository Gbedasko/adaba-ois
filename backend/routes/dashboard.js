const express = require('express');
const router  = express.Router();
const db      = require('../db');

router.get('/summary', async (req, res) => {
  const [orders, remittances, deliveries, messages] = await Promise.all([
    db.query(`SELECT COUNT(*) AS total,
                COUNT(*) FILTER (WHERE order_status='DELIVERED') AS delivered,
                COUNT(*) FILTER (WHERE order_status='PENDING')   AS pending
              FROM orders`),
    db.query(`SELECT COALESCE(SUM(reported_amount),0) AS total FROM remittances`),
    db.query(`SELECT COUNT(*) FILTER (WHERE event_type='delivered') AS delivered,
                     COUNT(*) FILTER (WHERE event_type='failed')    AS failed
              FROM delivery_events`),
    db.query(`SELECT COUNT(*) AS total FROM raw_messages
              WHERE received_at > NOW() - INTERVAL '24h'`)
  ]);

  res.json({
    orders:         orders.rows[0],
    remittances:    remittances.rows[0],
    deliveries:     deliveries.rows[0],
    messages_today: messages.rows[0].total
  });
});

module.exports = router;
