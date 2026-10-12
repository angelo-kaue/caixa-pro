#!/usr/bin/env bash
# Testes de integração: app (services) contra Postgres + PostgREST reais, sem Supabase na nuvem.
# Pré-requisitos: Postgres local acessível via variáveis do psql e o binário do PostgREST (POSTGREST_BIN).
set -euo pipefail
cd "$(dirname "$0")/.."
: "${POSTGREST_BIN:=postgrest}"
export PGHOST="${PGHOST:-127.0.0.1}" PGUSER="${PGUSER:-postgres}" PGPASSWORD="${PGPASSWORD:-postgres}"
export E2E_DB="${E2E_DB:-caixapro_e2e}"
export E2E_JWT_SECRET="${E2E_JWT_SECRET:-segredo-de-teste-com-mais-de-32-caracteres!!}"

bash e2e/support/reset-db.sh

PGRST_DB_URI="postgres://authenticator:authpw@${PGHOST}:5432/${E2E_DB}" \
PGRST_DB_SCHEMAS="public" PGRST_DB_ANON_ROLE="anon" PGRST_JWT_SECRET="${E2E_JWT_SECRET}" \
PGRST_SERVER_HOST="127.0.0.1" PGRST_SERVER_PORT="3000" \
  "${POSTGREST_BIN}" >/tmp/e2e-postgrest.log 2>&1 &
PGRST_PID=$!
node e2e/support/fake-supabase.mjs >/tmp/e2e-proxy.log 2>&1 &
PROXY_PID=$!
trap 'kill ${PGRST_PID} ${PROXY_PID} 2>/dev/null || true' EXIT

for i in $(seq 1 40); do
  if curl -sf -o /dev/null "http://127.0.0.1:54321/rest/v1/" -H "apikey: x"; then break; fi
  sleep 0.5
done

npx vitest run -c vitest.integration.config.ts "$@"
