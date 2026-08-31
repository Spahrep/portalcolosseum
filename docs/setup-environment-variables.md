# Vercel Environment Variables Setup

This document explains how to configure the environment variables required for Portal Colosseum's auth system to work in Vercel.

## Why Environment Variables?

The Supabase URL and anonymous key are now loaded from environment variables instead of being hardcoded in the HTML files. This follows security best practices by:

1. **Separating configuration from code** - The same source files work across environments (dev, staging, prod).
2. **Preventing accidental exposure** - Credentials don't live in version control.
3. **Enabling easy key rotation** - Update a key in Vercel dashboard without touching code.

## Required Environment Variables

| Variable | Description | Example |
| --- | --- | --- |
| `SUPABASE_URL` | Your Supabase project URL | `https://tfwwapxewlxiclufpcct.supabase.co` |
| `SUPABASE_ANON_KEY` | Your Supabase anonymous/public API key | `sb_publishable_...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase service_role key (for the `/api/session` Edge Function only — never exposed to the browser) | `sb_secret_...` or legacy key |

## How It Works

1. **`public/env.js`** (served at `/env.js`) reads the placeholder values and makes them available via `window.ENV`.
2. All HTML pages include a `<script src="/env.js">` tag before their main scripts.
3. The JS reads config via:
   ```js
   const SUPABASE_URL = window.ENV.SUPABASE_URL;
   const SUPABASE_ANON_KEY = window.ENV.SUPABASE_ANON_KEY;
   ```

> **Note:** The `anon` key is intended for client-side use in Supabase's security model. It only has permissions granted by your Row Level Security (RLS) policies. The `service_role` key (if you had it) should **never** be used in client-side code.

## Setting Up in Vercel

### Via Vercel Dashboard (Recommended):

1. Go to your project at [vercel.com/dashboard](https://vercel.com/dashboard)
2. Select your project (e.g., `portalcolosseum`)
3. Click **Settings** → **Environment Variables**
4. Click **Add** and create each variable:
   - Name: `SUPABASE_URL`  
     Value: `https://tfwwapxewlxiclufpcct.supabase.co`  
     Environment: `Production`, `Preview`, `Development`
   - Name: `SUPABASE_ANON_KEY`  
     Value: `[your anon key from Supabase dashboard]`  
     Environment: `Production`, `Preview`, `Development`
   - Name: `SUPABASE_SERVICE_ROLE_KEY`  
     Value: `[your service_role key from Supabase dashboard → Settings → API]`  
     Environment: `Production`, `Preview`, `Development`  
     > **Important:** This key bypasses RLS. Only used in the `/api/session` Edge Function, never exposed to the browser.

### Via Vercel CLI:

```bash
vercel env add SUPABASE_URL
vercel env add SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY
```

## How env.js Gets the Values

Vercel does **not** automatically replace `%VAR%` placeholders. The current `env.js` template contains placeholder text (`%SUPABASE_URL%`). You need to update your build step or manually replace these.

### Option A: Build-time injection (via `vercel.json`)

Add a build command that replaces the placeholders:

```json
// In vercel.json
{
  "builds": [
    {
      "src": "package.json",
      "use": "vercel/static"
    }
  ],
  "routes": [
    // ... your existing routes
  ]
}
```

And create a simple build script that replaces the placeholders:

```bash
sed -i "s|%SUPABASE_URL%|${SUPABASE_URL}|g" public/env.js
sed -i "s|%SUPABASE_ANON_KEY%|${SUPABASE_ANON_KEY}|g" public/env.js
```

### Option B: Runtime injection via serverless function (Recommended)

Create an API route (`/api/env.js`) that serves the env.js file with actual values populated from Vercel's environment:

```js
// api/env.js
module.exports = (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.status(200).send(`
    window.ENV = window.ENV || {};
    window.ENV.SUPABASE_URL = "${process.env.SUPABASE_URL || ''}";
    window.ENV.SUPABASE_ANON_KEY = "${process.env.SUPABASE_ANON_KEY || ''}";
  `);
};
```

Then update the HTML `<script>` tag to point to this API route:
```html
<script src="/api/env.js"></script>
```

## Gotchas

- **Order matters:** The `/env.js` script must load **before** any script that uses `window.ENV.*`.
- **Local development:** When running locally, you can set placeholder values in `env.js` directly.
