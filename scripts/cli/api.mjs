// scripts/cli/api.mjs
// Thin authenticated fetch wrapper over /api/combat/*
// Uses PORTALCOLOSSEUM_BASE_URL or default, JWT from auth

import { getAccessToken } from './auth.mjs';

const BASE = process.env.PORTALCOLOSSEUM_BASE_URL || 'https://portalcolosseum.com';

export async function apiCall(method, path, body = null, timeoutMs = 15000) {
  const token = await getAccessToken();
  if (!token) {
    const err = new Error('Not authenticated — use login first or set PORTALCOLOSSEUM_JWT');
    err.status = 401;
    throw err;
  }
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE}/api/combat${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : null,
      signal: controller.signal,
    });
    clearTimeout(t);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = data.error || res.statusText;
      const err = new Error(msg);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  } catch (e) {
    clearTimeout(t);
    if (e.name === 'AbortError') throw new Error(`timeout on ${method} ${path}`);
    throw e;
  }
}
