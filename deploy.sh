#!/usr/bin/env bash

set -Eeuo pipefail

PROJECT_DIR="/var/www/project2"
APP_NAME="akma-accounting"
PORT="3030"

LOCAL_URL="http://127.0.0.1:${PORT}"
HEALTH_URL="${LOCAL_URL}/api/health"
PUBLIC_URL="https://hekmat.akmaofficial.ir/"

BACKUP_DIR="${PROJECT_DIR}/backups"
TIMESTAMP="$(date '+%Y-%m-%d_%H-%M-%S')"
BACKUP_FILE="${BACKUP_DIR}/akma_db_${TIMESTAMP}.sql"

log() {
    echo
    echo "=================================================="
    echo "[DEPLOY] $1"
    echo "=================================================="
}

fail() {
    echo
    echo "❌ [DEPLOY] DEPLOYMENT FAILED"
    echo "مرحله خطادار را بررسی کن."
    exit 1
}

trap fail ERR

cd "$PROJECT_DIR"

# --------------------------------------------------
# 1. Git
# --------------------------------------------------

log "1/10 - Checking Git status"

git status --short

log "2/10 - Pulling latest code"

git pull origin main

# --------------------------------------------------
# 2. Dependencies
# --------------------------------------------------

log "3/10 - Installing dependencies"

npm install

# --------------------------------------------------
# 3. Build
# --------------------------------------------------

log "4/10 - Building production application"

npm run build

# --------------------------------------------------
# 4. Environment
# --------------------------------------------------

log "5/10 - Checking environment"

if [ ! -f ".env" ]; then
    echo "❌ .env file not found."
    exit 1
fi

if ! grep -q '^DATABASE_URL=' .env; then
    echo "❌ DATABASE_URL is missing from .env"
    exit 1
fi

# --------------------------------------------------
# 5. Database backup
# --------------------------------------------------

log "6/10 - Backing up PostgreSQL database"

mkdir -p "$BACKUP_DIR"

set -a
source .env
set +a

pg_dump "$DATABASE_URL" > "$BACKUP_FILE"

echo "✅ Database backup:"
echo "$BACKUP_FILE"

# --------------------------------------------------
# 6. Standalone files
# --------------------------------------------------

log "7/10 - Preparing standalone deployment"

if [ -d "public" ]; then
    rm -rf ".next/standalone/public"
    cp -r "public" ".next/standalone/public"
fi

rm -rf ".next/standalone/.next/static"
cp -r ".next/static" ".next/standalone/.next/static"

# Keep server environment
cp ".env" ".next/standalone/.env"

# --------------------------------------------------
# 7. Stop old PM2 process
# --------------------------------------------------

log "8/10 - Updating PM2 application"

pm2 delete "$APP_NAME" 2>/dev/null || true

PORT="$PORT" \
HOSTNAME="0.0.0.0" \
NODE_ENV="production" \
pm2 start ".next/standalone/server.js" \
    --name "$APP_NAME"

pm2 save

# --------------------------------------------------
# 8. Wait for application
# --------------------------------------------------

log "9/10 - Waiting for application"

READY=0

for i in {1..20}; do
    if curl -fsS --max-time 3 "$HEALTH_URL" >/dev/null 2>&1; then
        READY=1
        break
    fi

    sleep 1
done

if [ "$READY" -ne 1 ]; then
    echo "❌ Application did not become healthy."
    echo
    pm2 status "$APP_NAME"
    echo
    pm2 logs "$APP_NAME" --lines 50 --nostream
    exit 1
fi

# --------------------------------------------------
# 9. Health checks
# --------------------------------------------------

log "10/10 - Health checks"

echo
echo "Local health:"
curl -fsS --max-time 10 "$HEALTH_URL"

echo
echo
echo "Local homepage:"
curl -fsSI --max-time 10 "$LOCAL_URL/"

echo
echo
echo "Public homepage:"
curl -fsSI --max-time 15 "$PUBLIC_URL"

echo
echo
echo "✅ DEPLOYMENT SUCCESSFUL"
echo
echo "Application : $APP_NAME"
echo "Port        : $PORT"
echo "Database    : connected"
echo "Backup      : $BACKUP_FILE"
