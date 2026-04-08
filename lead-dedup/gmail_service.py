import os
import base64
import re
import json
from datetime import datetime

from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

SCOPES = ['https://www.googleapis.com/auth/gmail.modify']
TOKEN_PATH = os.environ.get('GMAIL_TOKEN_PATH', 'token.json')
CREDENTIALS_PATH = os.environ.get('GMAIL_CREDENTIALS_PATH', 'credentials.json')

def get_gmail_service():
    """Authenticate and return Gmail API service."""
    creds = None
    if os.path.exists(TOKEN_PATH):
        creds = Credentials.from_authorized_user_file(TOKEN_PATH, SCOPES)
    
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(CREDENTIALS_PATH, SCOPES)
            creds = flow.run_local_server(port=0)
        with open(TOKEN_PATH, 'w') as token_file:
            token_file.write(creds.to_json())
    
    return build('gmail', 'v1', credentials=creds)

def get_unread_lead_emails(service, label_filter=None):
    """Fetch unread emails (optionally filtered by label). Returns list of parsed emails."""
    query = 'is:unread'
    if label_filter:
        query += f' label:{label_filter}'
    
    results = service.users().messages().list(userId='me', q=query, maxResults=50).execute()
    messages = results.get('messages', [])
    
    parsed = []
    for msg_ref in messages:
        msg = service.users().messages().get(userId='me', id=msg_ref['id'], format='full').execute()
        parsed_email = parse_email(msg)
        if parsed_email:
            parsed.append(parsed_email)
    
    return parsed

def parse_email(msg):
    """Parse a Gmail message into lead data."""
    try:
        headers = {h['name']: h['value'] for h in msg['payload']['headers']}
        
        from_field = headers.get('From', '')
        subject = headers.get('Subject', '')
        date_str = headers.get('Date', '')
        msg_id = msg['id']
        
        # Extract ad buyer name from From field (e.g., "GOZIE <email@domain.com>")
        ad_buyer_match = re.match(r'^([^<]+)', from_field)
        ad_buyer = ad_buyer_match.group(1).strip() if ad_buyer_match else from_field.strip()
        
        # Product name = Subject
        product = subject.strip()
        
        # Extract body
        body = extract_body(msg['payload'])
        
        # Parse customer details from body
        customer_name = extract_field(body, ['Name', 'Customer Name', 'Full Name'])
        customer_phone = extract_field(body, ['Phone', 'Phone Number', 'Mobile', 'Tel', 'Telephone', 'WhatsApp'])
        customer_email = extract_field(body, ['Email', 'Email Address', 'E-mail'])
        
        return {
            'msg_id': msg_id,
            'ad_buyer': ad_buyer,
            'product': product,
            'customer_name': customer_name,
            'customer_phone': normalize_phone(customer_phone),
            'customer_email': customer_email.lower().strip() if customer_email else '',
            'raw_body': body,
            'date': date_str
        }
    except Exception as e:
        print(f"[GMAIL] Error parsing message {msg.get('id', '?')}: {e}")
        return None

def extract_body(payload):
    """Recursively extract plain text body from email payload."""
    if 'body' in payload and payload['body'].get('size', 0) > 0:
        data = payload['body'].get('data', '')
        if data:
            return base64.urlsafe_b64decode(data).decode('utf-8', errors='replace')
    
    if 'parts' in payload:
        for part in payload['parts']:
            if part.get('mimeType') == 'text/plain':
                data = part['body'].get('data', '')
                if data:
                    return base64.urlsafe_b64decode(data).decode('utf-8', errors='replace')
        # Fallback: try html parts
        for part in payload['parts']:
            result = extract_body(part)
            if result:
                return result
    return ''

def extract_field(body, field_names):
    """Extract a field value from email body using common patterns."""
    for field in field_names:
        # Try pattern: "Field Name: value" or "Field Name : value"
        pattern = rf'{re.escape(field)}\s*:\s*(.+?)(?:\n|$)'
        match = re.search(pattern, body, re.IGNORECASE)
        if match:
            return match.group(1).strip()
    return ''

def normalize_phone(phone):
    """Normalize phone number by stripping non-digits, keeping + prefix."""
    if not phone:
        return ''
    digits = re.sub(r'[^\d+]', '', phone.strip())
    return digits

def mark_as_read(service, msg_id):
    """Mark a Gmail message as read."""
    service.users().messages().modify(
        userId='me',
        id=msg_id,
        body={'removeLabelIds': ['UNREAD']}
    ).execute()
