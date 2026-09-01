/**
 * Portal Colosseum - Signup Page Application Logic
 * =================================================
 * External ES module that was previously inline in signup.html.
 * Extracted to comply with the Content-Security-Policy
 * (script-src does NOT include 'unsafe-inline', so inline <script>
 * blocks are blocked by the browser).
 *
 * The module is deferred, so `window.ENV` (set by /api/env.js, a
 * synchronous external script loaded earlier in <head>) is available,
 * and all DOM elements exist by the time this module body executes.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.112.4';

// === SUPABASE CONFIGURATION ===
// Config is loaded from /api/env.js (served by Vercel serverless function)
const SUPABASE_URL = window.ENV.SUPABASE_URL;
const SUPABASE_ANON_KEY = window.ENV.SUPABASE_ANON_KEY;
let supabase;

function initSupabase() {
  // Security: Use in-memory storage adapter + PKCE flow to prevent
  // refresh tokens from being exposed to XSS attacks via localStorage
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      flowType: 'pkce',
      detectSessionInUrl: true,
      storage: {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {}
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

async function signInWithProvider(provider) {
  if (!supabase) return showMessage('Authentication service not available. Please refresh.', 'error');
  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: provider,
      options: { redirectTo: window.location.origin + '/signup' }
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
  }
}

async function handleAuthCallback() {
  // PKCE: With detectSessionInUrl: true, client auto-exchanges code for session
  const { data: { session }, error } = await supabase.auth.getSession();

  if (session) {
    // Session is persisted via HttpOnly cookie by the /api/session endpoint
    // Do NOT store any user data in localStorage (XSS risk)
    window.location.href = '/game';
  } else if (error) {
    console.error('Auth callback error:', error);
  }
}

// --- DOM ready: attach event listeners after DOM is parsed ---
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('google-signup-btn').addEventListener('click', () => signInWithProvider('google'));
  document.getElementById('github-signup-btn').addEventListener('click', () => signInWithProvider('github'));
  document.getElementById('email-signup-btn').addEventListener('click', signUpWithEmail);

  // Initialize Supabase client
  initSupabase();

  // Handle OAuth callback with PKCE (code in URL query params)
  if (window.location.search.includes('code=')) {
    handleAuthCallback();
  }
});
