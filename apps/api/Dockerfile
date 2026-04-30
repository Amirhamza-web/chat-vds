FROM node:20-bookworm-slim AS base
ENV PNPM_HOME=/root/.pnpm \
    PATH=/root/.pnpm:$PATH \
    NODE_ENV=production
RUN corepack enable && corepack prepare pnpm@9.15.1 --activate
RUN apt-get update -y && apt-get install -y --no-install-recommends \
      openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# ──────── deps ────────
FROM base AS deps
COPY package.json pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile=false --prod=false

# ──────── builder ────────
FROM deps AS builder
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @chat-vds/api prisma:generate
RUN pnpm --filter @chat-vds/shared build || true
RUN pnpm --filter @chat-vds/api build

# ──────── runtime ────────
FROM base AS runtime
WORKDIR /app
COPY --from=builder /app/package.json /app/pnpm-workspace.yaml ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared/package.json packages/shared/package.json
COPY --from=builder /app/packages/shared/src packages/shared/src
COPY --from=builder /app/apps/api/package.json apps/api/package.json
COPY --from=builder /app/apps/api/node_modules apps/api/node_modules
COPY --from=builder /app/apps/api/dist apps/api/dist
COPY --from=builder /app/apps/api/prisma apps/api/prisma

WORKDIR /app/apps/api
ENV NODE_ENV=production
EXPOSE 3001
CMD ["sh", "-c", "pnpm prisma:migrate && node dist/index.js"]
