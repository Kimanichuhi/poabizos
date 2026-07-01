#!/usr/bin/env bash
# Run RLS regression tests against the Supabase database.
# Requires either SUPABASE_DB_URL, or PGHOST/PGUSER/PGPASSWORD/PGDATABASE/PGPORT
# to already be set (as provided by the Lovable Cloud sandbox).
# Exits non-zero on the first failed assertion so CI can gate deployment.
set -euo pipefail

SQL_FILE="${1:-docs/rls-regression-tests.sql}"
if [ ! -f "$SQL_FILE" ]; then
  echo "❌ SQL file not found: $SQL_FILE" >&2
  exit 2
fi

echo "▶ Running RLS regression suite: $SQL_FILE"

# Prefer full connection URL if provided.
if [ -n "${SUPABASE_DB_URL:-}" ]; then
  PSQL_CMD=(psql "$SUPABASE_DB_URL")
else
  PSQL_CMD=(psql)
fi

# -v ON_ERROR_STOP=1 makes the first exception a hard failure.
# -X skips ~/.psqlrc so CI is deterministic.
OUTPUT=$("${PSQL_CMD[@]}" -X -v ON_ERROR_STOP=1 -f "$SQL_FILE" 2>&1) || {
  echo "$OUTPUT"
  echo "❌ RLS regression suite FAILED"
  exit 1
}

echo "$OUTPUT"

# Sanity: at least one PASS line must appear.
if ! echo "$OUTPUT" | grep -q "PASS \["; then
  echo "❌ No PASS assertions found — suite did not run correctly"
  exit 1
fi

if echo "$OUTPUT" | grep -qE "^FAIL \["; then
  echo "❌ One or more assertions FAILED"
  exit 1
fi

echo "✅ RLS regression suite passed"
