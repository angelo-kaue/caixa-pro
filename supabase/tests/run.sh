#!/usr/bin/env bash
# Aplica stub do Supabase + migrações + testes em um banco descartável.
# Uso (com um Postgres local acessível pelo psql): bash supabase/tests/run.sh [nome_do_banco]
set -euo pipefail
DB="${1:-caixapro_test}"
psql -v ON_ERROR_STOP=1 -q -d postgres -c "drop database if exists ${DB}" -c "create database ${DB}"
for f in supabase/tests/00_supabase_stub.sql supabase/migrations/*.sql supabase/tests/*.test.sql; do
  echo "--> ${f}"
  psql -v ON_ERROR_STOP=1 -q -d "${DB}" -f "${f}"
done
