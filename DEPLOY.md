# Production Deployment Guide

## Architecture
- **Web (`apps/web`)**: Next.js App Router on port `3000`
- **Server (`apps/server`)**: Express + Socket.io on port `4000`
- **Database**: PostgreSQL (Supabase or self-hosted Postgres) via `DATABASE_URL`
- **Cache / Matchmaking**: Redis (`REDIS_URL`)

## Environment Variables
Configure `.env` (never commit `.env` to Git):
```env
PORT=4000
CORS_ORIGIN=https://your-domain.com
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/postgres"
REDIS_URL="redis://redis:6379"
NEXT_PUBLIC_API_URL=https://api.your-domain.com
NEXT_PUBLIC_SOCKET_URL=https://api.your-domain.com
```

## Build & Run with Docker Compose
```bash
docker compose -f docker-compose.prod.yml up -d --build
```

## Deploy with Render (Blueprint)
1. Push this repository (including `render.yaml`) to GitHub.
2. In the [Render Dashboard](https://dashboard.render.com/), click **New + → Blueprint** and select `duckyprovjp/Boardgame`.
3. Render will create both `boardgame-server` (Express + Socket.io) and `boardgame-web` (Next.js).
4. Fill in the prompted environment variables:
   - `boardgame-server`:
     - `DATABASE_URL`: Your Supabase PostgreSQL connection string
     - `CORS_ORIGIN`: Your `boardgame-web` URL (e.g. `https://boardgame-web.onrender.com`)
   - `boardgame-web`:
     - `NEXT_PUBLIC_API_URL`: Your `boardgame-server` URL (e.g. `https://boardgame-server.onrender.com`)
     - `NEXT_PUBLIC_SOCKET_URL`: Same as `NEXT_PUBLIC_API_URL`

## Scaling Socket.io Horizontally
When running multiple `apps/server` instances behind a load balancer (Nginx / Cloudflare / AWS ALB):
1. **Enable Sticky Sessions** (cookie or IP hash) for Socket.io long-polling handshake (`/socket.io/`).
2. **Use `@socket.io/redis-adapter`** with `REDIS_URL` so room broadcasts (`io.to('room:CODE').emit(...)`) and user notifications (`io.to('user:ID').emit(...)`) propagate across all server instances.
3. Keep `RoomManager` / `GameManager` state in a single shard per room or back room routing with Redis sticky-session affinity.
