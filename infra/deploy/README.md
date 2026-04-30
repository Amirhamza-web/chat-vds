# Deploying chat-vds to a VDS

This guide gets you from a fresh Ubuntu VDS to a running chat at `https://chat.example.com`.

## 1. Requirements

- **VDS:** Ubuntu 22.04+ (Debian 12 also works), root or sudo access
- **Specs:** 2 vCPU / 4 GB RAM / 40 GB SSD recommended for the text MVP. Add 2 GB RAM and 1 vCPU per ~50 concurrent voice users (Phase 2).
- **Domain:** an `A` record pointing to your VDS public IPv4. Optionally `AAAA` for IPv6.

## 2. Open firewall ports

```bash
sudo ufw allow 22/tcp     # SSH
sudo ufw allow 80/tcp     # HTTP (Let's Encrypt challenge + redirect)
sudo ufw allow 443/tcp    # HTTPS
sudo ufw allow 443/udp    # HTTP/3
# Phase 2 (voice) only:
sudo ufw allow 3478/udp
sudo ufw allow 49152:65535/udp
sudo ufw enable
```

## 3. Install Docker

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
newgrp docker
```

(Or run `infra/deploy/setup.sh` from this repo, which is the same idempotent install.)

## 4. Clone and configure

```bash
git clone https://github.com/Amirhamza-web/chat-vds.git
cd chat-vds/infra
cp .env.example .env
nano .env       # fill in DOMAIN, ACME_EMAIL, JWT_SECRET, POSTGRES_PASSWORD
```

Generate a strong JWT secret:

```bash
openssl rand -base64 48
```

Paste it as `JWT_SECRET=...` in `.env`.

## 5. Launch

```bash
docker compose up -d
docker compose logs -f api    # watch the API run migrations
```

Caddy will obtain a Let's Encrypt certificate automatically on first request.

Visit `https://<your-domain>` and register an account.

## 6. Updates

```bash
cd ~/chat-vds
git pull
cd infra
docker compose pull
docker compose up -d --build
```

The API container runs `prisma migrate deploy` on startup, so DB migrations are
applied automatically.

## 7. Backups

The data lives in Docker named volumes. Back them up regularly:

```bash
docker run --rm -v chat-vds_pg_data:/data -v $(pwd):/backup alpine \
  tar czf /backup/pg-$(date +%F).tar.gz -C / data
```

Same pattern for `chat-vds_minio_data` (if using MinIO) and `chat-vds_api_uploads`.

## 8. Troubleshooting

- **HTTPS doesn't work:** Make sure ports 80 and 443 are open and your domain's DNS
  points at this VDS. Then `docker compose logs caddy`.
- **API restarts:** `docker compose logs api`. Most often `JWT_SECRET` is too short
  (must be ≥ 32 chars) or DB password mismatch.
- **WebSocket disconnects right after connect:** check the access token by hitting
  `https://<domain>/health`; if 200, then the issue is CORS — make sure
  `PUBLIC_URL` in `.env` matches the URL you visit in the browser.

## 9. Phase 2 (voice/video)

When the SFU lands, run:

```bash
docker compose --profile voice up -d
```

Edit `infra/coturn/turnserver.conf` (set `realm` and a real `user=`) before that.
