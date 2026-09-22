/**
 * /api/config.js
 * ==============
 * Vercel serverless endpoint for game-wide config.
 * Returns JSON with debug/feature flags from the game_config DB table.
 * Direct fetch to Supabase REST API — avoids esm.sh import limitations.
 *
 * GET /api/config → { debug: true, ... }
 */
const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS });
}

export async function GET() {
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return json({ error: 'Server config missing' }, 500);
    }

    // Direct REST API call — no client library needed
    const url = `${supabaseUrl}/rest/v1/game_config?id=eq.1&select=debug`;
    const res = await fetch(url, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Accept': 'application/json',
      },
    });

    if (!res.ok) {
      return json({ error: `DB query failed: ${res.status}` }, 500);
    }

    const data = await res.json();
    const row = Array.isArray(data) ? data[0] : data;
    return json({ debug: row?.debug === true });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}