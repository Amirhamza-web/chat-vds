FROM node:20-bookworm-slim AS base
ENV PNPM_HOME=/root/.pnpm \
    PATH=/root/.pnpm:$PATH \
    NODE_ENV=production
RUN corepack enable && corepack prepare pnpm@9.15.1 --activate
# mediasoup needs Python, gcc/g++, make, pip + meson/ninja for native build.
RUN apt-get update -y && apt-get install -y --no-install-recommends \
      build-essential ca-certificates python3 python3-pip pkg-config \
    && pip3 install --break-system-packages meson==1.4.1 ninja==1.11.1.1 \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# ──────── deps ────────
FROM base AS deps
COPY package.json pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/sfu/package.json apps/sfu/
COPY apps/api/package.json apps/api/
COPY apps/api/prisma apps/api/prisma
RUN pnpm install --frozen-lockfile=false --prod=false

# ──────── builder ────────
FROM deps AS builder
COPY packages/shared packages/shared
COPY apps/sfu apps/sfu
RUN pnpm --filter @chat-vds/api prisma:generate
RUN pnpm --filter @chat-vds/shared build
RUN pnpm --filter @chat-vds/sfu build

# ──────── runtime ────────
FROM base AS runtime
WORKDIR /app
COPY --from=builder /app/package.json /app/pnpm-workspace.yaml ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared/package.json packages/shared/package.json
COPY --from=builder /app/packages/shared/dist packages/shared/dist
COPY --from=builder /app/apps/sfu/package.json apps/sfu/package.json
COPY --from=builder /app/apps/sfu/node_modules apps/sfu/node_modules
COPY --from=builder /app/apps/sfu/dist apps/sfu/dist

WORKDIR /app/apps/sfu
ENV NODE_ENV=production
EXPOSE 3002
CMD ["node", "dist/index.js"]
