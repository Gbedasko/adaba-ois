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

CREATE TABLE IF NOT EXISTS unknown_messages (
  id            SERIAL PRIMARY KEY,
  raw_message_id INT REFERENCES raw_messages(id),
  body          TEXT NOT NULL,
  sender_name   TEXT,
  group_name    TEXT,
  reason        TEXT,
  status        TEXT DEFAULT 'pending',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS training_rules (
  id            SERIAL PRIMARY KEY,
  rule_type     TEXT NOT NULL,
  pattern       TEXT NOT NULL,
  meaning       TEXT NOT NULL,
  intent        TEXT,
  field         TEXT,
  value         TEXT,
  example_input TEXT,
  added_by      TEXT DEFAULT 'admin',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS extraction_feedback (
  id              SERIAL PRIMARY KEY,
  raw_message_id  INT REFERENCES raw_messages(id),
  original_output JSONB,
  corrected_output JSONB,
  field_corrected TEXT,
  correction_note TEXT,
  added_by        TEXT DEFAULT 'admin',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
