"""
Adaba Lead Deduplication System - Test Script
Run this BEFORE going live to verify all components work correctly.
Usage: python test_system.py
"""
import os
import sys
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

PASS = "✅ PASS"
FAIL = "❌ FAIL"
results = []

def test(name, fn):
    try:
        result = fn()
        status = PASS if result else FAIL
        results.append((name, status, ''))
        print(f"{status} {name}")
        return result
    except Exception as e:
        results.append((name, FAIL, str(e)))
        print(f"{FAIL} {name}: {e}")
        return False

# ────────────────────────────────────────────
print("\n" + "="*50)
print("ADABA LEAD DEDUP SYSTEM — TEST RUN")
print("="*50 + "\n")

# Test 1: Environment Variables
def check_env():
    required = ['DATABASE_URL', 'TELEGRAM_BOT_TOKEN', 'TELEGRAM_REPORT_CHANNEL_ID']
    missing = [k for k in required if not os.environ.get(k)]
    if missing:
        raise ValueError(f"Missing env vars: {', '.join(missing)}")
    return True
test("Environment Variables", check_env)

# Test 2: Database Connection
def check_db():
    from database import get_connection
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT version();")
    ver = cur.fetchone()[0]
    cur.close()
    conn.close()
    print(f"   DB Version: {ver[:40]}...")
    return True
test("Database Connection", check_db)

# Test 3: Database Table Creation
def check_tables():
    from database import init_db, get_connection
    init_db()
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'lead_%';")
    tables = [row[0] for row in cur.fetchall()]
    cur.close()
    conn.close()
    expected = {'lead_csrs', 'lead_orders', 'lead_deleted_duplicates'}
    missing = expected - set(tables)
    if missing:
        raise ValueError(f"Missing tables: {missing}")
    print(f"   Tables found: {tables}")
    return True
test("Database Tables", check_tables)

# Test 4: Insert a test CSR
def check_insert_csr():
    from database import get_connection
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO lead_csrs (name, telegram_chat_id, is_active)
        VALUES ('Test CSR 1', 'TEST_CHAT_001', TRUE)
        ON CONFLICT (telegram_chat_id) DO UPDATE SET name = EXCLUDED.name
        RETURNING id;
    """)
    csr_id = cur.fetchone()[0]
    conn.commit()
    cur.close()
    conn.close()
    print(f"   Test CSR inserted/updated with id: {csr_id}")
    return True
test("Insert Test CSR", check_insert_csr)

# Test 5: Insert a test order
def check_insert_order():
    from database import insert_order
    order_id = insert_order(
        'TEST_MSG_001', 'GOZIE', 'Product A',
        'John Doe', '+2348012345678', 'johndoe@test.com',
        'Test: Name: John Doe\nPhone: +2348012345678\nEmail: johndoe@test.com'
    )
    print(f"   Test order inserted with id: {order_id}")
    return order_id is not None
test("Insert Test Order", check_insert_order)

# Test 6: Duplicate Detection (same phone within 72h)
def check_dedup_detected():
    from database import find_existing_order
    existing = find_existing_order('+2348012345678', 'johndoe@test.com')
    if not existing:
        raise ValueError("Should have found existing order for same phone!")
    print(f"   Duplicate correctly detected. Original order id: {existing[0]}")
    return True
test("Duplicate Detection (72h)", check_dedup_detected)

# Test 7: Duplicate Logging
def check_log_duplicate():
    from database import find_existing_order, insert_duplicate
    existing = find_existing_order('+2348012345678', 'johndoe@test.com')
    insert_duplicate('TEST_MSG_002_DUP', 'GOZIE', 'Product A',
                    'John Doe', '+2348012345678', 'johndoe@test.com', existing)
    print(f"   Duplicate logged successfully")
    return True
test("Log Duplicate", check_log_duplicate)

# Test 8: CSR Assignment (Round Robin)
def check_csr_assignment():
    from database import insert_order, assign_csr
    order_id = insert_order('TEST_MSG_003', 'PEARL', 'Product B',
                           'Jane Smith', '+2349087654321', 'janesmith@test.com',
                           'Test order 2')
    csr = assign_csr(order_id)
    if not csr:
        raise ValueError("No CSR assigned - are there active CSRs in lead_csrs table?")
    print(f"   Order assigned to CSR: {csr['name']} (id: {csr['id']})")
    return True
test("CSR Round-Robin Assignment", check_csr_assignment)

# Test 9: Telegram Bot API
def check_telegram():
    from telegram_service import send_message, TELEGRAM_BOT_TOKEN
    if not TELEGRAM_BOT_TOKEN or TELEGRAM_BOT_TOKEN == 'your_bot_token':
        raise ValueError("TELEGRAM_BOT_TOKEN not set")
    # Just validate the token by calling getMe
    import requests
    resp = requests.get(f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/getMe", timeout=10)
    data = resp.json()
    if not data.get('ok'):
        raise ValueError(f"Bot API error: {data.get('description')}")
    print(f"   Bot: @{data['result']['username']}")
    return True
test("Telegram Bot Connection", check_telegram)

# Test 10: Report Data
def check_report():
    from database import get_report_data
    from telegram_service import build_report
    since = datetime(2020, 1, 1)
    data = get_report_data(since)
    orders_by_product, orders_by_buyer, orders_by_csr, duplicates_deleted = data
    report = build_report("Test Report", orders_by_product, orders_by_buyer, orders_by_csr, duplicates_deleted)
    print(f"   Report generated ({len(report)} chars)")
    return len(report) > 50
test("Report Generation", check_report)

# Clean up test data
def cleanup():
    from database import get_connection
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("DELETE FROM lead_deleted_duplicates WHERE gmail_message_id LIKE 'TEST_%';")
    cur.execute("DELETE FROM lead_orders WHERE gmail_message_id LIKE 'TEST_%';")
    cur.execute("DELETE FROM lead_csrs WHERE telegram_chat_id LIKE 'TEST_%';")
    conn.commit()
    cur.close()
    conn.close()
    print("   Test data cleaned up")
    return True
test("Cleanup Test Data", cleanup)

# Summary
print("\n" + "="*50)
passed = sum(1 for _, status, _ in results if status == PASS)
failed = sum(1 for _, status, _ in results if status == FAIL)
print(f"RESULTS: {passed}/{len(results)} passed, {failed} failed")
if failed == 0:
    print("\n🎉 ALL TESTS PASSED! System is ready to go live.")
    print("\nNext steps:")
    print("1. Add real CSRs to the lead_csrs table")
    print("2. Set up credentials.json for Gmail OAuth")
    print("3. Run: python main.py")
else:
    print("\n⚠️  Fix failing tests before going live.")
    for name, status, err in results:
        if status == FAIL:
            print(f"  - {name}: {err}")
print("="*50 + "\n")
