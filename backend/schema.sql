CREATE TABLE IF NOT EXISTS raw_messages (
  id          SERIAL PRIMARY KEY,
  group_name  TEXT,
  sender_name TEXT,
  body        TEXT NOT NULL,
  intent      TEXT,
  received_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orders (
  id             SERIAL PRIMARY KEY,
  customer_name  TEXT,
  customer_phone TEXT,
  product        TEXT,
  quantity       INT,
  selling_price  NUMERIC(12,2),
  state          TEXT,
  csr_name       TEXT,
  order_status   TEXT DEFAULT 'PENDING',
  raw_message_id INT REFERENCES raw_messages(id),
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS remittances (
  id               SERIAL PRIMARY KEY,
  sender_name      TEXT,
  reported_amount  NUMERIC(14,2),
  state            TEXT,
  payment_method   TEXT,
  batch_ref        TEXT,
  raw_message_id   INT REFERENCES raw_messages(id),
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS delivery_events (
  id                SERIAL PRIMARY KEY,
  order_id          INT REFERENCES orders(id),
  event_type        TEXT,
  logistics_partner TEXT,
  failure_reason    TEXT,
  raw_message_id    INT REFERENCES raw_messages(id),
  created_at        TIMESTAMPTZ DEFAULT NOW()
);
