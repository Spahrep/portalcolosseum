/**
 * Portal Colosseum - Password Reset Page Application Logic
 * =========================================================
 * External ES module for the password reset page.
 * Handles Supabase PKCE code exchange (code in URL query params),
 * then uses the obtained session to update the user's password.
 *
 * CSP-compliant: script-src 'self' esm.sh https://*.supabase.co
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.112.4';

// === SUPABASE CONFIGURATION ===
// Config is loaded from /api/env.js (served by Vercel serverless function)
const SUPABASE_URL = window.ENV.SUPABASE_URL;
const SUPABASE_ANON_KEY = window.ENV.SUPABASE_ANON_KEY;

let supabase;

/**
 * Initialize the Supabase client with in-memory storage (XSS protection)
 * and PKCE flow enabled to handle auth code exchange.
 */
function initSupabase() {
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
}

/**
 * Display a message (success or error) to the user.
 * @param {string} text - The message to display
 * @param {string} type - 'success' or 'error'
 */
function showMessage(text, type = 'success') {
  const msgEl = document.getElementById('auth-message');
  if (msgEl) {
    msgEl.textContent = text;
    msgEl.className = `auth-message ${type}`;
    msgEl.style.display = 'block';
    if (type === 'success') {
      setTimeout(() => {
        msgEl.style.display = 'none';
      }, 4000);
    }
  }
}

/**
 * Validate the new password.
 * Policy: at least 8 characters.
 * @returns {object} { valid: bool, errors: string[] }
 */
function validatePassword(password) {
  const errors = [];
  if (password.length < 8) {
    errors.push(`Password must be at least 8 characters (currently ${password.length}).`);
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Handle the Supabase auth code from the URL query params.
 * PKCE: client auto-exchanges the code for a session via detectSessionInUrl.
 * Then we use the session to call updateUser to set the new password.
 */
async function handleResetCode() {
  if (!supabase) {
    showMessage('Authentication service not available. Please refresh the page.', 'error');
    return;
  }

  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('code');

  if (!code) {
    showMessage('Invalid or expired reset link. Please request a new password reset from the login page.', 'error');
    // Hide the form and show a link back to login
    document.getElementById('reset-form').style.display = 'none';
    return;
  }

  try {
    // With detectSessionInUrl: true and PKCE flow, the client will auto-exchange
    // the code for a session. We now retrieve that session.
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError) {
      showMessage(`Authentication error: ${sessionError.message}`, 'error');
      return;
    }

    if (!session) {
      // Session not established yet — trigger the exchange by using the code
      // The PKCE flow with detectSessionInUrl should have handled this on init,
      // but if it didn't, we need to manually exchange
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        showMessage(`Failed to verify reset code: ${error.message}`, 'error');
        return;
      }
      console.log('Session established after code exchange');
      showMessage('Reset token verified. Enter your new password below.', 'success');
    } else {
      // Session already established via auto-detection
      document.getElementById('reset-form').style.display = 'block';
      showMessage('Reset token verified. Enter your new password below.', 'success');
    }
  } catch (err) {
    showMessage(`Error processing reset link: ${err.message}`, 'error');
  }
}

/**
 * Submit the new password via Supabase's updateUser.
 */
async function resetPassword() {
  if (!supabase) {
    showMessage('Authentication service not available. Please refresh the page.', 'error');
    return;
  }

  const password = document.getElementById('password').value;
  const confirm = document.getElementById('password-confirm').value;

  if (!password || !confirm) {
    return showMessage('Please enter and confirm your new password', 'error');
  }

  if (password !== confirm) {
    return showMessage('Passwords do not match. Please try again.', 'error');
  }

  // Client-side validation
  const { valid, errors } = validatePassword(password);
  if (!valid) {
    return showMessage(errors.join(' '), 'error');
  }

  try {
    const { error } = await supabase.auth.updateUser({ password: password });

    if (error) {
      showMessage(`Password reset failed: ${error.message}`, 'error');
    } else {
      showMessage('Password reset successfully! Redirecting to login...', 'success');
      setTimeout(() => {
        window.location.href = '/login';
      }, 2000);
    }
  } catch (err) {
    showMessage(`Error resetting password: ${err.message}`, 'error');
  }
}

// --- DOM ready ---
document.addEventListener('DOMContentLoaded', () => {
  initSupabase();

  // Set up event listener for the form submission
  document.getElementById('reset-btn').addEventListener('click', resetPassword);

  // Check for auth code in URL (from the reset email link)
  if (window.location.search.includes('code=')) {
    handleResetCode();
  } else {
    // No code — link is invalid/expired
    showMessage('No reset code found. Please use the password reset link from your email.', 'error');
  }
});
