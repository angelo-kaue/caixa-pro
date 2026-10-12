#!/usr/bin/env bash
# Recria o banco de testes de integração aplicando o stub do Supabase + migrações + papéis do PostgREST.
# Usa as variáveis padrão do psql (PGHOST, PGUSER, PGPASSWORD).
set -euo pipefail
DB="${E2E_DB:-caixapro_e2e}"
psql -v ON_ERROR_STOP=1 -q -d postgres -c "drop database if exists ${DB} with (force)" -c "create database ${DB}"
for f in supabase/tests/00_supabase_stub.sql supabase/migrations/*.sql e2e/support/setup.sql; do
  psql -v ON_ERROR_STOP=1 -q -d "${DB}" -f "$f"
done
