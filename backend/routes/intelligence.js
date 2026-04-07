const express = require('express');
const router  = express.Router();
const db      = require('../db');

// Panel 1: Daily Operations Summary
router.get('/daily-summary', async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date || new Date().toISOString().split('T')[0];

    const [orders, deliveries, remittances, issues] = await Promise.all([
      db.query(`
        SELECT
          COUNT(*)                                            AS total_orders,
          COUNT(*) FILTER (WHERE order_status = 'DELIVERED') AS total_delivered,
          COUNT(*) FILTER (WHERE order_status = 'FAILED')    AS total_failed,
          COUNT(*) FILTER (WHERE order_status = 'PENDING')   AS total_pending,
          COALESCE(SUM(selling_price), 0)                    AS total_revenue,
          COALESCE(SUM(selling_price) FILTER (WHERE order_status = 'FAILED'), 0) AS failed_revenue
        FROM orders
        WHERE DATE(created_at) = $1
      `, [targetDate]),
      db.query(`
        SELECT
          ROUND(
            COUNT(*) FILTER (WHERE order_status = 'DELIVERED')::numeric
            / NULLIF(COUNT(*), 0) * 100, 1
          ) AS delivery_rate
        FROM orders
        WHERE DATE(created_at) = $1
      `, [targetDate]),
      db.query(`
        SELECT COALESCE(SUM(reported_amount), 0) AS total_remitted
        FROM remittances
        WHERE DATE(created_at) = $1
      `, [targetDate]),
      db.query(`
        SELECT COUNT(*) AS total_issues
        FROM issues
        WHERE DATE(created_at) = $1
      `, [targetDate])
    ]);

    res.json({
      date: targetDate,
      orders:        orders.rows[0],
      delivery_rate: deliveries.rows[0].delivery_rate || 0,
      remittances:   remittances.rows[0],
      issues:        issues.rows[0]
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Panel 2: CSR Performance
router.get('/csr-performance', async (req, res) => {
  try {
    const { from, to } = req.query;
    const fromDate = from || new Date(Date.now() - 30*24*60*60*1000).toISOString().split('T')[0];
    const toDate   = to   || new Date().toISOString().split('T')[0];

    const result = await db.query(`
      SELECT
        csr_name,
        COUNT(*)                                              AS total_orders,
        COUNT(*) FILTER (WHERE order_status = 'DELIVERED')   AS delivered,
        COUNT(*) FILTER (WHERE order_status = 'FAILED')      AS failed,
        COALESCE(SUM(selling_price), 0)                      AS total_revenue,
        COALESCE(SUM(selling_price) FILTER (WHERE order_status = 'DELIVERED'), 0) AS delivered_revenue,
        ROUND(
          COUNT(*) FILTER (WHERE order_status = 'DELIVERED')::numeric
          / NULLIF(COUNT(*), 0) * 100, 1
        )                                                     AS delivery_rate
      FROM orders
      WHERE csr_name IS NOT NULL
        AND DATE(created_at) BETWEEN $1 AND $2
      GROUP BY csr_name
      ORDER BY total_orders DESC
    `, [fromDate, toDate]);

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Panel 3: Product Performance
router.get('/product-performance', async (req, res) => {
  try {
    const { from, to } = req.query;
    const fromDate = from || new Date(Date.now() - 30*24*60*60*1000).toISOString().split('T')[0];
    const toDate   = to   || new Date().toISOString().split('T')[0];

    const result = await db.query(`
      SELECT
        product,
        COUNT(*)                                              AS total_orders,
        COUNT(*) FILTER (WHERE order_status = 'DELIVERED')   AS delivered,
        COUNT(*) FILTER (WHERE order_status = 'FAILED')      AS failed,
        COALESCE(SUM(selling_price), 0)                      AS total_revenue,
        ROUND(
          COUNT(*) FILTER (WHERE order_status = 'DELIVERED')::numeric
          / NULLIF(COUNT(*), 0) * 100, 1
        )                                                     AS delivery_rate
      FROM orders
      WHERE product IS NOT NULL
        AND DATE(created_at) BETWEEN $1 AND $2
      GROUP BY product
      ORDER BY total_orders DESC
    `, [fromDate, toDate]);

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Panel 4: Group Performance
router.get('/group-performance', async (req, res) => {
  try {
    const { from, to } = req.query;
    const fromDate = from || new Date(Date.now() - 30*24*60*60*1000).toISOString().split('T')[0];
    const toDate   = to   || new Date().toISOString().split('T')[0];

    const result = await db.query(`
      SELECT
        r.group_name,
        COUNT(o.id)                                              AS total_orders,
        COUNT(o.id) FILTER (WHERE o.order_status = 'DELIVERED') AS delivered,
        COUNT(o.id) FILTER (WHERE o.order_status = 'FAILED')    AS failed,
        COALESCE(SUM(o.selling_price), 0)                       AS total_revenue,
        ROUND(
          COUNT(o.id) FILTER (WHERE o.order_status = 'DELIVERED')::numeric
          / NULLIF(COUNT(o.id), 0) * 100, 1
        )                                                        AS delivery_rate
      FROM orders o
      LEFT JOIN raw_messages r ON o.raw_message_id = r.id
      WHERE DATE(o.created_at) BETWEEN $1 AND $2
      GROUP BY r.group_name
      ORDER BY total_orders DESC
    `, [fromDate, toDate]);

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Panel 5: Revenue Trend
router.get('/revenue-trend', async (req, res) => {
  try {
    const { days } = req.query;
    const numDays = parseInt(days) || 7;

    const result = await db.query(`
      SELECT
        DATE(created_at)                                      AS date,
        COUNT(*)                                              AS total_orders,
        COUNT(*) FILTER (WHERE order_status = 'DELIVERED')   AS delivered,
        COUNT(*) FILTER (WHERE order_status = 'FAILED')      AS failed,
        COALESCE(SUM(selling_price), 0)                      AS total_revenue,
        COALESCE(SUM(selling_price) FILTER (WHERE order_status = 'DELIVERED'), 0) AS delivered_revenue
      FROM orders
      WHERE created_at >= NOW() - ($1 || ' days')::INTERVAL
      GROUP BY DATE(created_at)
      ORDER BY DATE(created_at) ASC
    `, [numDays]);

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Panel 6: Orders with filters + pagination
router.get('/orders', async (req, res) => {
  try {
    const {
      from, to, csr, product, group,
      status, state,
      limit  = 20,
      offset = 0
    } = req.query;

    const fromDate = from || new Date(Date.now() - 7*24*60*60*1000).toISOString().split('T')[0];
    const toDate   = to   || new Date().toISOString().split('T')[0];

    const conditions = ['DATE(o.created_at) BETWEEN $1 AND $2'];
    const params     = [fromDate, toDate];
    let   paramIndex = 3;

    if (csr)     { conditions.push('o.csr_name ILIKE $' + paramIndex++);     params.push('%' + csr + '%'); }
    if (product) { conditions.push('o.product ILIKE $' + paramIndex++);      params.push('%' + product + '%'); }
    if (status)  { conditions.push('o.order_status = $' + paramIndex++);     params.push(status); }
    if (state)   { conditions.push('o.state ILIKE $' + paramIndex++);        params.push('%' + state + '%'); }
    if (group)   { conditions.push('r.group_name ILIKE $' + paramIndex++);   params.push('%' + group + '%'); }

    const whereClause = conditions.join(' AND ');

    const [ordersResult, countResult] = await Promise.all([
      db.query(`
        SELECT o.*, r.body AS source_message, r.group_name
        FROM orders o
        LEFT JOIN raw_messages r ON o.raw_message_id = r.id
        WHERE ${whereClause}
        ORDER BY o.created_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `, [...params, parseInt(limit), parseInt(offset)]),
      db.query(`
        SELECT COUNT(*) AS total
        FROM orders o
        LEFT JOIN raw_messages r ON o.raw_message_id = r.id
        WHERE ${whereClause}
      `, params)
    ]);

    res.json({
      orders: ordersResult.rows,
      total:  parseInt(countResult.rows[0].total),
      limit:  parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Panel 7: Remittance Summary
router.get('/remittance-summary', async (req, res) => {
  try {
    const { from, to } = req.query;
    const fromDate = from || new Date(Date.now() - 30*24*60*60*1000).toISOString().split('T')[0];
    const toDate   = to   || new Date().toISOString().split('T')[0];

    const result = await db.query(`
      SELECT
        sender_name,
        COUNT(*)                         AS total_remittances,
        COALESCE(SUM(reported_amount),0) AS total_amount,
        state
      FROM remittances
      WHERE DATE(created_at) BETWEEN $1 AND $2
      GROUP BY sender_name, state
      ORDER BY total_amount DESC
    `, [fromDate, toDate]);

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
