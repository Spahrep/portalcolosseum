# Portal Colosseum - Supabase Auth Setup

## Why Supabase?
- Free generous tier (perfect for indie game)
- Built-in OAuth (Google, GitHub, Discord, etc.)
- Email + Password / Magic Links
- PostgreSQL database included (for player profiles, inventory, future systems)
- Excellent JavaScript client that works with static sites
- Row Level Security (RLS) for secure data access
- Scales to realtime multiplayer later if needed

This replaces the placeholder "code 1234" login with real accounts.

## Step 1: Create Supabase Project (one-time)

1. Go to https://supabase.com and sign up / log in (free)
2. Click "New Project"
3. Name it `portal-colosseum`
4. Choose a region close to you
5. Set a strong database password (save it!)
6. Wait ~2 minutes for provisioning

## Step 2: Get Your Keys

In your Supabase dashboard:
- Go to **Settings** → **API**
- Copy:
  - `Project URL` (looks like https://xxxxx.supabase.co)
  - `anon` `public` key (starts with `eyJ...` — this one is safe to put in frontend)

## Step 3: Enable Auth Providers (OAuth)

We recommend starting with:
- **Google** (easy for most players)
- **GitHub** (great for devs)
- Optional: Discord, Twitter, etc.

### For Google OAuth:
1. In Supabase: **Authentication** → **Providers** → Enable **Google**
2. You'll need to create OAuth credentials in Google Cloud Console:
   - https://console.cloud.google.com/apis/credentials
   - Create OAuth 2.0 Client ID (Web application)
   - Authorized redirect URI: `https://xxxxx.supabase.co/auth/v1/callback`
3. Paste Client ID + Secret into Supabase Google provider settings
4. Save

Do the same for GitHub if desired (even easier setup).

## Step 4: Configure Site URL (important for redirects)

In Supabase **Authentication** → **URL Configuration**:
- Site URL: `https://portalcolosseum.com` (or your Vercel preview URL during dev)
- Add redirect URLs: `https://portalcolosseum.com/**`

## Step 5: Update the Code

After you have the keys, edit `login.html` and replace the placeholders:

```js
const SUPABASE_URL = 'https://YOUR-PROJECT-ID.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
```

The code is already updated to use these.

## Step 6: Deploy

Commit and push — Vercel will redeploy automatically.

```bash
git add .
git commit -m "feat: Add Supabase authentication"
git push
```

## Future Enhancements (when ready)
- Store player stats, inventory in Supabase tables with RLS
- Use Supabase Realtime for live arena battles
- Add username uniqueness check on signup
- Profile page for character customization

## Troubleshooting
- "Invalid API key" → Double-check you used the `anon` key, not service_role
- Redirect loop → Make sure Site URL + redirect URLs are configured in Supabase
- OAuth not working → Check the exact callback URL in provider console

---

**Next step for us:** Once keys are in, test login flow together. Then we can move on to saving player progress!
