const express = require('express');
const router  = express.Router();
const db      = require('../db');
const { detectIntent } = require('../services/intentRouter');
const { extract }      = require('../services/extractor');

router.get('/', (req, res) => {
  const mode      = req.query['hub.mode'];
  const token     = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
});

router.post('/', async (req, res) => {
  res.sendStatus(200);
  try {
    const entry   = req.body?.entry?.[0];
    const changes = entry?.changes?.[0]?.value;
    const msg     = changes?.messages?.[0];
    if (!msg || msg.type !== 'text') return;

    const body       = msg.text.body;
    const senderName = changes.contacts?.[0]?.profile?.name || msg.from;
    const groupName  = changes.metadata?.display_phone_number || 'Unknown Group';

    const intent     = detectIntent(body);

    const rawResult = await db.query(
      `INSERT INTO raw_messages (group_name, sender_name, body, intent)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [groupName, senderName, body, intent]
    );
    const rawId = rawResult.rows[0].id;

    if (intent === 'noise' || intent === 'unknown') return;

    const data = await extract(intent, body, groupName, senderName);
    if (!data) return;

    if (intent === 'order') {
      await db.query(
        `INSERT INTO orders
          (customer_name, customer_phone, product, quantity, selling_price, state, csr_name, raw_message_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [data.customer_name, data.customer_phone, data.product,
         data.quantity, data.selling_price, data.state, data.csr_name, rawId]
      );
    }

    if (intent === 'remittance') {
      await db.query(
        `INSERT INTO remittances
          (sender_name, reported_amount, state, payment_method, batch_ref, raw_message_id)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [data.sender_name, data.reported_amount, data.state,
         data.payment_method, data.batch_ref, rawId]
      );
    }

    if (intent === 'delivery') {
      await db.query(
        `INSERT INTO delivery_events
          (event_type, logistics_partner, failure_reason, raw_message_id)
         VALUES ($1,$2,$3,$4)`,
        [data.event_type, data.logistics_partner, data.failure_reason, rawId]
      );
    }

  } catch (err) {
    console.error('Webhook error:', err.message);
  }
});

module.exports = router;
