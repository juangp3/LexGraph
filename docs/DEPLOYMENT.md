# Deployment guide

## Overview

LexGraph is designed to run as an API plus a Next.js web frontend backed by PostgreSQL with Apache AGE.

## Prerequisites

- Docker Compose
- Node.js 20+
- PostgreSQL 17 with Apache AGE enabled
- Access to environment variables or secrets for production

## Local development

```bash
npm install
npm run infra:up
npm run db:migrate
npm run seed:v2
npm run dev:full
```

## Production rehearsal

1. Build the API image.
2. Start the database services.
3. Apply Prisma migrations.
4. Verify health and readiness endpoints.
5. Run the main functional regression suite.

## Environment variables

Required for production:

- `DATABASE_URL`
- `PORT`
- `FRONTEND_URLS`
- `SESSION_SECRET` or equivalent auth secret
- `GITHUB_OAUTH_CLIENT_ID` and `GITHUB_OAUTH_CLIENT_SECRET` when OAuth is enabled

## Health and readiness

- `/health` returns a lightweight liveness signal.
- `/ready` verifies that the API can reach PostgreSQL.

## Backup and restore

Use the existing backup/restore scripts:

```bash
npm run db:backup
npm run db:restore
```

## Rollback

Rollback by redeploying the previous image and restoring the latest backup if needed.
