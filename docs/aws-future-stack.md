# AWS Deployment Strategy & Future Stack

## Current Reality
Portal Colosseum is currently deployed on Vercel as a static site:
- Static HTML/CSS/JS frontend (login, signup, game UI)
- Supabase for authentication, database, and session management
- Two small Vercel Edge Functions: `/api/env.js` and `/api/session.js`
- No server infrastructure to manage

## AWS Architecture (When Ready to Migrate)

```
[Domain Name] → [Route 53 DNS] → [CloudFront CDN] → [S3 Static Site]
                                    │
                                    ├── Lambda@Edge (SSR, headers, auth)
                                    └── API Gateway + Lambda (game logic)
```

## Why Migrate to AWS?

### Rationale for Full AWS Stack
1. **Single Dashboard** — One place to manage DNS, CDN, storage, and compute
2. **Seamless Integration** — Route 53 → CloudFront → S3 all work natively with zero config friction
3. **Better Performance** — Route 53 edge locations + CloudFront edge computing reduce latency
4. **Unified Billing** — One AWS invoice for all services
5. **Scalable Game Features** — When game logic is added, Lambda/API Gateway integrate natively
6. **SSL Certificate Management** — ACM certificates auto-validate when DNS is in Route 53
7. **Future-Proof** — All AWS services interoperate (monitoring, security, scaling)

## Components

### Tier 1: Static Assets
- **S3 Bucket** — Host static files (HTML, CSS, JS, images, fonts)
- **CloudFront** — CDN fronting S3 for global low-latency delivery
- **Route 53** — DNS management (managed zone ~$0.50/month)

**Migration Steps:**
1. Create Route 53 hosted zone for domain
2. Update nameservers at domain registrar (Namecheap) to Route 53 nameservers
3. Create S3 bucket for static website hosting
4. Create CloudFront distribution pointing to S3 as origin
5. Configure DNS records in Route 53 (apex + www CNAME/A records)
6. Upload static files to S3
7. Invalidate CloudFront cache after deployments

### Tier 2: Dynamic Game Backend (Future)
**TypeScript/Node.js Lambda + API Gateway**
- Same language as client code (JavaScript/TypeScript)
- Native Supabase JS SDK support
- Lambda cold starts acceptable for PVE game operations
- Scales automatically to match player population

**Server responsibilities:**
- Enemy generation (server-authoritative random rolls using documented distributions from `docs/weapon-generation.md` and `docs/combat-system.md`)
- Weapon drop calculations (based on `docs/loot-prize-pool.md`)
- Gold transaction processing with inventory management (`docs/ap-economy.md`)
- Portal run state management (`docs/portal-runs.md`)
- AP economy daily resets and gating (`docs/ap-economy.md`)

**Deployment escalation path:**
1. Lambda + API Gateway — handles all game state operations (starting point)
2. Lambda + WebSockets API Gateway — if real-time combat feedback needed (tic-based combat from `docs/combat-system.md`)
3. ECS/Fargate — only if Lambda's 15-minute timeout or cold starts become limiting

### Tier 3: Database (External)
- **Keep using Supabase** as your PostgreSQL provider
- Create tables matching `docs/naming-convention.md` naming convention:
  - `user` / `profiles` (UUID PK — links to Supabase auth.users)
  - `weapon_template` (BIGINT PK — game data, readable for debugging)
  - `attack_pool` (BIGINT PK — attack definitions)
  - `weapon_instance` (BIGINT PK — instantiated weapons with rolled stats)
  - `portal_run` (BIGINT PK — player run progress tracking)
  - `player_run_state` (BIGINT PK — in-progress combat state)
  - `inventory_item` (BIGINT PK — player carried items)
  - Future: `match`, `element`, `weapon_type`
- Use RLS (Row Level Security) for player data isolation
- Supabase Edge Functions continue to handle auth/session bridging

## Cost Analysis (Minimal Setup)

| Component | Free Tier | Paid Tier (Beyond Usage) |
|---|---|---|
| S3 Hosting | 12 months free | ~1.5GB storage + 15GB transfer |
| CloudFront | 12 months free | ~1TB transfer |
| Route 53 | None | $0.50/zone + $0.40/million queries |
| Lambda | 12 months free | ~1M requests |
| ACM Certificates | Always free | $0.00 |

**Estimated Monthly Cost (Low Traffic):**
- Phase 1 (Static Only): ~$0.50 - $1.00/month
  - Route 53 Hosted Zone: $0.50
  - Minimal CloudFront/S3 charges within free tier
- Phase 2 (With Game Logic): ~ $5 - $10/month
  - Lambda invocations for game state operations
  - Still mostly within AWS free tier for indie-scale usage
- Phase 3 (10K+ DAU): ~$25 - $150/month
  - CloudFront bandwidth becomes dominant cost
  - Lambda scales automatically

## AWS Free Tier Benefits
- S3: 5GB storage + 15GB data transfer out free for 12 months
- CloudFront: 1TB data transfer out free monthly
- Lambda: 1M requests + 400,000 GB-s free per month (no time limit)
- Route 53: No free tier, but minimal cost (~$0.50/month)

## Migration Strategy

### Phase 1: Static Site Migration (Immediate)
1. Create S3 bucket
2. Enable CloudFront distribution
3. Set up Route 53 DNS (requires updating nameservers at Namecheap)
4. Transfer all static assets from Vercel to S3
5. Configure caching headers and invalidations

### Phase 2: Game Backend (When combat/progression is implemented)
1. Create Lambda functions for game state operations
2. Front with API Gateway (REST or WebSocket for real-time combat)
3. Use Lambda environment variables for Supabase credentials
4. Implement authoritative server-side game logic:
   - Enemy generation (using procedural distributions from docs)
   - Loot roll calculations (weapon-generation.md, loot-prize-pool.md)
   - Gold transactions with inventory management (ap-economy.md)
   - Portal run state persistence (portal-runs.md)
5. Persist run state in Supabase via Lambda → Supabase SDK

### Phase 3: Advanced Features
1. Add ElastiCache (Redis) for in-run combat state (only if needed)
2. Configure CloudWatch monitoring/alerting
3. Set up CI/CD pipeline (CodePipeline) for automated deployments

## What to Avoid
| Option | Why Not |
|---|---|
| **Nginx web server** | Unnecessary with S3 + CloudFront (managed static serving is better) |
| **Python backend** | Adds polyglot complexity — Node.js Lambda integrates natively with existing JS/Supabase stack |
| **Self-hosted Supabase** | Hosted Supabase scales on free tier — no need to manage Postgres/Kong/GoTrue |
| **EC2 instances** | Unnecessary for serverless approach — Lambda handles scaling automatically |

## Key Implementation Notes

### S3 Static Site Configuration
- Bucket name must match domain name exactly (e.g., `portalcolosseum.com`)
- Enable "Static Website Hosting" on bucket
- Update bucket policy to allow CloudFront OAI to read objects

### CloudFront Configuration
- Use OAI (Origin Access Identity) to restrict S3 access to CloudFront only
- Set default TTL to 0 (no caching) for `/api/*` paths
- Set longer TTLs for static assets (`/assets/*`, images, etc.)

### DNS Transition (Important)
When switching from Namecheap DNS to Route 53:
1. Create ALL records in Route 53 FIRST (with same values as Namecheap)
2. ONLY THEN update nameservers at Namecheap
3. This prevents any downtime during the transition

## Bottom Line
The same game code runs on AWS with minimal configuration changes. The biggest lift is the DNS transition (updating nameservers at Namecheap), which is a one-time ~30 second change.

No Nginx. No Python. No self-hosted database — unless you specifically need ML libraries for procedural generation (your documented distributions don't require it).

---
*Document created: 2026-09-01*