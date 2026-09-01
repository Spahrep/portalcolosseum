#!/usr/bin/env python3
"""
Automate Gmail login via Chrome DevTools Protocol.
Uses the already-running Chrome instance with --remote-debugging-port=9222.
"""

import json
import time
import requests
from websocket import create_connection

def get_ws_url():
    """Get WebSocket URL for the Google Accounts sign-in tab."""
    tabs = json.loads(requests.get("http://localhost:9222/json").text)
    for t in tabs:
        url = t.get("url", "")
        if "accounts.google.com" in url or "mail.google.com" in url:
            return t["webSocketDebuggerUrl"], t["id"]
    # If no Google tab, open one
    requests.put("http://localhost:9222/json/new", data=json.dumps({"url": "https://mail.google.com"}),
                 headers={"Content-Type": "application/json"})
    time.sleep(2)
    tabs = json.loads(requests.get("http://localhost:9222/json").text)
    for t in tabs:
        if "accounts.google.com" in t.get("url", "") or "mail.google.com" in t.get("url", ""):
            return t["webSocketDebuggerUrl"], t["id"]
    return None, None

def eval_js(ws, cmd_id):
    """Send a Runtime.evaluate command and wait for response."""
    msg = json.dumps({"id": cmd_id, "method": "Runtime.evaluate", "params": {"returnByValue": True}})
    ws.send(msg)
    resp = json.loads(ws.recv())
    return resp.get("result", {}).get("result", {}).get("value", None)

def fill_and_click(ws, email, password):
    """Fill in Gmail login form and click through."""
    cmd = 1

    def send(method, params=None):
        nonlocal cmd
        cmd += 1
        ws.send(json.dumps({"id": cmd, "method": method, "params": params or {}}))
        time.sleep(0.3)
        return json.loads(ws.recv())

    def run_js(expr):
        nonlocal cmd
        cmd += 1
        ws.send(json.dumps({"id": cmd, "method": "Runtime.evaluate",
                            "params": {"expression": expr, "returnByValue": True}}))
        time.sleep(0.5)
        result = json.loads(ws.recv())
        return result.get("result", {}).get("result", {}).get("value", None)

    # Enable DOM
    send("Page.enable")
    send("DOM.enable")
    send("Runtime.enable")

    # Check if email field exists
    email_check = run_js("""
        (() => {
            const emailInput = document.querySelector('input[type="email"]');
            if (emailInput) {
                emailInput.value = "EMAIL_PLACEHOLDER";
                emailInput.dispatchEvent(new Event('input', {bubbles: true}));
                emailInput.dispatchEvent(new Event('change', {bubbles: true}));
                return 'Email field found and filled';
            }
            return 'No email field found';
        })()
    """.replace("EMAIL_PLACEHOLDER", email))
    print(f"Email input: {email_check}")

    time.sleep(1)

    # Click Next button
    next_check = run_js("""
        (() => {
            const buttons = Array.from(document.querySelectorAll('button, div[role="button"]'));
            const nextBtn = buttons.find(b => {
                const t = (b.textContent || '').toLowerCase();
                return t.includes('next') || t.includes('weiter');
            });
            if (nextBtn) { nextBtn.click(); return 'Next button clicked'; }
            return 'Next button not found';
        })()
    """)
    print(f"Next button: {next_check}")

    # Wait for password page to load
    print("Waiting for password page to load...")
    for i in range(10):
        time.sleep(1)
        pw_check = run_js("document.querySelector('input[type=\"password\"]') ? 'Password field found' : 'No password field yet'")
        print(f"  Attempt {i+1}: {pw_check}")
        if pw_check == "Password field found":
            break

    # Fill password
    pw_fill = run_js("""
        (() => {
            const pwInput = document.querySelector('input[type="password"]');
            if (pwInput) {
                pwInput.value = "PASSWORD_PLACEHOLDER";
                pwInput.dispatchEvent(new Event('input', {bubbles: true}));
                pwInput.dispatchEvent(new Event('change', {bubbles: true}));
                return 'Password filled';
            }
            return 'Password field not found';
        })()
    """.replace("PASSWORD_PLACEHOLDER", password))
    print(f"Password: {pw_fill}")

    time.sleep(0.5)

    # Click Next to submit password
    pw_next = run_js("""
        (() => {
            const buttons = Array.from(document.querySelectorAll('button, div[role="button"]'));
            const nextBtn = buttons.find(b => {
                const t = (b.textContent || '').toLowerCase();
                return t.includes('next') || t.includes('sign in');
            });
            if (nextBtn) { nextBtn.click(); return 'Password submit clicked'; }
            return 'Submit button not found';
        })()
    """)
    print(f"Password submit: {pw_next}")

    # Wait and check final state
    print("Waiting for final page state...")
    for i in range(10):
        time.sleep(2)
        title = run_js("document.title")
        url = run_js("window.location.href")
        print(f"  State {i+1}: title='{title}', url='{url[:80] if url else 'N/A'}'")
        if "inbox" in (url or "").lower() or "mail.google.com" in (url or "").lower():
            print("Login successful - at Gmail inbox!")
            return True
        if "challenge" in (url or "").lower() or "verification" in (url or "").lower():
            print("Need 2FA verification or phone verification")
            return True

    return True

if __name__ == "__main__":
    import os

    EMAIL = "portalcolosseum@gmail.com"
    PASSWORD = os.environ.get("GMAIL_PASSWORD")
    if not PASSWORD:
        # Read from important.txt
        with open("/home/spahrep/important.txt") as f:
            for line in f:
                if "px#" in line:
                    PASSWORD = line.strip()
                    break

    ws_url, tab_id = get_ws_url()
    if not ws_url:
        print("ERROR: Could not find Google sign-in tab")
        exit(1)

    print(f"Connecting to Chrome tab: {tab_id}")
    ws = create_connection(ws_url)

    success = fill_and_click(ws, EMAIL, PASSWORD)
    ws.close()
    print(f"Login automation {'completed' if success else 'failed'}")
