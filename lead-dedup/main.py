import os
import time
import signal
import sys
from datetime import datetime, timedelta
from dotenv import load_dotenv

load_dotenv()

from database import init_db, find_existing_order, insert_order, insert_duplicate, assign_csr, get_report_data
from gmail_service import get_gmail_service, get_unread_lead_emails, mark_as_read
from telegram_service import notify_csr, send_report, send_duplicate_alert, build_report

POLL_INTERVAL_SECONDS = int(os.environ.get('POLL_INTERVAL_SECONDS', '120'))  # 2 minutes

def process_emails(service):
    """Fetch, deduplicate, and distribute new lead emails."""
    emails = get_unread_lead_emails(service)
    
    if not emails:
        print(f"[MAIN] No new emails at {datetime.utcnow().strftime('%H:%M:%S UTC')}")
        return
    
    print(f"[MAIN] Processing {len(emails)} new email(s)...")
    
    for email in emails:
        msg_id = email['msg_id']
        customer_phone = email.get('customer_phone', '')
        customer_email = email.get('customer_email', '')
        
        print(f"[MAIN] Email: {email['product']} | Buyer: {email['ad_buyer']} | Phone: {customer_phone}")
        
        # Check for duplicates (same customer within 72h)
        existing = find_existing_order(customer_phone, customer_email)
        
        if existing:
            original_time = existing[1]
            hours_diff = (datetime.utcnow() - original_time.replace(tzinfo=None)).total_seconds() / 3600
            print(f"[DEDUP] Duplicate detected! Original was {hours_diff:.1f}h ago. Deleting duplicate.")
            insert_duplicate(msg_id, email['ad_buyer'], email['product'],
                           email['customer_name'], customer_phone, customer_email, existing)
            send_duplicate_alert(email, original_time, hours_diff)
        else:
            # Unique order - insert and distribute
            order_id = insert_order(msg_id, email['ad_buyer'], email['product'],
                                   email['customer_name'], customer_phone, customer_email,
                                   email['raw_body'])
            
            # Assign to CSR with round-robin
            csr = assign_csr(order_id)
            if csr:
                success = notify_csr(csr, email)
                if success:
                    print(f"[MAIN] Order #{order_id} assigned to CSR: {csr['name']}")
                else:
                    print(f"[MAIN] Failed to send Telegram message to CSR: {csr['name']}")
            else:
                print(f"[MAIN] WARNING: No active CSRs available! Order #{order_id} not distributed.")
        
        # Mark email as read
        mark_as_read(service, msg_id)

def send_scheduled_report(period_label, hours_back=None):
    """Generate and send a report for the given period."""
    if hours_back:
        since = datetime.utcnow() - timedelta(hours=hours_back)
    else:
        # Daily report - since last midnight
        since = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    
    data = get_report_data(since)
    orders_by_product, orders_by_buyer, orders_by_csr, duplicates_deleted = data
    
    report_text = build_report(period_label, orders_by_product, orders_by_buyer, orders_by_csr, duplicates_deleted)
    
    success = send_report(report_text)
    if success:
        print(f"[REPORT] {period_label} report sent successfully")
    else:
        print(f"[REPORT] Failed to send {period_label} report")

def check_and_send_reports():
    """Check if it's time to send a scheduled report (8AM or 5PM UTC)."""
    now = datetime.utcnow()
    hour = now.hour
    minute = now.minute
    
    # Send morning report at 8:00 AM UTC
    if hour == 8 and minute < 2:
        send_scheduled_report("Morning Report (8AM)", hours_back=12)
    
    # Send evening report at 5:00 PM UTC (17:00)
    elif hour == 17 and minute < 2:
        send_scheduled_report("Evening Report (5PM)", hours_back=9)

def run():
    """Main run loop."""
    print("[MAIN] Adaba Lead Deduplication System starting...")
    
    # Initialize database tables
    init_db()
    print("[MAIN] Database initialized")
    
    # Authenticate Gmail
    service = get_gmail_service()
    print("[MAIN] Gmail authenticated")
    
    print(f"[MAIN] Polling Gmail every {POLL_INTERVAL_SECONDS}s. Reports at 8AM and 5PM UTC.")
    
    last_report_check = datetime.utcnow()
    
    while True:
        try:
            process_emails(service)
            check_and_send_reports()
        except Exception as e:
            print(f"[ERROR] {e}")
        
        time.sleep(POLL_INTERVAL_SECONDS)

if __name__ == '__main__':
    def handle_signal(sig, frame):
        print("\n[MAIN] Shutting down gracefully...")
        sys.exit(0)
    signal.signal(signal.SIGTERM, handle_signal)
    signal.signal(signal.SIGINT, handle_signal)
    run()
