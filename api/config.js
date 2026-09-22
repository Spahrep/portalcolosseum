/**
 * /api/config.js
 * ==============
 * Vercel serverless endpoint for game-wide config.
 * Returns JSON with debug/feature flags from the game_config DB table.
 * No auth required — these are public client-side toggles.
 *
 * GET /api/config → { debug: true, ... }
 */

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': 'https://portalcolosseum.com',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS });
}

export async function GET() {
  try {
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.112.4');
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return json({ error: 'Server config missing' }, 500);
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data, error } = await supabase
      .from('game_config')
      .select('debug')
      .eq('id', 1)
      .single();

    if (error) {
      return json({ error: error.message }, 500);
    }

    return json({ debug: data?.debug === true });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}