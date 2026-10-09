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

import { supabaseClient } from '../js/utils.js';
import { persistRefreshCookie } from './session.js';
import { showMessage, signInWithProvider } from './auth-helpers.js';

// Supabase client instance (initialized via shared utils)
let supabase;

/**
 * Initialize the Supabase client via the shared singleton.
 * Delegates to supabaseClient() in ../js/utils.js which encapsulates
 * the PKCE + localStorage setup and singleton behavior.
 */
function initSupabase() {
  supabase = supabaseClient();
  if (supabase) {
    // Check if already logged in (e.g., refresh from previous session)
    checkExistingSession();
  }
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
          await persistRefreshCookie(session);
        } catch (err) {
          console.error('Failed to persist session cookie:', err);
        }
      }
      window.location.href = window.getTownUrl();
    }
  } catch (error) {
    console.error('Session check error:', error);
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
      const session = data.session;
      if (session?.refresh_token) {
        try {
          await persistRefreshCookie(session);
        } catch (err) {
          console.error('Failed to persist session cookie:', err);
        }
      }
      window.location.href = window.getTownUrl();
    }
  } catch (err) {
    console.error('Login exception:', err);
    showMessage(`Error: ${err.message}`, 'error');
  }
}

/**
 * Send password reset email.
 * Includes client-side rate limiting with countdown timer to prevent
 * Supabase 429 (Too Many Requests) errors.
 */
let resetEmailCooldown = false;
let cooldownSeconds = 0;
let cooldownInterval = null;

/**
 * Start a countdown timer for the reset link.
 * @param {number} seconds - Number of seconds to count down from
 */
function startCooldown(seconds) {
  resetEmailCooldown = true;
  cooldownSeconds = seconds;
  const resetLink = document.getElementById('reset-link');
  const originalText = 'Reset it';
  resetLink.style.opacity = '0.6';
  resetLink.style.pointerEvents = 'none';

  // Clear any existing interval
  if (cooldownInterval) {
    clearInterval(cooldownInterval);
  }

  cooldownInterval = setInterval(() => {
    cooldownSeconds--;
    if (cooldownSeconds > 0) {
      resetLink.textContent = `Try again in ${cooldownSeconds}s`;
    } else {
      clearInterval(cooldownInterval);
      cooldownInterval = null;
      resetEmailCooldown = false;
      resetLink.textContent = originalText;
      resetLink.style.opacity = '1';
      resetLink.style.pointerEvents = 'auto';
    }
  }, 1000);
}

async function sendResetEmail() {
  if (!supabase) {
    return showMessage('Authentication service not available. Please refresh the page.', 'error');
  }

  // Rate limit: prevent spamming reset requests (causes 429)
  if (resetEmailCooldown && cooldownSeconds > 0) {
    showMessage(`Please wait ${cooldownSeconds} seconds before requesting another reset email.`, 'error');
    return;
  }

  const email = document.getElementById('email').value.trim();
  if (!email) {
    return showMessage('Please enter your email address', 'error');
  }

  // Show "Sending..." immediately
  startCooldown(60);
  const resetLink = document.getElementById('reset-link');
  resetLink.textContent = 'Sending...';

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/reset-password',
    });

    if (error) {
      // Handle 429 rate limit specifically
      if (error.status === 429 || /rate limit|429|once every/i.test(error.message)) {
        showMessage(`Rate limited by server: ${error.message}. Please wait ${cooldownSeconds}s and try again.`, 'error');
      } else {
        showMessage(`Failed to send reset email: ${error.message}`, 'error');
      }
    } else {
      showMessage(`Reset instructions sent to ${email}!`, 'success');
    }
  } catch (err) {
    showMessage(`Error sending reset email: ${err.message}`, 'error');
  }
}

// --- DOM ready: attach event listeners after DOM is parsed ---
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('google-login-btn').addEventListener('click', () => {
    signInWithProvider(supabase, 'google', {
      redirectTo: window.location.origin + window.getTownUrl(),
      showMessage,
    });
  });
  document.getElementById('github-login-btn').addEventListener('click', () => {
    signInWithProvider(supabase, 'github', {
      redirectTo: window.location.origin + window.getTownUrl(),
      showMessage,
    });
  });
  document.getElementById('email-login-btn').addEventListener('click', signInWithEmail);
  document.getElementById('reset-link').addEventListener('click', sendResetEmail);

  // Initialize Supabase client
  initSupabase();
});
