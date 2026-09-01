/**
 * Portal Colosseum - Login Page Application Logic
 * =================================================
 * External ES module extracted from login.html's inline script.
 * Required because CSP script-src 'self' esm.sh https://*.supabase.co
 * blocks all inline <script> blocks.
 *
 * This module imports createClient directly from esm.sh (allowed by CSP),
 * reads config from window.ENV (set by /api/env.js), and attaches all
 * event listeners via DOMContentLoaded.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.112.4';

// === SUPABASE CONFIGURATION ===
// Config is loaded from /api/env.js (served by Vercel serverless function)
const SUPABASE_URL = window.ENV.SUPABASE_URL;
const SUPABASE_ANON_KEY = window.ENV.SUPABASE_ANON_KEY;

// Supabase client instance (initialized in initSupabase())
let supabase;

/**
 * Initialize the Supabase client.
 * Creates a Supabase client instance that provides access to auth, database, etc.
 * After initialization, check if user has an existing session.
 *
 * Security: We use an in-memory storage adapter instead of localStorage to
 * prevent refresh tokens from being exposed to XSS attacks. Sessions are
 * only retained for the lifetime of the page (no persistence across reloads).
 */
function initSupabase() {
  // Create the Supabase client with URL and anon key
  // Security: Use in-memory storage adapter to prevent tokens from being
  // exposed to XSS attacks via localStorage. Sessions are retained only
  // for the lifetime of the page (no persistence across reloads).
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      flowType: 'pkce',        // Use PKCE flow instead of implicit (tokens in URL)
      detectSessionInUrl: true, // Auto-detect and exchange code on callback
      storage: {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {}
      }
    }
  });
  console.log('Supabase initialized:', supabase ? 'OK' : 'FAILED');
  // Check if already logged in (e.g., refresh from previous session)
  checkExistingSession();
}

/**
 * Check if the user already has an active session.
 * If a session exists, redirect to the game page automatically.
 * This prevents showing the login page to authenticated users.
 */
async function checkExistingSession() {
  if (!supabase) return;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      // User is already logged in - persist session cookie and redirect
      if (session.refresh_token) {
        try {
          await fetch('/api/session', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: session.refresh_token })
          });
        } catch (err) {
          console.error('Failed to persist session cookie:', err);
        }
      }
      window.location.href = '/game';
    }
  } catch (error) {
    console.error('Session check error:', error);
  }
}

/**
 * Display an authentication message (success or error) to the user.
 * @param {string} text - The message to display
 * @param {string} type - 'success' or 'error'
 */
function showMessage(text, type = 'success') {
  const msgEl = document.getElementById('auth-message');
  msgEl.textContent = text;
  msgEl.className = `auth-message ${type}`;
  msgEl.style.display = 'block';

  // Auto-hide success messages after 4 seconds
  if (type === 'success') {
    setTimeout(() => {
      msgEl.style.display = 'none';
    }, 4000);
  }
}

/**
 * Sign in using an OAuth provider (Google or GitHub).
 * Redirects to the provider's authentication page, then returns to the game page.
 * @param {string} provider - The OAuth provider: 'google' or 'github'
 */
async function signInWithProvider(provider) {
  if (!supabase) {
    console.error('Supabase not initialized');
    return showMessage('Authentication service not available. Please refresh the page.', 'error');
  }

  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: provider,
      options: {
        redirectTo: window.location.origin + '/game',
      }
    });

    if (error) {
      console.error(`${provider} OAuth error:`, error);
      return showMessage(`${provider} login failed: ${error.message}`, 'error');
    }
    console.log(`${provider} OAuth initiated successfully`);
  } catch (err) {
    console.error(`${provider} OAuth exception:`, err);
    showMessage(`${provider} login error: ${err.message}`, 'error');
  }
}

/**
 * Sign in with email and password.
 */
async function signInWithEmail() {
  if (!supabase) {
    console.error('Supabase not initialized');
    return showMessage('Authentication service not available. Please refresh the page.', 'error');
  }

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  if (!email || !password) {
    return showMessage('Please enter your email and password', 'error');
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });

    if (error) {
      console.error('Login error:', error);
      showMessage(`Login failed: ${error.message}`, 'error');
    } else {
      // Persist session via HttpOnly cookie (not localStorage)
      if (session.refresh_token) {
        try {
          await fetch('/api/session', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: session.refresh_token })
          });
        } catch (err) {
          console.error('Failed to persist session cookie:', err);
        }
      }
      window.location.href = '/game';
    }
  } catch (err) {
    console.error('Login exception:', err);
    showMessage(`Error: ${err.message}`, 'error');
  }
}

/**
 * Send password reset email.
 * Includes client-side rate limiting to prevent Supabase 429 errors.
 */
let resetEmailCooldown = false;

async function sendResetEmail() {
  if (!supabase) {
    return showMessage('Authentication service not available. Please refresh the page.', 'error');
  }

  // Rate limit: prevent spamming reset requests (causes 429)
  if (resetEmailCooldown) {
    showMessage('Please wait a moment before requesting another reset email.', 'error');
    return;
  }

  const email = document.getElementById('email').value.trim();
  if (!email) {
    return showMessage('Please enter your email address', 'error');
  }

  // Enable cooldown before the request
  resetEmailCooldown = true;
  const resetLink = document.getElementById('reset-link');
  const originalText = resetLink.textContent;
  resetLink.textContent = 'Sending...';

  // Cooldown timer: 60 seconds
  setTimeout(() => {
    resetEmailCooldown = false;
    if (resetLink.textContent === 'Sending...' || resetLink.textContent === 'Request sent. Wait...') {
      resetLink.textContent = originalText;
    }
  }, 60000);

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + '/reset-password',
  });

  if (error) {
    showMessage(`Failed to send reset email: ${error.message}`, 'error');
    resetLink.textContent = 'Request failed. Try again...';
  } else {
    showMessage(`Reset instructions sent to ${email}!`, 'success');
    resetLink.textContent = 'Request sent. Wait...';
  }
}

/**
 * Handle authentication callbacks (OAuth redirect).
 * With PKCE + detectSessionInUrl: true, the Supabase client auto-exchanges
 * the auth code for a session. We just need to check if a session exists
 * and persist it via the session Edge Function.
 */
async function handleAuthCallback() {
  if (!supabase) return;

  try {
    const { data: { session }, error } = await supabase.auth.getSession();

    if (session) {
      // Persist the refresh token in an HttpOnly cookie via our Edge Function
      if (session.refresh_token) {
        try {
          await fetch('/api/session', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: session.refresh_token })
          });
        } catch (err) {
          console.error('Failed to persist session cookie:', err);
        }
      }
      // Redirect to the game page
      window.location.href = '/game';
    } else if (error) {
      console.error('Auth callback error:', error);
      showMessage('Login failed: ' + error.message, 'error');
    }
  } catch (err) {
    console.error('Callback exception:', err);
    showMessage('Authentication error: ' + err.message, 'error');
  }
}

// --- DOM ready: attach event listeners after DOM is parsed ---
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('google-login-btn').addEventListener('click', () => signInWithProvider('google'));
  document.getElementById('github-login-btn').addEventListener('click', () => signInWithProvider('github'));
  document.getElementById('email-login-btn').addEventListener('click', signInWithEmail);
  document.getElementById('reset-link').addEventListener('click', (e) => { e.preventDefault(); sendResetEmail(); });

  // Initialize Supabase client
  initSupabase();

  // Check for OAuth callback (PKCE: code in URL query params)
  if (window.location.search.includes('code=')) {
    handleAuthCallback();
  }
});
