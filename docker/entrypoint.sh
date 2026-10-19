#!/bin/sh
set -e

# Wait for the database
until pg_isready -d "$DATABASE_URL" >/dev/null 2>&1; do
  echo "Waiting for database..."
  sleep 2
done

case "$1" in
  web)
    # Apply schema changes. Committed migrations are preferred; without them the schema is pushed directly.
    if [ -d prisma/migrations ] && [ "$(ls -A prisma/migrations 2>/dev/null)" ]; then
      npx prisma migrate deploy
    else
      npx prisma db push --skip-generate
    fi
    npx tsx prisma/seed.ts
    exec npx next start -p 3000
    ;;
  worker)
    # Let the web container finish migrating first
    sleep 15
    exec npx tsx src/worker/index.ts
    ;;
  *)
    exec "$@"
    ;;
esac
