# chat-vds

Self-hosted Discord-style chat for your own VDS. Built from scratch with
TypeScript everywhere.

## Features

### Phase 1 (this release) — text chat MVP

- Email + password registration and login (argon2 + JWT access/refresh)
- Multiple servers ("guilds") with text and voice channels
- Real-time messaging via WebSockets (Socket.IO + Redis adapter)
- Image and file uploads (local disk or S3-compatible MinIO)
- Typing indicators, online presence, message edit & delete
- Invite links with optional expiry / use limits
- Discord-inspired UI with Tailwind CSS

### Phase 2 — voice

- mediasoup SFU + coturn for NAT traversal (already in `docker-compose.yml`)
- Mute / deafen / speaking indicators

### Phase 3 — video & screenshare

- Camera toggle (VP8/VP9 via mediasoup)
- Screen sharing via `getDisplayMedia`
- Adaptive layout: video grid when no screenshare; focused screen + sidebar when someone shares
- `appData.source` tag (`mic` | `camera` | `screen`) on every producer for proper routing

### Phase 4+

- Roles with per-channel permission overwrites
- Reactions, mentions, pinned messages
- Direct messages and DM groups
- Push notifications

## Stack

- **Backend:** Node.js 20, TypeScript, Fastify, Socket.IO, Prisma, PostgreSQL, Redis
- **Frontend:** React 18, TypeScript, Vite, TailwindCSS, Zustand, TanStack Query
- **Realtime / Media:** Socket.IO (text), mediasoup SFU + coturn (voice, video, screenshare)
- **Storage:** local disk or MinIO (S3-compatible)
- **Reverse proxy:** Caddy (automatic Let's Encrypt)
- **Container:** Docker Compose, single `docker compose up -d`

## Quickstart (local development)

Requires Node.js 20+, pnpm 9+, Docker, and Docker Compose.

```bash
# 1. Install JS deps
pnpm install

# 2. Bring up dependencies (Postgres, Redis, MinIO)
docker compose -f infra/docker-compose.yml up -d postgres redis minio

# 3. Configure the API
cp apps/api/.env.example apps/api/.env
# (the defaults already point at the docker services above)

# 4. Run database migrations
pnpm --filter @chat-vds/api exec prisma migrate dev --name init

# 5. Start API + web in dev mode
pnpm dev
```

- API → http://localhost:3001
- Web → http://localhost:5173

## Deploying to a VDS

See [`infra/deploy/README.md`](./infra/deploy/README.md) for a full,
copy-pasteable Ubuntu deployment guide (firewall, Docker, Caddy +
Let's Encrypt, env, updates, backups).

TL;DR:

```bash
git clone https://github.com/Amirhamza-web/chat-vds.git
cd chat-vds/infra
cp .env.example .env && nano .env       # set DOMAIN, JWT_SECRET, passwords
docker compose up -d
```

## Repository layout

```
apps/
  api/      Fastify + Socket.IO + Prisma backend
  web/      React + Vite frontend
packages/
  shared/   Zod schemas, event names, permissions (used by api & web)
infra/
  docker-compose.yml   All services
  Caddyfile            Reverse proxy + auto-TLS
  coturn/              TURN server config (Phase 2)
  deploy/README.md     VDS deployment instructions
```

## Continuous integration

A ready-to-use GitHub Actions workflow lives at
[`infra/ci/ci.yml.example`](./infra/ci/ci.yml.example). Copy it to
`.github/workflows/ci.yml` from the GitHub web UI (or with a token that has the
`workflow` scope) — it runs `typecheck` and `build` on every push and PR.

## License

MIT — see [LICENSE](./LICENSE).
