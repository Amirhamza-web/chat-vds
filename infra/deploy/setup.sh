#!/usr/bin/env bash
# Idempotent setup script for an Ubuntu/Debian VDS.
# Usage: bash setup.sh
set -euo pipefail

if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi

if ! command -v ufw >/dev/null 2>&1; then
  apt-get update -y
  apt-get install -y ufw
fi

ufw allow 22/tcp || true
ufw allow 80/tcp || true
ufw allow 443/tcp || true
ufw allow 443/udp || true
ufw --force enable || true

if ! id -nG "$USER" | grep -qw docker; then
  usermod -aG docker "$USER" || true
  echo "Added $USER to docker group; please log out and back in."
fi

echo "Setup complete. Now: cd to repo, copy infra/.env.example to infra/.env, edit, then 'docker compose up -d'."
