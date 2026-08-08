# Operations

## Health checks

- Liveness: `GET /health`
- Readiness: `GET /ready`
- Version metadata: `GET /v1/version`

## Deployment verification

After deploy:

1. verify `/health`
2. verify `/ready`
3. run API smoke benchmark (`npm run perf:api`)
4. inspect `/v1/metrics`

## Backup and restore

### Create backup

- `npm run db:backup`
- optional path: `BACKUP_FILE=backups/manual.dump npm run db:backup`

### Restore backup

- `BACKUP_FILE=backups/manual.dump npm run db:restore`

### Run restore drill

- `npm run db:restore:drill`
- optional explicit backup: `BACKUP_FILE=backups/manual.dump npm run db:restore:drill`

## Incident response playbook

1. capture `X-Request-ID` from client report
2. locate request log line by `requestId`
3. inspect correlated `traceId` entries
4. check `GET /v1/metrics` for route/search/graph/db anomalies
5. if graph issue, check truncation and timeout metrics first
6. if DB issue, inspect slow-query trend and connection pressure
7. mitigate with reduced graph depth limits or temporary rate tightening

## Rollback strategy

- revert to previous known good application image
- run health and readiness checks
- validate schema compatibility

## Recovery objectives

Initial targets:

- RPO: 1 hour
- RTO: 2 hours

## Scheduled maintenance tasks

- nightly quality gate workflow (`.github/workflows/nightly.yml`)
- periodic restore drill in non-production environment
- verify backup retention policy in storage backend
