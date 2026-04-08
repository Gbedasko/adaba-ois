import os
import threading
import time
import logging
from flask import Flask, jsonify, request
from database import init_db, get_connection
from gmail_service import get_gmail_service, poll_gmail
from telegram_service import send_report, build_report

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
logger = logging.getLogger(__name__)

app = Flask(__name__)

polling_active = False
last_poll_time = None
last_poll_status = "Not started yet"


def background_poll():
    global last_poll_time, last_poll_status, polling_active
    interval = int(os.environ.get('POLL_INTERVAL_SECONDS', 120))
    logger.info("Background polling started. Interval: %ds", interval)
    while polling_active:
        try:
            service = get_gmail_service()
            if service:
                count = poll_gmail(service)
                last_poll_time = time.time()
                last_poll_status = "OK - processed %d emails" % count
                logger.info("Poll complete: %d emails processed", count)
            else:
                last_poll_status = "Gmail service not available (token.json missing?)"
                logger.warning(last_poll_status)
        except Exception as e:
            last_poll_status = "Error: %s" % str(e)
            logger.error("Polling error: %s", e, exc_info=True)
        time.sleep(interval)


def background_reports():
    import datetime
    logger.info("Report scheduler started")
    while True:
        now = datetime.datetime.utcnow()
        hour = now.hour
        minute = now.minute
        if (hour == 8 and minute == 0) or (hour == 17 and minute == 0):
            try:
                report_data = build_report()
                send_report(report_data)
                logger.info("Report sent at %02d:%02d UTC", hour, minute)
                time.sleep(61)
            except Exception as e:
                logger.error("Report error: %s", e, exc_info=True)
                time.sleep(61)
        else:
            time.sleep(30)


@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        "ok": True,
        "status": "healthy",
        "polling_active": polling_active,
        "last_poll_time": last_poll_time,
        "last_poll_status": last_poll_status
    })


@app.route('/add-csr', methods=['POST'])
def add_csr():
    data = request.get_json()
    secret = os.environ.get('ADMIN_SECRET', 'adaba-admin-2026')
    if data.get('secret') != secret:
        return jsonify({"ok": False, "error": "Unauthorized"}), 401
    name = data.get('name')
    chat_id = str(data.get('telegram_chat_id'))
    if not name or not chat_id:
        return jsonify({"ok": False, "error": "name and telegram_chat_id required"}), 400
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("INSERT INTO lead_csrs (name, telegram_chat_id, is_active) VALUES (%s, %s, TRUE) ON CONFLICT (telegram_chat_id) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;", (name, chat_id))
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"ok": True, "message": "CSR %s added/updated" % name})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500


@app.route('/list-csrs', methods=['GET'])
def list_csrs():
    secret = request.args.get('secret', '')
    admin_secret = os.environ.get('ADMIN_SECRET', 'adaba-admin-2026')
    if secret != admin_secret:
        return jsonify({"ok": False, "error": "Unauthorized"}), 401
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("SELECT id, name, telegram_chat_id, total_assigned, is_active FROM lead_csrs ORDER BY id;")
        rows = cur.fetchall()
        cur.close()
        conn.close()
        csrs = [{"id": r[0], "name": r[1], "chat_id": r[2], "assigned": r[3], "active": r[4]} for r in rows]
        return jsonify({"ok": True, "csrs": csrs, "total": len(csrs)})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500


@app.route('/stats', methods=['GET'])
def stats():
    secret = request.args.get('secret', '')
    admin_secret = os.environ.get('ADMIN_SECRET', 'adaba-admin-2026')
    if secret != admin_secret:
        return jsonify({"ok": False, "error": "Unauthorized"}), 401
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM lead_orders;")
        total_orders = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM lead_deleted_duplicates;")
        total_dupes = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM lead_csrs WHERE is_active = TRUE;")
        active_csrs = cur.fetchone()[0]
        cur.close()
        conn.close()
        return jsonify({"ok": True, "total_orders": total_orders, "total_duplicates_deleted": total_dupes, "active_csrs": active_csrs})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500


if __name__ == '__main__':
    try:
        init_db()
        logger.info("Database initialized successfully")
    except Exception as e:
        logger.error("Database init error: %s", e)
    polling_active = True
    t1 = threading.Thread(target=background_poll, daemon=True)
    t1.start()
    t2 = threading.Thread(target=background_reports, daemon=True)
    t2.start()
    port = int(os.environ.get('PORT', 8080))
    logger.info("Starting Flask on port %d", port)
    app.run(host='0.0.0.0', port=port, debug=False)
