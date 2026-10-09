/**
 * Portal Colosseum - Landing Page Application Logic
 * =================================================
 * Handles the Login and Register buttons on the landing page.
 *
 * Flow:
 *   - Login button → goes directly to /login
 *   - Register button → shows invite key modal → validates via the
 *     invite-verify Supabase Edge Function
 *     → on success, redirects to /signup (with key in sessionStorage for signup-app.js)
 *     → on failure, shows error message
 *
 * This is an external module (not inline) to comply with CSP.
 */

import { getInviteVerifyUrl, verifyInviteKey } from './auth-helpers.js';

// DOM elements
const registerBtn = document.getElementById('register-btn');
const inviteModal = document.getElementById('invite-modal');
const inviteKeyInput = document.getElementById('invite-key-input');
const inviteSubmitBtn = document.getElementById('invite-submit');
const inviteCancelBtn = document.getElementById('invite-cancel');
const inviteError = document.getElementById('invite-error');

// Show the invite key modal when Register is clicked
if (registerBtn) {
  registerBtn.addEventListener('click', () => {
    inviteModal.style.display = 'flex';
    inviteKeyInput.value = '';
    inviteError.style.display = 'none';
    inviteKeyInput.focus();
  });
}

// Hide modal when Cancel is clicked
if (inviteCancelBtn) {
  inviteCancelBtn.addEventListener('click', () => {
    inviteModal.style.display = 'none';
  });
}

// Also hide modal when clicking outside the modal content
if (inviteModal) {
  inviteModal.addEventListener('click', (e) => {
    if (e.target === inviteModal) {
      inviteModal.style.display = 'none';
    }
  });
}

// Validate invite key and redirect to signup on success
if (inviteSubmitBtn) {
  inviteSubmitBtn.addEventListener('click', async () => {
    const key = inviteKeyInput.value.trim();

    if (!key) {
      inviteError.textContent = 'Please enter an invite key.';
      inviteError.style.display = 'block';
      return;
    }

    const inviteVerifyUrl = getInviteVerifyUrl();
    if (!inviteVerifyUrl) {
      inviteError.textContent = 'Unable to verify invite key. Please try again.';
      inviteError.style.display = 'block';
      return;
    }

    inviteError.style.display = 'none';
    inviteSubmitBtn.disabled = true;
    inviteSubmitBtn.textContent = 'Verifying...';

    try {
      const result = await verifyInviteKey(key);

      if (result.valid) {
        // invite_key is stored by verifyInviteKey
        // Redirect to signup page
        window.location.href = '/signup';
      } else {
        inviteError.textContent = result.error || 'Invalid invite key. Please try again.';
        inviteError.style.display = 'block';
        inviteSubmitBtn.disabled = false;
        inviteSubmitBtn.textContent = 'Continue';
      }
    } catch (err) {
      inviteError.textContent = 'Unable to verify invite key. Please try again.';
      inviteError.style.display = 'block';
      inviteSubmitBtn.disabled = false;
      inviteSubmitBtn.textContent = 'Continue';
    }
  });
}

// Allow pressing Enter in the invite key input to submit
if (inviteKeyInput) {
  inviteKeyInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      inviteSubmitBtn.click();
    }
  });
}
