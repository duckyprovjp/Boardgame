FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/server/package.json apps/server/

RUN pnpm install --frozen-lockfile --filter @boardgame/shared --filter @boardgame/server

COPY packages/shared packages/shared
COPY apps/server apps/server

RUN pnpm --filter @boardgame/shared build
RUN pnpm --filter @boardgame/server db:generate
RUN pnpm --filter @boardgame/server build

ENV NODE_ENV=production
EXPOSE 4000
CMD ["node", "apps/server/dist/index.js"]
