#!/usr/bin/env bash

set -Eeuo pipefail

# Values can be overridden on the server without editing this file.
PROJECT_DIR="${PROJECT_DIR:-/var/www/project2}"
APP_NAME="${APP_NAME:-akma-accounting}"
PORT="${PORT:-}"
BRANCH="${BRANCH:-main}"
TARGET_SHA="${1:-origin/${BRANCH}}"
BACKUP_DIR="${BACKUP_DIR:-${PROJECT_DIR}/backups}"
LOCK_FILE="${LOCK_FILE:-/tmp/${APP_NAME}.deploy.lock}"
PREVIOUS_SHA=""
BACKUP_FILE=""
ROLLING_BACK=0

log() {
  printf '\n[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$1"
}

start_application() {
  mkdir -p .next/standalone/.next

  if [ -d public ]; then
    rm -rf .next/standalone/public
    cp -a public .next/standalone/public
  fi

  rm -rf .next/standalone/.next/static
  cp -a .next/static .next/standalone/.next/static
  cp .env .next/standalone/.env

  if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
    PORT="$PORT" HOSTNAME="0.0.0.0" NODE_ENV="production" \
      pm2 reload "$APP_NAME" --update-env
  else
    PORT="$PORT" HOSTNAME="0.0.0.0" NODE_ENV="production" \
      pm2 start .next/standalone/server.js --name "$APP_NAME"
  fi
}

wait_until_healthy() {
  local attempt
  for attempt in $(seq 1 30); do
    if curl -fsS --max-time 4 "$HEALTH_URL" >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done
  return 1
}

rollback() {
  local exit_code=$?

  if [ "$ROLLING_BACK" -eq 1 ]; then
    exit "$exit_code"
  fi
  ROLLING_BACK=1
  trap - ERR

  log "Deployment failed; starting application rollback"
  if [ -n "$PREVIOUS_SHA" ]; then
    cd "$PROJECT_DIR"
    git reset --hard "$PREVIOUS_SHA"
    npm ci --no-audit --no-fund
    npm run build
    start_application
    if wait_until_healthy; then
      pm2 save
      log "Application restored to $PREVIOUS_SHA"
    else
      log "Rollback failed. Check: pm2 logs $APP_NAME --lines 100"
    fi
  fi

  if [ -n "$BACKUP_FILE" ]; then
    log "Database backup retained at $BACKUP_FILE"
    log "Database restoration is intentionally manual to avoid overwriting newer data."
  fi
  exit "$exit_code"
}

trap rollback ERR

command -v git >/dev/null
command -v npm >/dev/null
command -v pm2 >/dev/null
command -v curl >/dev/null
command -v pg_dump >/dev/null

# Preserve the port used by the currently running PM2 process. This prevents
# an automatic deployment from drifting away from the existing Nginx target.
if [ -z "$PORT" ]; then
  RUNNING_PID="$(pm2 pid "$APP_NAME" 2>/dev/null | tail -n 1 || true)"
  if [[ "$RUNNING_PID" =~ ^[0-9]+$ ]] && [ "$RUNNING_PID" -gt 0 ] && [ -r "/proc/${RUNNING_PID}/environ" ]; then
    PORT="$(tr '\0' '\n' < "/proc/${RUNNING_PID}/environ" | sed -n 's/^PORT=//p' | tail -n 1)"
  fi
fi

# project2 has historically used 3020; use it only when no running value exists.
PORT="${PORT:-3020}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:${PORT}/api/health}"
log "Selected application port: $PORT"

mkdir -p "$(dirname "$LOCK_FILE")"
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "Another deployment is already running."
  exit 1
fi

cd "$PROJECT_DIR"

if [ ! -f .env ]; then
  echo ".env file not found in $PROJECT_DIR"
  exit 1
fi

if ! grep -q '^DATABASE_URL=' .env; then
  echo "DATABASE_URL is missing from .env"
  exit 1
fi

# Refuse to erase manual tracked-file edits made directly on the server.
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Tracked files have local changes. Commit or remove them before deployment."
  git status --short
  exit 1
fi

PREVIOUS_SHA="$(git rev-parse HEAD)"

log "Creating PostgreSQL backup before code or schema changes"
mkdir -p "$BACKUP_DIR"
BACKUP_FILE="${BACKUP_DIR}/akma_db_$(date '+%Y-%m-%d_%H-%M-%S').dump"
set -a
# shellcheck disable=SC1091
source .env
set +a
pg_dump --format=custom --no-owner --no-acl "$DATABASE_URL" > "$BACKUP_FILE"
test -s "$BACKUP_FILE"

log "Fetching requested revision"
git fetch --prune origin "$BRANCH"
if ! git cat-file -e "${TARGET_SHA}^{commit}" 2>/dev/null; then
  echo "Requested commit does not exist: $TARGET_SHA"
  exit 1
fi
git reset --hard "$TARGET_SHA"

log "Installing dependencies and building production frontend/server"
npm ci --no-audit --no-fund
npm run build

log "Reloading PM2 application on port $PORT"
start_application

log "Checking application and database health"
wait_until_healthy
pm2 save

# Keep backups for 14 days. This runs only after a successful deployment.
find "$BACKUP_DIR" -maxdepth 1 -type f -name 'akma_db_*.dump' -mtime +14 -delete

trap - ERR
log "Deployment successful: $(git rev-parse HEAD)"
log "Health check passed: $HEALTH_URL"
log "Database backup: $BACKUP_FILE"
