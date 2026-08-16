I checked the current `main` branch of [your LexGraph repository](https://github.com/juangp3/LexGraph?utm_source=chatgpt.com), including the backend, web app, Docker setup, database initialization, environment configuration, and CI workflows.

## D1 — Deployment-readiness verdict

**Status: NOT READY FOR PRODUCTION DEPLOYMENT YET**

But the good news is that the repository is **much closer than a prototype**. You already have several things that are normally missing at this stage: migrations, tests, CI, backups/restore tooling, Dockerfiles, E2E tests, performance tests, environment configuration, and a reasonably clear architecture.

My current assessment:

> **Architecture: 8/10**
> **Application readiness: 7/10**
> **Deployment readiness: 5/10**
> **Production security: 5/10**
> **OCI readiness: 3/10**

The biggest issue is not that you are missing hundreds of features. There are **a few architectural/deployment blockers that need to be corrected before deploying**.

---

# 1. 🔴 P0 — PostgreSQL + Apache AGE deployment architecture is currently wrong

This is the most important finding.

Your README correctly describes the intended architecture as:

```text
PostgreSQL
   +
Apache AGE
   ↓
same database
```

and explicitly says both Prisma and AGE should operate against the same PostgreSQL database. ([GitHub][1])

But your `docker-compose.yml` currently creates **two PostgreSQL containers**:

```text
postgres:
    image: postgres:17

apache-age:
    image: apache/age:latest
```

with separate ports:

```text
postgres → 5433
apache-age → 5434
```

and separate initialization scripts. ([GitHub][2])

That's not the architecture described in the documentation.

Worse, the normal `postgres` initialization only installs:

```sql
uuid-ossp
unaccent
pg_trgm
```

while the AGE initialization happens in the separate AGE service. ([GitHub][3])

### Why this matters

Your production target should be:

```text
             PostgreSQL
                  │
       ┌──────────┼──────────┐
       │          │          │
     Prisma      SQL        AGE
                            Cypher
```

not:

```text
PostgreSQL A              PostgreSQL B
     │                         │
 relational                 graph
```

Otherwise you have two databases that aren't naturally transactionally consistent.

### Classification

**🔴 FATAL / P0**

Fix this before OCI deployment.

### Target

Use an AGE-enabled PostgreSQL image as the **single database service**:

```text
postgres-age
     │
     ├── Prisma
     ├── relational tables
     ├── pg_trgm
     ├── unaccent
     ├── uuid-ossp
     └── Apache AGE
```

This should become the foundation of both development and production.

---

# 2. 🔴 P0 — `apache/age:latest` is not production-safe

You currently use:

```yaml
image: apache/age:latest
```

That's a deployment anti-pattern.

A production deployment must not silently change database software because the upstream `latest` tag changed.

You need something like:

```text
apache/age:<specific-version>
```

or, preferably, a tested custom image:

```text
lexgraph-postgres-age:<version>
```

with:

```text
PostgreSQL version
AGE version
extensions
configuration
```

fully controlled.

### Why this is particularly important

You're planning to run this on **OCI ARM64**.

So we need to establish:

```text
PostgreSQL 17
+
AGE version
+
ARM64
```

works reliably.

That hasn't been demonstrated by the repository.

### Classification

**🔴 P0**

---

# 3. 🔴 P0 — ARM64 compatibility is unverified

This is the main OCI-specific blocker.

Your planned Oracle machine is ARM64.

Your backend Dockerfile uses:

```dockerfile
FROM node:20-alpine
```

which is generally available for ARM64, so that's promising. ([GitHub][4])

The web image also uses:

```dockerfile
FROM nginx:alpine
```

which is also generally fine for ARM64. ([GitHub][5])

But the critical dependency is:

> **PostgreSQL + Apache AGE**

You need to test the exact production database image on ARM64.

### Required acceptance test

On an ARM64 environment:

```bash
docker compose up
```

must successfully:

1. start PostgreSQL
2. load AGE
3. create `lexgraph`
4. create the AGE graph
5. run Prisma migrations
6. execute graph queries
7. run the integration tests

Until that works:

**OCI deployment should not begin.**

---

# 4. 🔴 P0 — Production Docker configuration doesn't exist yet

You have Docker infrastructure, which is good.

But the current setup is still strongly oriented toward development.

The API Dockerfile:

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "run", "start"]
```

([GitHub][4])

There are several problems.

### Problem A — `npm install`

Production builds should use the lockfile:

```bash
npm ci
```

not:

```bash
npm install
```

### Problem B — unnecessary build context

You're copying the whole repository into the API image:

```dockerfile
COPY . .
```

That needs to be evaluated carefully.

### Problem C — port mismatch

Your Dockerfile exposes:

```text
3000
```

but your application defaults to:

```text
3001
```

and compose maps:

```text
3001:3001
```

Your `.env.example` also says:

```text
PORT=3001
```

while the Dockerfile says:

```text
EXPOSE 3000
```

([GitHub][4])

This isn't necessarily runtime-breaking because `EXPOSE` is metadata, but it's a clear configuration inconsistency.

### Classification

**🟠 Material weakness**

Easy to fix, but fix it before deployment.

---

# 5. 🔴 P0 — Your production frontend should NOT use the current Docker web container

This one is actually good news.

Your current web Dockerfile is literally:

```html
<h1>LexGraph Web Placeholder</h1>
<p>Week 1 scaffold completed.</p>
```

([GitHub][5])

But the actual `web/` directory is now a proper Next.js application with:

* Next.js 16
* React 19
* React Query
* React Flow
* Dagre
* Tailwind
* Playwright
* Vitest
* TypeScript

([GitHub][6])

So you have **outgrown your web Dockerfile**.

That's actually a useful discovery.

### Recommendation

Don't waste time making that nginx placeholder production-ready.

For your selected architecture:

```text
web/
   ↓
Vercel
   ↓
Next.js
```

The `docker/web/Dockerfile` can either be:

1. removed, or
2. retained only for local/self-hosted deployments.

### Classification

**🟠 Material weakness**

Not a blocker because Vercel eliminates the problem.

---

# 6. 🟢 The frontend is structurally ready for Vercel

This part looks good.

You already have a dedicated:

```text
/web
```

application with:

```text
next.config.ts
package.json
tsconfig.json
eslint.config.mjs
playwright.config.ts
vitest.config.ts
```

and a proper Next.js build script:

```bash
next build
```

([GitHub][7])

This means the Vercel deployment should be relatively straightforward:

```text
GitHub
  ↓
Vercel
  ↓
root directory = web
  ↓
npm install
  ↓
npm run build
```

### One thing still needed

Production environment configuration.

Currently `.env.example` only defines backend-oriented values such as:

```text
DATABASE_URL
PORT
FRONTEND_URL
FRONTEND_URLS
```

([GitHub][8])

You need a clearly defined frontend variable such as:

```env
NEXT_PUBLIC_API_URL=https://api.lexgraph.com
```

---

# 7. 🟠 Your repository has an excellent testing foundation

This is one of the strongest parts of the repo.

You have:

```text
unit
component
functional
integration
system
performance
E2E
```

and GitHub Actions already executes multiple layers. ([GitHub][9])

You also have:

```text
db:backup
db:restore
db:restore:drill
```

which is particularly good for production readiness. ([GitHub][9])

### But there's a major gap

Your CI integration environment uses:

```text
postgres:17
```

not your actual AGE-enabled production database. ([GitHub][10])

Therefore CI currently doesn't prove:

```text
PostgreSQL + AGE
```

works.

That is a serious deployment confidence gap.

### Required

CI should eventually test the same database architecture used in production.

---

# 8. 🔴 P0 — CI and production environments are diverging

This is related to the previous issue.

Currently:

```text
CI
 ↓
PostgreSQL 17
```

while intended production:

```text
OCI
 ↓
PostgreSQL 17 + AGE
```

These are not equivalent.

You want:

```text
Local
   │
   ├── PostgreSQL + AGE
   │
CI ─┤
   │
Production
   │
   └── PostgreSQL + AGE
```

The closer these environments are, the fewer deployment surprises you'll get.

---

# 9. 🟠 Redis should be removed from the first production deployment

Your compose currently starts:

```text
postgres
apache-age
redis
api
web
```

([GitHub][2])

But our deployment architecture deliberately decided:

> **No Redis initially.**

I agree with that decision.

You already have PostgreSQL doing:

* relational storage
* search
* graph
* metadata

Don't introduce Redis unless there's an actual measured requirement.

### Production target

```text
OCI

PostgreSQL + AGE
       │
       ▼
      API
```

not:

```text
Postgres
AGE
Redis
API
worker
...
```

### Classification

**🟡 Minor / architectural simplification**

---

# 10. 🟠 Secrets need a production strategy

`.env.example` currently contains:

```text
DATABASE_URL=postgresql://lexgraph:lexgraph@localhost:5433/lexgraph
```

which is acceptable as an example, but the production setup needs:

```text
OCI environment variables / secret files
```

with credentials completely different from development.

More importantly, your Docker Compose currently has hardcoded:

```text
POSTGRES_PASSWORD: lexgraph
```

([GitHub][2])

That is acceptable for local development.

It should **not** be reused in production.

Production:

```text
POSTGRES_PASSWORD=<strong-secret>
```

and ideally the production compose configuration references an external secret/environment variable.

---

# 11. 🟠 API security needs a final production pass

You already have:

```text
express-rate-limit
cors
```

in the backend dependencies. ([GitHub][9])

That's good.

But before public exposure, I would specifically verify:

* rate limits per endpoint
* body size limits
* query parameter limits
* graph traversal depth
* graph node/edge limits
* request timeout
* CORS
* security headers
* error sanitization
* stack traces disabled in production
* database connection pool limits
* HTTP request logging
* health/readiness endpoints

The graph endpoint is particularly important.

A malicious request shouldn't be able to ask:

```text
"give me the entire linguistic graph"
```

and consume your entire 2-CPU OCI machine.

---

# 12. 🔴 Graph traversal limits are a production blocker

Because LexGraph's core functionality is graph traversal, this deserves its own P0.

Your architecture explicitly exposes:

```text
findAncestors()
findDescendants()
findBorrowings()
findCognates()
findNeighborhood()
```

([GitHub][1])

Every public graph API must enforce:

```text
maxDepth
maxNodes
maxEdges
maxExecutionTime
```

For example:

```json
{
  "wordId": "...",
  "depth": 5,
  "maxNodes": 500
}
```

with server-side hard caps.

The client must **never** be able to override those caps arbitrarily.

---

# 13. 🟢 Your database backup tooling is a strong point

You already have:

```text
db:backup
db:restore
db:restore:drill
```

([GitHub][9])

This is exactly the right direction.

The missing part is deployment infrastructure:

```text
OCI
 ↓
automated scheduled backup
 ↓
external storage
```

Don't keep your only backup on the OCI VM.

---

# 14. 🟠 You need explicit readiness/liveness semantics

You already use:

```text
/health
```

in CI to verify that the API started. ([GitHub][10])

That's good.

I'd expand this into:

```text
/health/live
```

Meaning:

> process is alive.

and:

```text
/health/ready
```

Meaning:

> process can actually serve requests.

For example:

```text
/health/ready
       │
       ├── database connection
       ├── AGE available
       └── required schema exists
```

This becomes useful later for deployment and monitoring.

---

# 15. 🟢 GitHub Actions foundation is good

You already have:

```text
ci.yml
nightly.yml
playwright-e2e.yml
```

([GitHub][11])

And `ci.yml` runs on pull requests and pushes to `main`. ([GitHub][10])

That's a solid base.

What's missing is the actual deployment pipeline:

```text
main
 ↓
tests
 ↓
build
 ↓
Docker image
 ↓
GHCR
 ↓
OCI
```

We'll add this later, not now.

---

# 16. 🟠 Docker images need reproducibility improvements

Current API:

```dockerfile
FROM node:20-alpine
```

and:

```dockerfile
RUN npm install
```

Current AGE:

```text
apache/age:latest
```

These are too loose for production.

I'd move toward:

```text
node:<specific-version>-alpine
```

and:

```text
npm ci
```

and pinned database/AGE versions.

Eventually use image digests for the most critical infrastructure images.

---

# 17. 🟠 Prisma/database migration strategy needs one production test

Your repository has:

```bash
prisma migrate deploy
```

which is correct for production. ([GitHub][9])

But the production process should be:

```text
backup
 ↓
migration
 ↓
health check
 ↓
application deployment
```

not:

```text
deploy blindly
 ↓
hope migrations work
```

Before OCI deployment, perform a **full clean-database deployment rehearsal**.

---

# 18. 🟢 Repository organization is good enough

The current repository has clear separation:

```text
src/
web/
tests/
prisma/
scripts/
docker/
docs/
.github/
```

([GitHub][1])

I would **not restructure the repo now**.

That would create unnecessary risk immediately before deployment.

---

# 19. 🟠 Documentation needs a deployment document

You already have:

```text
docs/BUILD_PLAN.md
docs/MINIMAL_SCHEMA.md
docs/import-pipeline-usage.md
```

([GitHub][1])

You should add:

```text
docs/DEPLOYMENT.md
```

with:

```text
Architecture
Prerequisites
Local production rehearsal
OCI setup
Database setup
Secrets
Migrations
Backup
Restore
Deployment
Rollback
Monitoring
Troubleshooting
```

This should eventually be the single source of truth for deploying LexGraph.

---

# Overall D1 assessment

Here's how I'd classify the current repository.

| Area                          | Status | Assessment                                            |
| ----------------------------- | ------ | ----------------------------------------------------- |
| Repository structure          | 🟢     | Good                                                  |
| Backend architecture          | 🟢     | Good                                                  |
| Web architecture              | 🟢     | Good                                                  |
| Prisma                        | 🟢     | Good foundation                                       |
| Search                        | 🟢     | Good foundation                                       |
| Graph model                   | 🟢     | Strong direction                                      |
| Testing                       | 🟢     | Surprisingly mature                                   |
| CI                            | 🟢     | Good foundation                                       |
| Backups                       | 🟢     | Good tooling                                          |
| Docker                        | 🟠     | Needs production hardening                            |
| Frontend deployment           | 🟢     | Vercel-ready with minor config                        |
| Backend deployment            | 🟠     | Needs production image                                |
| PostgreSQL/AGE                | 🔴     | **Architecture needs correction**                     |
| ARM64                         | 🔴     | **Not validated**                                     |
| Production secrets            | 🟠     | Needs production strategy                             |
| Graph protection              | 🔴     | **Must enforce hard limits**                          |
| Monitoring                    | 🟠     | Basic health exists, production observability missing |
| Deployment automation         | 🔴     | Not implemented                                       |
| Production backup destination | 🟠     | Tooling exists; infrastructure missing                |

---

# The actual D1 backlog

I would **not** start building OCI yet.

First implement these in this order:

### P0-1 — Unify PostgreSQL + AGE

```text
postgres + AGE
       ↓
single database
```

Remove the conceptual split between `postgres` and `apache-age`.

### P0-2 — Make AGE deterministic

Remove:

```text
apache/age:latest
```

Pin the tested version.

### P0-3 — ARM64 validation

Prove:

```text
PostgreSQL + AGE
+
Prisma
+
graph queries
```

works on ARM64.

### P0-4 — Production Docker image

Fix:

```text
npm install → npm ci
port mismatch
production environment
non-root execution
healthcheck
image reproducibility
```

### P0-5 — Make CI use the production DB architecture

CI must test:

```text
PostgreSQL + AGE
```

not plain PostgreSQL.

### P0-6 — Graph resource limits

Enforce:

```text
max depth
max nodes
max edges
timeouts
```

server-side.

### P1-1 — Production environment configuration

Define:

```text
development
test
production
```

and production secrets.

### P1-2 — Frontend production configuration

Add:

```text
NEXT_PUBLIC_API_URL
```

and verify the Next.js app works independently through Vercel.

### P1-3 — Backup destination

Automate:

```text
OCI → external backup
```

and test restore.

### P1-4 — Production health endpoints

Implement:

```text
/live
/ready
```

### P1-5 — Deployment documentation

Create:

```text
docs/DEPLOYMENT.md
```

---

# The most important finding

There is one thing I would **absolutely not do yet**:

> **Don't create the Oracle VM and start manually installing things.**

Your current repository's biggest deployment risk is **database architecture**, not OCI configuration.

If you deploy the current Compose architecture to OCI, you'll be carrying the `postgres`/`apache-age` split into production and potentially have to migrate the database architecture later.

Instead:

```text
CURRENT
postgres
   +
apache-age
   ↓
❌

        ↓

TARGET
PostgreSQL + AGE
   ↓
Prisma + SQL + Cypher
   ↓
API
```

Then validate that exact stack on ARM64.

After that, OCI becomes mostly infrastructure work rather than an architectural debugging exercise.

## D1 conclusion

**The project is not far from deployment, but I would classify it as "feature-complete enough, infrastructure-not-ready."**

The strongest part is that you have already built a surprisingly good engineering foundation: tests, CI, migrations, import tooling, backup/restore tooling, performance tests, and separation between web/API/database concerns. ([GitHub][1])

The **fatal issue is the PostgreSQL/AGE deployment model**, followed by **ARM64 compatibility**. Fix those two first. Then the remaining work is mostly production hardening rather than another architectural rewrite.

**Recommended next step: P0-1 — redesign the Docker/PostgreSQL/AGE setup into a single PostgreSQL+AGE service and make that configuration work identically in local development, CI, and OCI.**

[1]: https://github.com/juangp3/LexGraph "GitHub - juangp3/LexGraph · GitHub"
[2]: https://github.com/juangp3/LexGraph/blob/main/docker-compose.yml "LexGraph/docker-compose.yml at main · juangp3/LexGraph · GitHub"
[3]: https://github.com/juangp3/LexGraph/blob/main/scripts/db/init-extensions.sql "LexGraph/scripts/db/init-extensions.sql at main · juangp3/LexGraph · GitHub"
[4]: https://github.com/juangp3/LexGraph/blob/main/docker/api/Dockerfile "LexGraph/docker/api/Dockerfile at main · juangp3/LexGraph · GitHub"
[5]: https://github.com/juangp3/LexGraph/blob/main/docker/web/Dockerfile "LexGraph/docker/web/Dockerfile at main · juangp3/LexGraph · GitHub"
[6]: https://github.com/juangp3/LexGraph/blob/main/web/package.json "LexGraph/web/package.json at main · juangp3/LexGraph · GitHub"
[7]: https://github.com/juangp3/LexGraph/tree/main/web "LexGraph/web at main · juangp3/LexGraph · GitHub"
[8]: https://github.com/juangp3/LexGraph/blob/main/.env.example "LexGraph/.env.example at main · juangp3/LexGraph · GitHub"
[9]: https://github.com/juangp3/LexGraph/blob/main/package.json "LexGraph/package.json at main · juangp3/LexGraph · GitHub"
[10]: https://github.com/juangp3/LexGraph/blob/main/.github/workflows/ci.yml "LexGraph/.github/workflows/ci.yml at main · juangp3/LexGraph · GitHub"
[11]: https://github.com/juangp3/LexGraph/tree/main/.github/workflows "LexGraph/.github/workflows at main · juangp3/LexGraph · GitHub"
