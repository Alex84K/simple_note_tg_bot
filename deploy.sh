#!/usr/bin/env bash
set -euo pipefail

# Запускать на сервере: ./deploy.sh
# Или через ssh: ssh user@server "cd /opt/simple-note-bot && ./deploy.sh"

echo "==> git pull"
git pull --ff-only

echo "==> rebuild & restart"
docker compose up -d --build

echo "==> done"
docker compose ps
