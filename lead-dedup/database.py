import psycopg2
import os
from datetime import datetime, timedelta

def get_connection():
    """Get database connection using DATABASE_URL env variable."""
    db_url = os.environ.get('DATABASE_URL')
    if not db_url:
        raise ValueError("DATABASE_URL environment variable not set")
    return psycopg2.connect(db_url)

def init_db():
    """Create all required tables if they don't exist."""
    conn = get_connection()
    cur = conn.cursor()
    
    cur.execute("""
        CREATE TABLE IF NOT EXISTS lead_csrs (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            telegram_chat_id TEXT NOT NULL UNIQUE,
            total_assigned INTEGER DEFAULT 0,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );
    """)
    
    cur.execute("""
        CREATE TABLE IF NOT EXISTS lead_orders (
            id SERIAL PRIMARY KEY,
            gmail_message_id TEXT UNIQUE NOT NULL,
            ad_buyer TEXT,
            product TEXT,
            customer_name TEXT,
            customer_phone TEXT,
            customer_email TEXT,
            raw_body TEXT,
            csr_id INTEGER REFERENCES lead_csrs(id),
            csr_name TEXT,
            received_at TIMESTAMPTZ DEFAULT NOW(),
            distributed_at TIMESTAMPTZ,
            is_duplicate BOOLEAN DEFAULT FALSE
        );
    """)
    
    cur.execute("""
        CREATE TABLE IF NOT EXISTS lead_deleted_duplicates (
            id SERIAL PRIMARY KEY,
            gmail_message_id TEXT NOT NULL,
            ad_buyer TEXT,
            product TEXT,
            customer_name TEXT,
            customer_phone TEXT,
            customer_email TEXT,
            original_order_id INTEGER REFERENCES lead_orders(id),
            original_received_at TIMESTAMPTZ,
            duplicate_received_at TIMESTAMPTZ DEFAULT NOW(),
            hours_since_original NUMERIC(6,2),
            reason TEXT DEFAULT 'Within 72-hour deduplication window'
        );
    """)
    
    conn.commit()
    cur.close()
    conn.close()
    print("[DB] Tables initialized successfully")

def find_existing_order(customer_phone, customer_email):
    """Find an existing order from the same customer within the last 72 hours."""
    conn = get_connection()
    cur = conn.cursor()
    
    cutoff = datetime.utcnow() - timedelta(hours=72)
    
    query = """
        SELECT id, received_at, customer_phone, customer_email
        FROM lead_orders
        WHERE is_duplicate = FALSE
          AND received_at > %s
          AND (
            (customer_phone IS NOT NULL AND customer_phone != '' AND customer_phone = %s)
            OR (customer_email IS NOT NULL AND customer_email != '' AND customer_email = %s)
          )
        ORDER BY received_at DESC
        LIMIT 1;
    """
    cur.execute(query, (cutoff, customer_phone, customer_email))
    row = cur.fetchone()
    cur.close()
    conn.close()
    return row

def insert_order(msg_id, ad_buyer, product, customer_name, customer_phone, customer_email, raw_body):
    """Insert a new unique lead order."""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO lead_orders (gmail_message_id, ad_buyer, product, customer_name, customer_phone, customer_email, raw_body)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        RETURNING id;
    """, (msg_id, ad_buyer, product, customer_name, customer_phone, customer_email, raw_body))
    new_id = cur.fetchone()[0]
    conn.commit()
    cur.close()
    conn.close()
    return new_id

def insert_duplicate(msg_id, ad_buyer, product, customer_name, customer_phone, customer_email, original_row):
    """Log a deleted duplicate."""
    conn = get_connection()
    cur = conn.cursor()
    original_id, original_time = original_row[0], original_row[1]
    hours_diff = (datetime.utcnow() - original_time.replace(tzinfo=None)).total_seconds() / 3600
    cur.execute("""
        INSERT INTO lead_deleted_duplicates
            (gmail_message_id, ad_buyer, product, customer_name, customer_phone, customer_email,
             original_order_id, original_received_at, hours_since_original)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s);
    """, (msg_id, ad_buyer, product, customer_name, customer_phone, customer_email,
          original_id, original_time, round(hours_diff, 2)))
    conn.commit()
    cur.close()
    conn.close()

def assign_csr(order_id):
    """Round-robin: assign to active CSR with fewest total orders."""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
        SELECT id, name, telegram_chat_id FROM lead_csrs
        WHERE is_active = TRUE
        ORDER BY total_assigned ASC, id ASC
        LIMIT 1;
    """)
    csr = cur.fetchone()
    if not csr:
        cur.close()
        conn.close()
        return None
    csr_id, csr_name, csr_chat_id = csr
    cur.execute("UPDATE lead_csrs SET total_assigned = total_assigned + 1 WHERE id = %s;", (csr_id,))
    cur.execute("UPDATE lead_orders SET csr_id = %s, csr_name = %s, distributed_at = NOW() WHERE id = %s;",
                (csr_id, csr_name, order_id))
    conn.commit()
    cur.close()
    conn.close()
    return {'id': csr_id, 'name': csr_name, 'chat_id': csr_chat_id}

def get_report_data(since):
    """Get summary data for reports since a given timestamp."""
    conn = get_connection()
    cur = conn.cursor()
    
    cur.execute("SELECT product, COUNT(*) FROM lead_orders WHERE received_at >= %s AND is_duplicate = FALSE GROUP BY product ORDER BY COUNT(*) DESC;", (since,))
    orders_by_product = cur.fetchall()
    
    cur.execute("SELECT ad_buyer, COUNT(*) FROM lead_orders WHERE received_at >= %s AND is_duplicate = FALSE GROUP BY ad_buyer ORDER BY COUNT(*) DESC;", (since,))
    orders_by_buyer = cur.fetchall()
    
    cur.execute("SELECT csr_name, COUNT(*) FROM lead_orders WHERE received_at >= %s AND is_duplicate = FALSE AND csr_name IS NOT NULL GROUP BY csr_name ORDER BY COUNT(*) DESC;", (since,))
    orders_by_csr = cur.fetchall()
    
    cur.execute("SELECT COUNT(*) FROM lead_deleted_duplicates WHERE duplicate_received_at >= %s;", (since,))
    duplicates_deleted = cur.fetchone()[0]
    
    cur.close()
    conn.close()
    return orders_by_product, orders_by_buyer, orders_by_csr, duplicates_deleted
