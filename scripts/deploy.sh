#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${DEPLOY_HOST:-}" || -z "${DEPLOY_USER:-}" || -z "${DEPLOY_PATH:-}" ]]; then
  echo "Deploy provider is not configured. Set DEPLOY_HOST, DEPLOY_USER and DEPLOY_PATH as environment secrets."
  exit 1
fi

echo "Provider-specific deployment command goes here."
echo "Expected remote steps: backup, optional maintenance mode, upload release, migrate --force, cache rebuild, worker restart, health check, rollback on failure."
