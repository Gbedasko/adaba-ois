const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const pool = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

// Auto-run schema on startup
async function initDb() {
  try {
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    await pool.query(schema);
    console.log('Database schema initialized');
  } catch (err) {
    console.error('Schema init error:', err.message);
  }
}
initDb();

app.get('/health', (req, res) => res.json({ status: 'ok' }));

const webhookRoutes = require('./routes/webhook');
const dashboardRoutes = require('./routes/dashboard');
const ordersRoutes = require('./routes/orders');
const remittancesRoutes = require('./routes/remittances');

app.use('/webhook', webhookRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/remittances', remittancesRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Adaba OIS backend running on port ${PORT}`));
