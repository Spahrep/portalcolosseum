// scripts/cli/auth.mjs
// Supabase auth for Node, session persisted at ~/.config/portalcolosseum/session.json (0600)
// Supports PORTALCOLOSSEUM_JWT (direct token), env SUPABASE_*, signInWithPassword, refresh, logout

import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, chmodSync, mkdirSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import readline from 'readline';

const CONFIG_DIR = join(homedir(), '.config', 'portalcolosseum');
const SESSION_FILE = join(CONFIG_DIR, 'session.json');
const CURRENT_RUN_FILE = join(CONFIG_DIR, 'current-run');
const DEV_MODE_FILE = join(CONFIG_DIR, 'dev-mode');

function ensureConfigDir() {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  }
}

function getSupabaseClient() {
  const url = process.env.PORTALCOLOSSEUM_SUPABASE_URL;
  const anonKey = process.env.PORTALCOLOSSEUM_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error('Missing PORTALCOLOSSEUM_SUPABASE_URL or PORTALCOLOSSEUM_SUPABASE_ANON_KEY');
  }
  return createClient(url, anonKey, {
    auth: { autoRefreshToken: true, persistSession: false },
  });
}

export function loadSession() {
  try {
    if (!existsSync(SESSION_FILE)) return null;
    const raw = readFileSync(SESSION_FILE, 'utf8');
    const session = JSON.parse(raw);
    if (session.access_token) return session;
    return null;
  } catch {
    return null;
  }
}

export function saveSession(session) {
  ensureConfigDir();
  const json = JSON.stringify(session, null, 2);
  writeFileSync(SESSION_FILE, json, { mode: 0o600 });
  chmodSync(SESSION_FILE, 0o600);
}

export function clearSession() {
  try {
    if (existsSync(SESSION_FILE)) {
      // overwrite then unlink for safety
      writeFileSync(SESSION_FILE, '', { mode: 0o600 });
    }
  } catch {}
  // also clear current run on logout
  try {
    if (existsSync(CURRENT_RUN_FILE)) {
      writeFileSync(CURRENT_RUN_FILE, '', { mode: 0o600 });
    }
  } catch {}
}

export function loadDevMode() {
  try {
    if (!existsSync(DEV_MODE_FILE)) return false;
    return readFileSync(DEV_MODE_FILE, 'utf8').trim() === '1';
  } catch {
    return false;
  }
}

export function saveDevMode(v) {
  try {
    ensureConfigDir();
    writeFileSync(DEV_MODE_FILE, v ? '1' : '0', { mode: 0o600 });
  } catch {}
}

export function clearDevMode() {
  try {
    if (existsSync(DEV_MODE_FILE)) writeFileSync(DEV_MODE_FILE, '0', { mode: 0o600 });
  } catch {}
}

export async function login(email, password) {
  if (!email || !password) {
    // interactive prompt
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    email = await new Promise(r => rl.question('Email: ', r));
    password = await new Promise(r => { rl.question('Password: ', ans => { rl.close(); r(ans); }); });
  }
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw new Error(error.message);
  const session = {
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_at: data.session.expires_at,
    user: { id: data.user.id, email: data.user.email },
  };
  saveSession(session);
  return session;
}

export async function logout() {
  clearSession();
  return true;
}

export async function getAccessToken() {
  const envJwt = process.env.PORTALCOLOSSEUM_JWT;
  if (envJwt) return envJwt.trim();

  let session = loadSession();
  if (!session) return null;

  // basic refresh if expired (simple check)
  if (session.expires_at && Date.now() / 1000 > session.expires_at - 60) {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.auth.refreshSession({ refresh_token: session.refresh_token });
      if (!error && data.session) {
        session = {
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          expires_at: data.session.expires_at,
          user: session.user,
        };
        saveSession(session);
      }
    } catch {}
  }
  return session.access_token || null;
}

export function getCurrentRunId() {
  try {
    if (!existsSync(CURRENT_RUN_FILE)) return null;
    const id = readFileSync(CURRENT_RUN_FILE, 'utf8').trim();
    return id || null;
  } catch { return null; }
}

export function saveCurrentRunId(id) {
  ensureConfigDir();
  writeFileSync(CURRENT_RUN_FILE, String(id), { mode: 0o600 });
  chmodSync(CURRENT_RUN_FILE, 0o600);
}

export function clearCurrentRunId() {
  try {
    if (existsSync(CURRENT_RUN_FILE)) writeFileSync(CURRENT_RUN_FILE, '', { mode: 0o600 });
  } catch {}
}
