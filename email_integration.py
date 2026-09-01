#!/usr/bin/env python3
"""
Hermes Email Integration - Auto-check and respond capability
Runs via cron every 5 minutes to process incoming emails.
"""

import json
import subprocess
import os
from datetime import datetime, timedelta

def run_himalaya(args):
    """Run a himalaya command and return parsed output."""
    cmd = ["himalaya"] + args
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    return result.stdout, result.stderr, result.returncode

def list_recent_emails(limit=10):
    """List unread emails from the last 24 hours."""
    stdout, stderr, rc = run_himalaya([
        "envelope", "list",
        "--mailbox", "INBOX",
        "--flag", "unseen",
    ])
    
    if rc != 0:
        return []
    
    # Parse the simple table output
    emails = []
    lines = stdout.strip().split("\n")[3:-1]  # Skip header
    for line in lines:
        parts = [p.strip() for p in line.split("┆") if p.strip()]
        if len(parts) >= 6:
            emails.append({
                "id": parts[0],
                "subject": parts[2],
                "from": parts[3],
                "date": parts[4],
            })
    
    return emails

def send_email(to_addr, subject, body):
    """Send an email via SMTP."""
    msg = f"From: portalcolosseum@gmail.com\nTo: {to_addr}\nSubject: {subject}\n\n{body}"
    proc = subprocess.run(
        ["himalaya", "smtp", "send", "--mail-from", "portalcolosseum@gmail.com", "--rcpt-to", to_addr],
        input=msg, capture_output=True, text=True, timeout=30
    )
    return proc.returncode == 0, proc.stdout + proc.stderr

def main():
    """Main entry point for cron."""
    emails = list_recent_emails(limit=20)
    
    if not emails:
        print("No unread emails")
        return
    
    print(f"Found {len(emails)} unread emails:")
    for email in emails:
        print(f"  - [{email['id']}] From: {email['from']} | Subject: {email['subject']} | Date: {email['date']}")

if __name__ == "__main__":
    main()
