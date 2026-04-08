"""
app.py — Flask wrapper for the Adaba Lead Deduplication System.
Runs the Gmail polling loop in a background thread.
Flask provides a health-check endpoint so Render (Web Service) keeps it alive.
"""
import os
import threading
import time
from flask import Flask, jsonify
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)

# Track system status
status = {
    'running': False,
    'emails_processed': 0,
    'duplicates_deleted': 0,
    'errors': 0,
    'last_poll': None,
    'start_time': None
}

def run_lead_dedup_loop():
    """Background thread: continuously polls Gmail and processes leads."""
    from database import init_db, find_existing_order, insert_order, insert_duplicate, assign_csr
    from gmail_service import get_gmail_service, get_unread_lead_emails, mark_as_read
    from telegram_service import notify_csr, send_duplicate_alert, send_report, build_report
    from datetime import datetime, timedelta
    
    poll_interval = int(os.environ.get('POLL_INTERVAL_SECONDS', '120'))
    
    print("[APP] Initializing database...")
    init_db()
    
    print("[APP] Authenticating Gmail...")
    try:
        service = get_gmail_service()
        print("[APP] Gmail authenticated successfully")
    except Exception as e:
        print(f"[APP] Gmail auth failed: {e}")
        status['errors'] += 1
        return
    
    status['running'] = True
    status['start_time'] = datetime.utcnow().isoformat()
    print(f"[APP] Lead dedup loop started. Polling every {poll_interval}s")
    
    last_morning_report = None
    last_evening_report = None
    
    while True:
        try:
            emails = get_unread_lead_emails(service)
            status['last_poll'] = datetime.utcnow().isoformat()
            
            for email in emails:
                msg_id = email['msg_id']
                customer_phone = email.get('customer_phone', '')
                customer_email_addr = email.get('customer_email', '')
                
                existing = find_existing_order(customer_phone, customer_email_addr)
                
                if existing:
                    original_time = existing[1]
                    hours_diff = (datetime.utcnow() - original_time.replace(tzinfo=None)).total_seconds() / 3600
                    insert_duplicate(msg_id, email['ad_buyer'], email['product'],
                                   email['customer_name'], customer_phone, customer_email_addr, existing)
                    send_duplicate_alert(email, original_time, hours_diff)
                    status['duplicates_deleted'] += 1
                    print(f"[DEDUP] Duplicate deleted: {customer_phone} ({hours_diff:.1f}h ago)")
                else:
                    order_id = insert_order(msg_id, email['ad_buyer'], email['product'],
                                           email['customer_name'], customer_phone, customer_email_addr,
                                           email['raw_body'])
                    csr = assign_csr(order_id)
                    if csr:
                        notify_csr(csr, email)
                        print(f"[APP] Order #{order_id} -> CSR: {csr['name']}")
                    status['emails_processed'] += 1
                
                mark_as_read(service, msg_id)
            
            # Check for scheduled reports
            now = datetime.utcnow()
            today_date = now.date().isoformat()
            
            if now.hour == 8 and now.minute < 3:
                if last_morning_report != today_date:
                    since = now.replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(hours=12)
                    from database import get_report_data
                    data = get_report_data(since)
                    report = build_report("Morning Report (8AM)", *data)
                    send_report(report)
                    last_morning_report = today_date
                    print("[APP] Morning report sent")
            
            elif now.hour == 17 and now.minute < 3:
                if last_evening_report != today_date:
                    since = now.replace(hour=0, minute=0, second=0, microsecond=0)
                    from database import get_report_data
                    data = get_report_data(since)
                    report = build_report("Evening Report (5PM)", *data)
                    send_report(report)
                    last_evening_report = today_date
                    print("[APP] Evening report sent")
        
        except Exception as e:
            print(f"[ERROR] Loop error: {e}")
            status['errors'] += 1
        
        time.sleep(poll_interval)

@app.route('/')
def health():
    return jsonify({
        'service': 'Adaba Lead Deduplication System',
        'status': 'running' if status['running'] else 'starting',
        'emails_processed': status['emails_processed'],
        'duplicates_deleted': status['duplicates_deleted'],
        'errors': status['errors'],
        'last_poll': status['last_poll'],
        'start_time': status['start_time']
    })

@app.route('/health')
def health_check():
    return jsonify({'ok': True, 'status': 'healthy'}), 200

if __name__ == '__main__':
    # Start the lead dedup loop in a background thread
    thread = threading.Thread(target=run_lead_dedup_loop, daemon=True)
    thread.start()
    
    port = int(os.environ.get('PORT', '8080'))
    print(f"[APP] Starting Flask on port {port}")
    app.run(host='0.0.0.0', port=port, debug=False)
