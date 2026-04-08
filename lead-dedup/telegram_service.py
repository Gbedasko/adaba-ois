import os
import asyncio
import requests
from datetime import datetime

TELEGRAM_BOT_TOKEN = os.environ.get('TELEGRAM_BOT_TOKEN', '')
TELEGRAM_REPORT_CHANNEL_ID = os.environ.get('TELEGRAM_REPORT_CHANNEL_ID', '')

BASE_URL = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}"

def send_message(chat_id, text, parse_mode='HTML'):
    """Send a Telegram message synchronously."""
    url = f"{BASE_URL}/sendMessage"
    payload = {
        'chat_id': chat_id,
        'text': text,
        'parse_mode': parse_mode
    }
    try:
        resp = requests.post(url, json=payload, timeout=10)
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        print(f"[TELEGRAM] Error sending message to {chat_id}: {e}")
        return None

def notify_csr(csr, order):
    """Send a lead order notification to a CSR."""
    msg = f"""
<b>📦 New Lead Order</b>

<b>Product:</b> {order.get('product', 'N/A')}
<b>Ad Buyer:</b> {order.get('ad_buyer', 'N/A')}

<b>Customer Details:</b>
👤 Name: {order.get('customer_name', 'N/A')}
📞 Phone: {order.get('customer_phone', 'N/A')}
📧 Email: {order.get('customer_email', 'N/A')}

<b>Assigned to:</b> {csr['name']}
⏰ {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}
""".strip()
    
    result = send_message(csr['chat_id'], msg)
    if result and result.get('ok'):
        print(f"[TELEGRAM] Order sent to CSR: {csr['name']}")
        return True
    return False

def send_report(report_text):
    """Send a report to the Telegram report channel."""
    if not TELEGRAM_REPORT_CHANNEL_ID:
        print("[TELEGRAM] No report channel ID configured")
        return False
    result = send_message(TELEGRAM_REPORT_CHANNEL_ID, report_text)
    return result and result.get('ok')

def send_duplicate_alert(order, original_time, hours_diff):
    """Optionally alert report channel when a duplicate is deleted."""
    if not TELEGRAM_REPORT_CHANNEL_ID:
        return
    msg = f"""
<b>🗑️ Duplicate Lead Deleted</b>

<b>Customer Phone:</b> {order.get('customer_phone', 'N/A')}
<b>Product:</b> {order.get('product', 'N/A')}
<b>Ad Buyer:</b> {order.get('ad_buyer', 'N/A')}
<b>Hours since original:</b> {hours_diff:.1f}h (within 72h window)
""".strip()
    send_message(TELEGRAM_REPORT_CHANNEL_ID, msg)

def build_report(period_label, orders_by_product, orders_by_buyer, orders_by_csr, duplicates_deleted):
    """Build a formatted report message."""
    total_orders = sum(count for _, count in orders_by_product)
    
    report = f"""
<b>📊 Adaba Lead Report — {period_label}</b>
<b>Generated:</b> {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}

<b>📦 Orders by Product:</b>
""".strip()
    
    if orders_by_product:
        for product, count in orders_by_product:
            report += f"\n  • {product or 'Unknown'}: {count}"
    else:
        report += "\n  No orders yet"
    
    report += "\n\n<b>👤 Leads by Ad Buyer:</b>"
    if orders_by_buyer:
        for buyer, count in orders_by_buyer:
            report += f"\n  • {buyer or 'Unknown'}: {count}"
    else:
        report += "\n  No data"
    
    report += "\n\n<b>📋 Orders per CSR:</b>"
    if orders_by_csr:
        for csr_name, count in orders_by_csr:
            report += f"\n  • {csr_name or 'Unassigned'}: {count}"
    else:
        report += "\n  No assignments yet"
    
    report += f"\n\n<b>🗑️ Duplicates Deleted:</b> {duplicates_deleted}"
    report += f"\n<b>✅ Total Valid Orders:</b> {total_orders}"
    
    return report
