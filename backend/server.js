require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const app     = express();

app.use(cors());
app.use(express.json());

app.use('/webhook',         require('./routes/webhook'));
app.use('/api/orders',      require('./routes/orders'));
app.use('/api/remittances', require('./routes/remittances'));
app.use('/api/dashboard',   require('./routes/dashboard'));

app.get('/health', (req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Adaba OIS backend running on port ${PORT}`));
