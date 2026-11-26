#!/bin/sh
# Seeds the initial admin user. Runs once, when the database volume is created.
# Credentials come from the container environment and are passed to psql as
# variables (:'name' quotes them as literals), never interpolated into SQL text.
set -eu

: "${ADMIN_NAME:?ADMIN_NAME is required}"
: "${ADMIN_EMAIL:?ADMIN_EMAIL is required}"
: "${ADMIN_PASSWORD:?ADMIN_PASSWORD is required}"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -v admin_name="$ADMIN_NAME" \
  -v admin_email="$ADMIN_EMAIL" \
  -v admin_password="$ADMIN_PASSWORD" <<'SQL'
INSERT INTO users (full_name, email, password_hash, role)
VALUES (
  :'admin_name',
  :'admin_email',
  crypt(:'admin_password', gen_salt('bf', 12)),
  'admin'
);
SQL
echo "Seeded admin user: $ADMIN_EMAIL"
