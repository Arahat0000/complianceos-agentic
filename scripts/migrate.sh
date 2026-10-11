#!/usr/bin/env bash
# Applies the ComplianceOS Postgres schema.
#
#   DATABASE_URL=postgres://... npm run migrate            # create schema (fails if it already exists)
#   DATABASE_URL=postgres://... npm run migrate -- reset   # DROP EVERYTHING, then re-create (destroys all data)
#
# Requires `psql` on PATH. Seed data is applied separately (sql/postgres/seed/).
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL must be set}"

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../sql/postgres" && pwd)"

if [[ "${1:-}" == "reset" ]]; then
  echo "Dropping existing schema (full_delete_schema.sql)..."
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$DIR/full_delete_schema.sql"
fi

echo "Applying schema (full_schema.sql)..."
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$DIR/full_schema.sql"
echo "Done."
