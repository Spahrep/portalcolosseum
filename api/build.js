/**
 * /api/build.js
 * =============
 * Vercel serverless endpoint that reports the commit SHA of the running
 * deployment. VERCEL_GIT_COMMIT_SHA is injected by Vercel at runtime, so this
 * is always the exact commit that shipped — no build-time stamping needed.
 *
 * GET /api/build → { sha: "f1eb319", full: "f1eb319dd1da..." }
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
  const full = process.env.VERCEL_GIT_COMMIT_SHA || '';
  return json({
    sha: full.slice(0, 7),
    full,
  });
}
