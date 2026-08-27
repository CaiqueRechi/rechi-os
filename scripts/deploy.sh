#!/usr/bin/env bash
set -euo pipefail

required_vars=(
  HOSTINGER_HOST
  HOSTINGER_USER
  HOSTINGER_SSH_KEY
  HOSTINGER_APP_PATH
  HOSTINGER_ENV
)

for var in "${required_vars[@]}"; do
  if [[ -z "${!var:-}" ]]; then
    echo "Missing required secret: ${var}"
    exit 1
  fi
done

HOSTINGER_PORT="${HOSTINGER_PORT:-22}"
HOSTINGER_PHP_BINARY="${HOSTINGER_PHP_BINARY:-php}"
RELEASE_ID="${GITHUB_SHA:-manual-$(date +%Y%m%d%H%M%S)}"
ARCHIVE="release-${RELEASE_ID}.tar.gz"
REMOTE_ARCHIVE="${HOSTINGER_APP_PATH}/${ARCHIVE}"
DEPLOY_DIR=".deploy"

rm -rf "${DEPLOY_DIR}"
mkdir -p "${DEPLOY_DIR}" "${HOME}/.ssh"
chmod 700 "${HOME}/.ssh"

printf '%s\n' "${HOSTINGER_SSH_KEY}" > "${HOME}/.ssh/hostinger"
chmod 600 "${HOME}/.ssh/hostinger"

ssh-keyscan -p "${HOSTINGER_PORT}" -H "${HOSTINGER_HOST}" >> "${HOME}/.ssh/known_hosts" 2>/dev/null

printf '%s\n' "${HOSTINGER_ENV}" > "${DEPLOY_DIR}/.env"
chmod 600 "${DEPLOY_DIR}/.env"

tar \
  --exclude='./.codex' \
  --exclude='./.agent' \
  --exclude='./.agents' \
  --exclude='./.codex-git' \
  --exclude='./.git' \
  --exclude='./.github' \
  --exclude='./.npm-cache' \
  --exclude='./coverage' \
  --exclude='./node_modules' \
  --exclude='./public/hot' \
  --exclude='./rechi-os-tmp' \
  --exclude='./storage/logs/*.log' \
  --exclude='./tests' \
  -czf "${DEPLOY_DIR}/${ARCHIVE}" .

SSH_TARGET="${HOSTINGER_USER}@${HOSTINGER_HOST}"
SSH_BASE=(ssh -i "${HOME}/.ssh/hostinger" -p "${HOSTINGER_PORT}" -o StrictHostKeyChecking=yes)
SCP_BASE=(scp -i "${HOME}/.ssh/hostinger" -P "${HOSTINGER_PORT}" -o StrictHostKeyChecking=yes)

"${SSH_BASE[@]}" "${SSH_TARGET}" "mkdir -p '${HOSTINGER_APP_PATH}/shared' '${HOSTINGER_APP_PATH}/releases'"
"${SCP_BASE[@]}" "${DEPLOY_DIR}/${ARCHIVE}" "${SSH_TARGET}:${REMOTE_ARCHIVE}"
"${SCP_BASE[@]}" "${DEPLOY_DIR}/.env" "${SSH_TARGET}:${HOSTINGER_APP_PATH}/shared/.env.next"

"${SSH_BASE[@]}" "${SSH_TARGET}" \
  "HOSTINGER_APP_PATH='${HOSTINGER_APP_PATH}' \
   HOSTINGER_PUBLIC_PATH='${HOSTINGER_PUBLIC_PATH:-}' \
   HOSTINGER_PHP_BINARY='${HOSTINGER_PHP_BINARY}' \
   RELEASE_ID='${RELEASE_ID}' \
   ARCHIVE='${ARCHIVE}' \
   bash -s" <<'REMOTE'
set -euo pipefail

APP_PATH="${HOSTINGER_APP_PATH}"
PUBLIC_PATH="${HOSTINGER_PUBLIC_PATH:-}"
PHP_BIN="${HOSTINGER_PHP_BINARY:-php}"
RELEASE="${APP_PATH}/releases/${RELEASE_ID}"
SHARED="${APP_PATH}/shared"
CURRENT="${APP_PATH}/current"

mkdir -p "${RELEASE}" \
  "${SHARED}/storage/app/public" \
  "${SHARED}/storage/framework/cache" \
  "${SHARED}/storage/framework/sessions" \
  "${SHARED}/storage/framework/views" \
  "${SHARED}/storage/logs"

tar -xzf "${APP_PATH}/${ARCHIVE}" -C "${RELEASE}"
rm -f "${APP_PATH}/${ARCHIVE}"

mv "${SHARED}/.env.next" "${SHARED}/.env"
chmod 600 "${SHARED}/.env"

rm -rf "${RELEASE}/storage" "${RELEASE}/.env"
ln -s "${SHARED}/storage" "${RELEASE}/storage"
ln -s "${SHARED}/.env" "${RELEASE}/.env"

cd "${RELEASE}"

"${PHP_BIN}" artisan key:generate --force --show >/dev/null 2>&1 || true
"${PHP_BIN}" artisan migrate --force
"${PHP_BIN}" artisan optimize:clear
"${PHP_BIN}" artisan config:cache
"${PHP_BIN}" artisan route:cache
"${PHP_BIN}" artisan view:cache

ln -sfn "${RELEASE}" "${CURRENT}"

if [[ -n "${PUBLIC_PATH}" ]]; then
  mkdir -p "${PUBLIC_PATH}"
  find "${PUBLIC_PATH}" -mindepth 1 -maxdepth 1 ! -name '.well-known' -exec rm -rf {} +
  cp -a "${CURRENT}/public/." "${PUBLIC_PATH}/"

  cat > "${PUBLIC_PATH}/index.php" <<PHP
<?php

use Illuminate\Http\Request;

define('LARAVEL_START', microtime(true));

require '${CURRENT}/vendor/autoload.php';

\$app = require_once '${CURRENT}/bootstrap/app.php';

\$app->handleRequest(Request::capture());
PHP
fi

find "${APP_PATH}/releases" -mindepth 1 -maxdepth 1 -type d | sort | head -n -5 | xargs -r rm -rf
REMOTE

echo "Deployment completed."
