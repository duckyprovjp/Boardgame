# Bàn Chơi Trực Tuyến (Multiplayer Card & Party Games Platform)

Realtime multiplayer card & party games platform built with Next.js App Router, Express, Socket.io, Prisma (Supabase PostgreSQL), TypeScript (strict), and Zod.

## Monorepo Structure

- `apps/web` — Next.js App Router + Tailwind CSS (Vietnamese UI)
- `apps/server` — Node.js + Express + Socket.io + Prisma (server-authoritative)
- `packages/shared` — Shared TypeScript types, Zod schemas, and `GameModule` interface

## Prerequisites

- Node.js >= 20
- `pnpm` >= 9
- A PostgreSQL database (configured via Supabase in `.env`)

## Setup & Run

1. Copy `.env.example` to `.env` and fill in your `DATABASE_URL` (Supabase PostgreSQL connection string):
   ```bash
   cp .env.example .env
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Build shared package, generate Prisma client, and push schema to Supabase:
   ```bash
   pnpm --filter @boardgame/shared build
   pnpm db:generate
   pnpm db:push
   ```

4. Start development servers (web on `http://localhost:3000`, server on `http://localhost:4000`):
   ```bash
   pnpm dev
   ```

## Useful Commands

- `pnpm test` — Run unit tests (Vitest)
- `pnpm typecheck` — Type-check all workspace packages
- `pnpm lint` — Run ESLint across the monorepo
- `pnpm format:check` — Check formatting with Prettier
- `pnpm build` — Build all packages and apps
