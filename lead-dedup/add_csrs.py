"""
Add CSRs (Customer Service Reps) to the Adaba Lead Dedup system.

Each CSR must have:
- name: Their display name
- telegram_chat_id: Their Telegram user/group chat ID

To get a Telegram chat ID:
  1. Have the CSR start a conversation with @Adabaorders_bot
  2. Visit: https://api.telegram.org/bot<TOKEN>/getUpdates
  3. Look for "chat": {"id": ...} in the response

Usage:
  python add_csrs.py

Edit the CSRS list below to add your team members.
"""
import os
from dotenv import load_dotenv
load_dotenv()

from database import get_connection, init_db

# ================================================================
# EDIT THIS LIST — Add your CSRs here
# Format: ('Name', 'TelegramChatID')
# ================================================================
CSRS = [
    # ('CSR Name', 'telegram_chat_id'),
    # ('AMAKA', '123456789'),
    # ('CHIDI', '987654321'),
    # ('BOLA', '111222333'),
    # Add all 35+ CSRs here...
]
# ================================================================

def add_csrs():
    if not CSRS:
        print("⚠️  No CSRs defined! Edit the CSRS list in add_csrs.py first.")
        return
    
    init_db()
    conn = get_connection()
    cur = conn.cursor()
    
    added = 0
    updated = 0
    
    for name, chat_id in CSRS:
        cur.execute("""
            INSERT INTO lead_csrs (name, telegram_chat_id, is_active)
            VALUES (%s, %s, TRUE)
            ON CONFLICT (telegram_chat_id) DO UPDATE
            SET name = EXCLUDED.name, is_active = TRUE;
        """, (name, chat_id))
        if cur.rowcount == 1:
            added += 1
        else:
            updated += 1
    
    conn.commit()
    
    # Show current CSR list
    cur.execute("SELECT id, name, telegram_chat_id, total_assigned, is_active FROM lead_csrs ORDER BY id;")
    all_csrs = cur.fetchall()
    
    cur.close()
    conn.close()
    
    print(f"\n✅ Added {added} new CSRs, updated {updated} existing CSRs")
    print(f"\nCurrent CSR List ({len(all_csrs)} total):")
    print(f"{'ID':<5} {'Name':<20} {'Chat ID':<20} {'Assigned':<10} {'Active'}")
    print("-" * 70)
    for csr in all_csrs:
        print(f"{csr[0]:<5} {csr[1]:<20} {csr[2]:<20} {csr[3]:<10} {'Yes' if csr[4] else 'No'}")

def deactivate_csr(chat_id):
    """Deactivate a CSR (they won't receive new orders)."""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("UPDATE lead_csrs SET is_active = FALSE WHERE telegram_chat_id = %s;", (chat_id,))
    conn.commit()
    cur.close()
    conn.close()
    print(f"CSR with chat_id {chat_id} deactivated")

if __name__ == '__main__':
    add_csrs()
