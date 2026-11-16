# Deployment Guide (`My-boardgame`)

Architecture:
- **Web (`apps/web`)**: Next.js App Router on **Vercel**
- **Server (`apps/server`)**: Node.js + Express + Socket.io (single instance) on **Render**
- **Database**: **Supabase Postgres** via **Prisma ORM** (cookie-session auth + Socket.io; no Supabase Auth/Realtime/JS client)
- **Redis (Phase 8+ only)**: **Upstash** (not required before Phase 8; matchmaking falls back to in-memory)

---

## 1. Push the Repository to GitHub

1. Create a new repository on GitHub (public or private).
2. Verify `.env` is **not** tracked (`git status` should never show `.env`).
3. Commit and push your branch (e.g. `main`):
   ```bash
   git add .
   git commit -m "Prepare production deployment"
   git push -u origin main
   ```

---

## 2. Supabase Postgres Setup

1. Open your project in the **Supabase Dashboard** and click **Connect** (top bar, or **Project Settings -> Database**).
2. Under **Connection string**, select **Type: URI** and **Method: Transaction pooler** (port `6543`):
   - Copy the URI, replace `[YOUR-PASSWORD]` with your database password, and append `?pgbouncer=true&connection_limit=1`:
     ```text
     postgresql://postgres.<PROJECT_REF>:<URL_ENCODED_PASSWORD>@aws-0-<REGION>.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
     ```
   - This is your **`DATABASE_URL`** (used by the running server).
3. Switch **Method** to **Session pooler** (port `5432`, IPv4-compatible):
   - Copy the URI and replace `[YOUR-PASSWORD]` with your database password:
     ```text
     postgresql://postgres.<PROJECT_REF>:<URL_ENCODED_PASSWORD>@aws-0-<REGION>.pooler.supabase.com:5432/postgres
     ```
   - This is your **`DIRECT_URL`** (used **only** by `prisma migrate deploy`).
   - **Do NOT use** the direct `db.<ref>.supabase.co` host — it is IPv6-only on many plans and will fail from Render.
4. **URL-encode special characters in your password**:
   - If your database password contains characters such as `@`, `:`, `/`, `#`, `?`, `&`, `%`, `+`, or spaces, you must percent-encode them (for example `@` -> `%40`, `#` -> `%23`, `/` -> `%2F`).
5. **Supabase Security (Row Level Security)**:
   - Migration `202611160002_enable_rls` enables Row Level Security (RLS) on every table in the `public` schema **without** creating any policies.
   - This blocks Supabase's auto-generated REST/GraphQL API from exposing any data to the `anon` key, while Prisma (connecting as the database owner role) continues to work normally.
   - **Never** add `SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, or `SUPABASE_SERVICE_ROLE_KEY` to `apps/web` or `apps/server`.

---

## 3. Render Setup (Server — `apps/server`)

You can deploy either via **Blueprint** (recommended, uses `render.yaml` at the repo root) or manually as a **Web Service**:

### Option A: Blueprint (`render.yaml`)
1. In the **Render Dashboard**, click **New + -> Blueprint**.
2. Connect your GitHub repository and select the `main` branch.
3. Render reads `render.yaml` (`rootDir: apps/server`, `runtime: node`, `healthCheckPath: /health`).
4. Enter the secret environment variables marked `sync: false` (see Section 5), then click **Apply**.

### Option B: Manual Web Service
1. In the **Render Dashboard**, click **New + -> Web Service** and connect your GitHub repository.
2. Configure:
   - **Runtime**: `Node`
   - **Root Directory**: `apps/server`
   - **Build Command**:
     ```bash
     cd ../.. && pnpm install --frozen-lockfile && pnpm build:server && pnpm --filter @boardgame/server db:migrate:deploy
     ```
   - **Start Command**:
     ```bash
     pnpm start
     ```
   - **Health Check Path**: `/health`
3. Add the environment variables from Section 5 and deploy.
4. Confirm the `/health` endpoint returns HTTP `200` (`{"ok":true,"service":"boardgame-server",...}`).

> **Free-tier warning**: Render's Free Web Service spins down after ~15 minutes of inactivity. Spinning down drops all active Socket.io connections and kills in-memory game rooms, and cold starts take ~30–60 seconds. Upgrade to a paid always-on instance (e.g. **Starter**) before real players use the app.

---

## 4. Vercel Setup (Web — `apps/web`)

1. In the **Vercel Dashboard**, click **Add New... -> Project** and import your GitHub repository.
2. In **Configure Project**:
   - **Framework Preset**: `Next.js`
   - **Root Directory**: click **Edit** and set it to `apps/web`.
3. After importing (or under **Project Settings -> General / Build & Development Settings**):
   - Verify **Include source files outside of the Root Directory in the Build Step** is **enabled** (required so `apps/web` can build `packages/shared`).
   - `apps/web/vercel.json` already sets the monorepo `installCommand` and `buildCommand` (`pnpm build:web`).
4. Under **Environment Variables**, add `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_SOCKET_URL` (see Section 5).
5. Click **Deploy**.

---

## 5. Environment Variables Reference

| Variable | Platform | Value / Source |
| --- | --- | --- |
| `NODE_ENV` | Render | `production` |
| `DATABASE_URL` | Render | Supabase **Transaction Pooler** URI (port `6543`) with `?pgbouncer=true&connection_limit=1` |
| `DIRECT_URL` | Render | Supabase **Session Pooler** URI (port `5432`, IPv4-compatible) |
| `SESSION_SECRET` | Render | Random 32+ character string you generate locally (e.g. `openssl rand -hex 32` or `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`) |
| `WEB_ORIGIN` | Render | Exact origin of the web app, e.g. `https://app.yourdomain.com` (never `*`) |
| `COOKIE_DOMAIN` | Render | Shared parent domain with leading dot, e.g. `.yourdomain.com` (leave blank if no custom domain) |
| `REDIS_URL` | Render | *(Phase 8+ only)* Upstash Redis TLS URL (`rediss://...`); omit for earlier phases |
| `NEXT_PUBLIC_API_URL` | Vercel | Public URL of the Render server, e.g. `https://api.yourdomain.com` |
| `NEXT_PUBLIC_SOCKET_URL` | Vercel | Same public URL of the Render server, e.g. `https://api.yourdomain.com` |

> **Important**: `NEXT_PUBLIC_*` variables are embedded at **build time** by Next.js. Whenever you change `NEXT_PUBLIC_API_URL` or `NEXT_PUBLIC_SOCKET_URL` on Vercel, trigger a **Redeploy** so the new bundle picks them up.

---

## 6. Custom Domain & Cookie Configuration

### Recommended: One Root Domain, Two Subdomains
Attach a single root domain (e.g. `yourdomain.com`) with two subdomains so `bg_session` cookies are **first-party** across both services:
1. **`app.yourdomain.com`** (or `www.yourdomain.com`) -> **Vercel** (add in Vercel Project **Settings -> Domains** and create the CNAME/A record at your DNS provider).
2. **`api.yourdomain.com`** -> **Render** (add in Render Service **Settings -> Custom Domains** and create the CNAME record at your DNS provider).
3. Set:
   - `WEB_ORIGIN=https://app.yourdomain.com` (Render)
   - `COOKIE_DOMAIN=.yourdomain.com` (Render)
   - `NEXT_PUBLIC_API_URL=https://api.yourdomain.com` (Vercel)
   - `NEXT_PUBLIC_SOCKET_URL=https://api.yourdomain.com` (Vercel)

### Fallback if You Have No Custom Domain
If Vercel is on `*.vercel.app` and Render is on `*.onrender.com`:
- **Warning**: Cross-site cookies between `.vercel.app` and `.onrender.com` are blocked by **Safari / iOS** (Intelligent Tracking Prevention) and fail with `SameSite=Lax` in modern browsers.
- **Fallback design** (if you need to deploy without a custom domain):
  1. Have the API (`/api/auth/login`, `/api/auth/register`, `/api/auth/guest`) also return a short-lived HMAC-signed token in the JSON response.
  2. Store that token in memory on the client and send it in the Socket.io handshake `auth: { token }` field (and `Authorization: Bearer <token>` header for API calls) instead of relying on cross-site cookies.
