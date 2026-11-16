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

## Scaling Socket.io Horizontally
When running multiple `apps/server` instances behind a load balancer (Nginx / Cloudflare / AWS ALB):
1. **Enable Sticky Sessions** (cookie or IP hash) for Socket.io long-polling handshake (`/socket.io/`).
2. **Use `@socket.io/redis-adapter`** with `REDIS_URL` so room broadcasts (`io.to('room:CODE').emit(...)`) and user notifications (`io.to('user:ID').emit(...)`) propagate across all server instances.
3. Keep `RoomManager` / `GameManager` state in a single shard per room or back room routing with Redis sticky-session affinity.
