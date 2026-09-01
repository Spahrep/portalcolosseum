/**
 * Portal Colosseum - Signup Page Application Logic
 * =================================================
 * External ES module that was previously inline in signup.html.
 * Extracted to comply with the ContentSecurity-Policy
 * (script-src does NOT include 'unsafe-inline', so inline <script>
 * blocks are blocked by the browser).
 *
 * The module is deferred, so `window.ENV` (set by /api/env.js, a
 * synchronous external script loaded earlier in <head>) is available,
 * and all DOM elements exist by the time this module body executes.
 *
 * Alpha Invite Flow:
 *   1. User enters invite key in the #invite-key field
 *   2. Clicks "Verify Invite Key" → calls /api/invite-verify (POST)
 *   3. If valid → auth providers section slides in, invite section fades out
 *   4. Invite key stored in sessionStorage (session-only, no XSS persistence)
 *   5. On OAuth/email signup, the invite key is sent to /api/invite-verify
 *      (DELETE) to mark it as used
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.112.4';

// === SUPABASE CONFIGURATION ===
// Config is loaded from /api/env.js (served by Vercel serverless function)
const SUPABASE_URL = window.ENV.SUPABASE_URL;
const SUPABASE_ANON_KEY = window.ENV.SUPABASE_ANON_KEY;
let supabase;

// Store the validated invite key in session scope (not localStorage — too short
// lived to be an XSS target, and sessionStorage is cleared on tab close)
let inviteKey = null;

function initSupabase() {
  // Security: Use localStorage-backed PKCE storage so the code_verifier
  // persists across the OAuth redirect (provider → signup page).
  // The OAuth flow opens a new browser context, so an in-memory or
  // sessionStorage adapter would lose the verifier. localStorage survives
  // across tabs of the same origin, matching login-app.js and reset-password-app.js.
  //
  // Refresh tokens are NOT stored here — they go through the /api/session
  // Edge Function which sets HttpOnly cookies, keeping them safe from XSS.
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      flowType: 'pkce',
      detectSessionInUrl: true,
      storage: {
        getItem: (key) => localStorage.getItem(key),
        setItem: (key, value) => localStorage.setItem(key, value),
        removeItem: (key) => localStorage.removeItem(key)
      }
    }
  });
  console.log('Supabase initialized:', supabase ? 'OK' : 'FAILED');
}

function showMessage(text, type = 'success', allowHtml = false) {
  const msgEl = document.getElementById('auth-message');
  if (allowHtml) {
    msgEl.innerHTML = text;
  } else {
    msgEl.textContent = text;
  }
  msgEl.className = `auth-message ${type}`;
  msgEl.style.display = 'block';
  if (type === 'success') {
    setTimeout(() => { msgEl.style.display = 'none'; }, 4000);
  }
}

/**
 * Verify an invite key via the /api/invite-verify Edge Function.
 * If valid, reveals the auth provider buttons.
 */
async function verifyInviteKey() {
  const keyInput = document.getElementById('invite-key');
  const key = keyInput.value.trim();
  const verifyBtn = document.getElementById('invite-verify-btn');
  const inviteHint = document.getElementById('invite-hint');

  if (!key) {
    inviteHint.textContent = 'Please enter your invite key.';
    return;
  }

  verifyBtn.disabled = true;
  verifyBtn.textContent = 'Verifying...';
  inviteHint.textContent = 'Validating your invite key...';

  try {
    const response = await fetch('/api/invite-verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key })
    });

    const result = await response.json();

    if (result.valid) {
      inviteKey = key;
      inviteHint.textContent = 'Invite key accepted!';
      inviteHint.style.color = '#4ade80';

      // Reveal auth provider buttons
      const inviteSection = document.getElementById('invite-section');
      const authProviders = document.getElementById('auth-providers');
      inviteSection.style.opacity = '0.4';
      authProviders.style.display = 'block';
      authProviders.style.animation = 'fadeIn 0.5s ease-in';

      // Disable the key input since we've validated it
      keyInput.disabled = true;
      verifyBtn.style.display = 'none';
    } else {
      inviteHint.textContent = result.error || 'Invalid invite key.';
      inviteHint.style.color = '#f87171';
      keyInput.focus();
    }
  } catch (err) {
    inviteHint.textContent = 'Network error. Please try again.';
    inviteHint.style.color = '#f87171';
    console.error('Invite verification error:', err);
  } finally {
    verifyBtn.disabled = false;
    verifyBtn.textContent = 'Verify Invite Key';
  }
}

/**
 * Mark the invite key as used after successful account creation.
 * Called after Supabase auth.signUp() completes successfully.
 */
async function markInviteKeyUsed() {
  if (!inviteKey) return;

  try {
    const response = await fetch(`/api/invite-verify?key=${encodeURIComponent(inviteKey)}`, {
      method: 'DELETE'
    });
    if (!response.ok) {
      console.error('Failed to mark invite key as used:', response.status);
    }
  } catch (err) {
    // Non-critical — the key is validated server-side during signup too
    console.error('Error marking invite key used:', err);
  }
}

async function signInWithProvider(provider) {
  if (!inviteKey) {
    showMessage('Please verify your invite key first.', 'error');
    return;
  }

  if (!supabase) return showMessage('Authentication service not available. Please refresh.', 'error');
  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: provider,
      options: {
        redirectTo: window.location.origin + '/signup',
        // Pass the invite key via state so it survives the OAuth redirect
        // (stored in sessionStorage which persists across tabs of same origin)
      }
    });
    if (error) return showMessage(`${provider} login failed: ${error.message}`, 'error');
  } catch (err) {
    showMessage(`${provider} error: ${err.message}`, 'error');
  }
}

/**
 * Validates password strength.
 * Policy: at least 8 characters.
 * No mandatory character classes — see /passwords for guidance.
 * Returns { valid: bool, errors: string[] } so the caller can show
 * specific, actionable feedback to the user.
 */
function validatePassword(password) {
  const errors = [];
  const minimumLength = password.length >= 8;

  if (!minimumLength) {
    errors.push(`Password must be at least 8 characters (currently ${password.length}).`);
  }

  return { valid: minimumLength, errors };
}

async function signUpWithEmail() {
  if (!inviteKey) {
    showMessage('Please verify your invite key first.', 'error');
    return;
  }

  if (!supabase) return showMessage('Authentication service not available. Please refresh.', 'error');

  const username = document.getElementById('username').value.trim();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  if (!username || !email || !password) {
    return showMessage('Please fill in all fields', 'error');
  }

  // --- Client-side password validation (before hitting Supabase) ---
  const { valid, errors } = validatePassword(password);
  if (!valid) {
    return showMessage(errors.join(' '), 'error');
  }

  // Check username availability before signup
  try {
    const { data: existing, error: checkError } = await supabase
      .from('profiles')
      .select('username')
      .eq('username', username)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('Username check error:', checkError);
    }

    if (existing) {
      return showMessage(`Username '${username}' is taken. Try another.`, 'error');
    }
  } catch (err) {
    // PGRST116 means no rows found (username is available)
  }

  // Create auth user via Supabase, passing username as user metadata
  const { error } = await supabase.auth.signUp({
    email: email,
    password: password,
    options: {
      emailRedirectTo: window.location.origin + '/game',
      data: { username: username }
    }
  });

  if (error) {
    console.error('Signup error:', error);
    if (error.code === 'user_already_registered' ||
        /already.*registered/i.test(error.message || '')) {
      showMessage(
        'This email is already registered. ' +
        '<a href="/login#reset">Reset your password</a>?',
        'error',
        true
      );
    } else {
      showMessage(`Account creation failed: ${error.message}`, 'error');
    }
  } else {
    showMessage('Account created! Check your email to verify and complete signup.', 'success');
    // Mark the invite key as used after successful signup
    markInviteKeyUsed();
  }
}

async function handleAuthCallback() {
  // PKCE: With detectSessionInUrl: true, client auto-exchanges code for session
  const { data: { session }, error } = await supabase.auth.getSession();

  if (session) {
    // Persist the session via HttpOnly cookie through /api/session
    const refreshToken = session.refresh_token;
    if (refreshToken) {
      await fetch('/api/session', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken })
      });
    }
    // After successful OAuth flow, mark invite key as used
    markInviteKeyUsed();
    // Session is persisted via HttpOnly cookie by the /api/session endpoint
    window.location.href = '/game';
  } else if (error) {
    console.error('Auth callback error:', error);
  }
}

// --- DOM ready: attach event listeners after DOM is parsed ---
document.addEventListener('DOMContentLoaded', () => {
  // Invite key verification
  document.getElementById('invite-verify-btn')?.addEventListener('click', verifyInviteKey);

  // OAuth signup handlers
  document.getElementById('google-signup-btn')?.addEventListener('click', () => signInWithProvider('google'));
  document.getElementById('github-signup-btn')?.addEventListener('click', () => signInWithProvider('github'));

  // Email signup handler
  document.getElementById('email-signup-btn')?.addEventListener('click', signUpWithEmail);

  // Initialize Supabase client
  initSupabase();

  // Handle OAuth callback with PKCE (code in URL query params)
  if (window.location.search.includes('code=')) {
    handleAuthCallback();
  }

  // Allow Enter key on invite field to trigger verification
  const inviteKeyInput = document.getElementById('invite-key');
  if (inviteKeyInput) {
    inviteKeyInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        verifyInviteKey();
      }
    });
  }
});
