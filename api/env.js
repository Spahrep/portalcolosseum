/**
 * Portal Colosseum - Environment Configuration API Endpoint
 * ===========================================================
 * Serverless function that serves the Supabase configuration to the client.
 * This allows us to keep sensitive values out of the static source files.
 *
 * Accessed at: https://portalcolosseum.com/api/env.js
 * Included in HTML pages via: <script src="/api/env.js"></script>
 *
 * Environment variables are set in Vercel project settings:
 *   - SUPABASE_URL: Supabase project URL
 *   - SUPABASE_ANON_KEY: Supabase anonymous API key
 *
 * @param {import('@vercel/node').VercelRequest} req - The HTTP request
 * @param {import('@vercel/node').VercelResponse} res - The HTTP response
 */
module.exports = (req, res) => {
  // Set content type to JavaScript
  res.setHeader('Content-Type', 'application/javascript');

  // Security: no-store prevents intermediate CDNs from caching different
  // preview deployments' config envelopes (each preview has distinct keys)
  res.setHeader('Cache-Control', 'no-store, max-age=0, must-revalidate');

  // Build the JS that populates window.ENV with values from Vercel env vars
  // The anon key is designed for client-side use (limited permissions per RLS)
  const supabaseUrl = process.env.SUPABASE_URL || '';
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';

  const js = `
// Environment configuration - injected by Vercel serverless function
// Values come from Vercel environment variables, never from source code
window.ENV = window.ENV || {};
window.ENV.SUPABASE_URL = ${JSON.stringify(supabaseUrl)};
window.ENV.SUPABASE_ANON_KEY = ${JSON.stringify(supabaseAnonKey)};

// Validate that required config is present
if (!window.ENV.SUPABASE_URL || !window.ENV.SUPABASE_ANON_KEY) {
  console.warn('[env.js] Missing SUPABASE_URL or SUPABASE_ANON_KEY in environment.');
}
`.trim();

  res.status(200).send(js);
};
