# LexGraph — Zero-Cost Deployment Plan (Vercel + Oracle Cloud Always Free)

This plan is grounded in what's actually in `juangp3/LexGraph` today:

- Root `package.json`: Node/TypeScript Express API, entry `src/server.ts`, built with `tsc` to `dist/server.js`, Prisma ORM, `pg` driver.
- `.env.example`: API expects `DATABASE_URL`, `PORT=3001`, `FRONTEND_URL`/`FRONTEND_URLS` for CORS.
- `docker-compose.yml` currently runs **two separate Postgres containers** — a plain `postgres:17` (port 5433) and a separate `apache/age:latest` (port 5434) — plus `redis`, `api`, and `web` (nginx, port 8080→80).
- `web/` is a separate npm project (frontend) — build tool not confirmed from what I could fetch; check `web/package.json` before Step 2.

Two things in the current setup need fixing before this can deploy cleanly — flagged inline below as **⚠️ Fix**.

Steps are labeled:
- 🧑‍💻 **Code change** — happens in your repo/editor, gets pushed to GitHub.
- 🖱️ **Manual** — happens in a web console (account creation, clicking buttons). Can't be automated from here.

---

## Part 0 — Accounts to create manually

🖱️ Do these first, in order:

1. **GitHub** — you already have this (the repo exists). Make sure you can push to `main` or a branch.
2. **Oracle Cloud (OCI)** — [cloud.oracle.com](https://cloud.oracle.com) → "Start for free." Needs a credit card for identity verification but you will not be charged if you stay in Always Free limits. Pick your home region during signup — **Frankfurt or Singapore currently provision Ampere A1 capacity faster than US regions**, worth choosing one of those if you don't have a latency reason to pick elsewhere.
3. **Vercel** — [vercel.com](https://vercel.com) → sign up with your GitHub account (this auto-grants repo access for later).
4. **DuckDNS** — [duckdns.org](https://www.duckdns.org) → sign in with GitHub/Google, claim a free subdomain, e.g. `lexgraph.duckdns.org`. Note the token shown on your DuckDNS dashboard.
5. **Docker Hub is not needed** — you'll push images to **GitHub Container Registry (GHCR)**, which is already tied to your GitHub account. Nothing to sign up for.

---

## Part 1 — Code changes in the repo

### 1.1 🧑‍💻 Merge the two database containers into one

⚠️ **Fix:** Right now `postgres` and `apache-age` are two independent containers with two independent datasets, and only `postgres` is wired into `DATABASE_URL`. The `apache-age` container is currently orphaned — nothing in the app connects to it. This also matches your own README's stated architecture ("Both use the same PostgreSQL database") better, and halves your DB memory footprint, which matters on a small free VM.

Create `docker/db/Dockerfile`:

```dockerfile
# docker/db/Dockerfile
FROM postgres:17

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    git \
    postgresql-server-dev-17 \
    flex \
    bison \
    libreadline-dev \
    zlib1g-dev \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Build Apache AGE from source (no official arm64 image exists for the
# pre-built apache/age Docker image, but the extension itself is a normal
# PGXS build and compiles fine on arm64).
# Check https://github.com/apache/age/branches for the tag/branch matching
# PostgreSQL 17 before running this — the branch name below may need updating.
RUN git clone --depth 1 --branch PG17 https://github.com/apache/age.git /tmp/age \
  && cd /tmp/age \
  && make PG_CONFIG=/usr/lib/postgresql/17/bin/pg_config \
  && make PG_CONFIG=/usr/lib/postgresql/17/bin/pg_config install \
  && rm -rf /tmp/age
```

Replace the `postgres:` and `apache-age:` services in `docker-compose.yml` with a single service:

```yaml
services:
  postgres:
    build:
      context: .
      dockerfile: docker/db/Dockerfile
    container_name: lexgraph-postgres
    environment:
      POSTGRES_DB: lexgraph
      POSTGRES_USER: lexgraph
      POSTGRES_PASSWORD: lexgraph
    ports:
      - "5433:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./scripts/db/init-extensions.sql:/docker-entrypoint-initdb.d/01-init-extensions.sql:ro
      - ./scripts/db/init-age.sql:/docker-entrypoint-initdb.d/02-init-age.sql:ro
```

Keep `redis` and `api` as they are — delete the old `apache-age` block and merge its init script into the new `postgres` service as shown.

**Also drop the `web` service entirely from the OCI-side `docker-compose.yml`.** Since Vercel is serving the Next.js frontend, running a second copy in a container on the VM is unused weight on a box you're already keeping lean. If you want a fully self-hosted fallback that doesn't depend on Vercel later, you can reintroduce it — but for this plan, the VM only needs `postgres`, `redis`, `api`, and (from Part 5) `caddy`.

### 1.2 🧑‍💻 Verify the API port mapping is consistent

Since `server.ts` reads `process.env.PORT` dynamically, the container's listening port must match the published port mapping, or traffic will fail silently. In the current repo, `docker-compose.yml` already sets `PORT: 3001` and uses the mapping `"3001:3001"`, so they're aligned and this is not a current issue. However, this is a critical validation for any future config changes — if someone edits compose and sets `PORT: 3000` while keeping `"3001:3001"`, requests would hit a closed port. **This is worth documenting as a config invariant rather than a bug to fix right now.** Confirm `src/server.ts` still reads the env var (it does) and move on.

### 1.3 🧑‍💻 Confirm the ARM64 base images for `docker/api/Dockerfile` and `docker/web/Dockerfile`

I couldn't fetch these two files directly (GitHub blocked automated access to that path), so check them yourself:
- They should use a standard `node:20-slim` or similar base — Node's official images already publish arm64 builds, so this is usually a non-issue.
- If `docker/web/Dockerfile` uses `nginx:alpine` to serve a static build, that's also arm64-native — fine as is.

### 1.4 🧑‍💻 Set production CORS/env values

In `.env.example` (and wherever `src/server.ts` reads these), the API needs to allow your real frontend origin once deployed:

```
FRONTEND_URL=https://lexgraph.vercel.app
FRONTEND_URLS=https://lexgraph.vercel.app,https://lexgraph.duckdns.org
```

You'll set the real values as environment variables on the server (Part 6), not by editing `.env.example` itself — `.env.example` stays as a template with placeholder values only. Never commit a real `.env` file.

### 1.5 🧑‍💻 Set the frontend's API base URL

`web/` is a Next.js app. The API client (`api-client.ts`) reads `NEXT_PUBLIC_API_BASE_URL`. You'll set this in Vercel's dashboard (Part 8), not commit it — point it at whatever hostname you land on in Part 5 (e.g. `https://lexgraph.duckdns.org/api`).

### 1.6 🧑‍💻 Add a GitHub Actions workflow

Create `.github/workflows/deploy.yml`:

```yaml
name: Build and Deploy API

on:
  push:
    branches: [main]

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4

      - name: Set up QEMU
        uses: docker/setup-qemu-action@v3

      - name: Set up Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build and push DB image
        uses: docker/build-push-action@v5
        with:
          context: .
          file: docker/db/Dockerfile
          platforms: linux/arm64
          push: true
          tags: ghcr.io/${{ github.repository_owner }}/lexgraph-db:latest

      - name: Build and push API image
        uses: docker/build-push-action@v5
        with:
          context: .
          file: docker/api/Dockerfile
          platforms: linux/arm64
          push: true
          tags: ghcr.io/${{ github.repository_owner }}/lexgraph-api:latest

      # No web image build here — Vercel builds and deploys the Next.js
      # frontend directly from the repo (Part 8), independent of this workflow.

      - name: Deploy to OCI VM over SSH
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.OCI_HOST }}
          username: ubuntu
          key: ${{ secrets.OCI_SSH_KEY }}
          script: |
            cd ~/lexgraph
            docker compose pull
            docker compose up -d
            docker compose exec -T api npx prisma migrate deploy
```

Building `linux/arm64` images on GitHub's `ubuntu-latest` runner (which is amd64) requires QEMU emulation — the workflow above includes it. It's slower than native but free.

---

## Part 2 — Local validation (before touching Oracle Cloud)

🧑‍💻 On your own machine:

```bash
docker buildx create --use
docker buildx build --platform linux/arm64 -f docker/db/Dockerfile -t lexgraph-db:arm64-test . --load
docker run --rm -e POSTGRES_PASSWORD=test lexgraph-db:arm64-test &
# then connect and confirm:
docker exec -it <container> psql -U postgres -c "CREATE EXTENSION age; LOAD 'age'; SELECT * FROM ag_catalog.ag_graph;"
```

If `--load` fails because you're not on arm64 hardware natively, that's expected — Docker will emulate via QEMU, which is slower but validates the build succeeds. Confirm the extension loads before moving on. **This is the step most likely to reveal a problem — don't skip it.**

---

## Part 3 — Oracle Cloud VM (manual console steps)

🖱️ In the OCI Console:

1. **Compute → Instances → Create Instance.**
2. Name it `lexgraph-vm`.
3. Image: **Ubuntu 24.04** (or latest LTS).
4. Shape: click "Change Shape" → **Ampere → VM.Standard.A1.Flex** → set **2 OCPU / 12 GB memory** (this is the current Always Free ceiling as of mid-2026 — Oracle halved it from 4/24 in June 2026, so don't follow older guides that assume 4 OCPU/24 GB).
5. If you hit "Out of host capacity": this is common right now for A1 shapes. Either retry over the next few hours, or switch home region during a later signup (Frankfurt/Singapore tend to have availability more often than US regions).
6. Networking: use the default VCN, or create one. **Do not** open ports 5432/6379 on the security list — leave only 22 (SSH), 80, 443 open in Part 5.
7. Add your SSH public key (generate one locally first if you don't have one: `ssh-keygen -t ed25519`).
8. Boot volume: default (≤200 GB stays in the Always Free storage allowance).
9. Create. Note the **public IP address** — you'll need it for DNS and GitHub secrets.

---

## Part 4 — Server setup (manual, via SSH)

🖱️ SSH into the box: `ssh ubuntu@<public-ip>`

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y docker.io docker-compose-plugin git ufw fail2ban
sudo usermod -aG docker ubuntu
# log out and back in for the group change to apply

sudo ufw allow 22
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable

git clone https://github.com/<your-username>/LexGraph.git ~/lexgraph
cd ~/lexgraph
```

Create `~/lexgraph/.env` on the server (never commit this) with real values matching what you set in Part 1.4.

---

## Part 5 — DNS + HTTPS (DuckDNS + Caddy)

### 5.1 🖱️ Point DuckDNS at your VM

On the DuckDNS dashboard, set your subdomain's IP to the OCI public IP from Part 3. DuckDNS records propagate almost immediately.

### 5.2 🧑💻 Add Caddy as a reverse proxy

Add to `docker-compose.yml` (or a separate `docker-compose.prod.yml`):

```yaml
  caddy:
    image: caddy:2-alpine
    container_name: lexgraph-caddy
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data
    depends_on:
      - api

volumes:
  caddy_data:
```

Create `Caddyfile` at repo root — since the VM now only serves the API (the frontend lives on Vercel), this can be a single host:

```
lexgraph.duckdns.org {
    reverse_proxy api:3001
}
```

Point `NEXT_PUBLIC_API_BASE_URL` (Part 8) at `https://lexgraph.duckdns.org`. If you'd rather keep the API on its own subdomain for clarity, DuckDNS supports multiple free subdomains per account — just claim a second one (e.g. `lexgraph-api.duckdns.org`) and swap it into the Caddyfile.

Caddy will automatically request and renew a Let's Encrypt certificate the first time it starts, as long as DNS is already pointing at the server and ports 80/443 are reachable.

---

## Part 6 — GitHub Actions secrets (manual)

🖱️ In your GitHub repo → **Settings → Secrets and variables → Actions**, add:

| Secret | Value |
|---|---|
| `OCI_HOST` | your OCI public IP |
| `OCI_SSH_KEY` | the **private** key matching the public key you added in Part 3 |

`GITHUB_TOKEN` for GHCR push is automatic — no setup needed.

Push to `main` once these are set — the workflow from 1.6 will build, push, and deploy automatically.

---

## Part 7 — First deploy and data import

🖱️/🧑💻 On first push, SSH in and verify manually once before trusting the automation:

```bash
cd ~/lexgraph
docker compose ps        # all containers healthy?
docker compose logs api  # check for startup errors
docker compose exec api npx prisma migrate deploy
docker compose exec api npm run import:data   # only if you want the dataset loaded now
curl http://localhost:3001/health   # or whatever your health route is — confirm it exists in src/server.ts
```

---

## Part 8 — Vercel (manual + one config value)

🖱️ In Vercel:

1. **Add New Project** → import `LexGraph` from GitHub.
2. **Root Directory:** `web`.
3. Framework preset: Next.js — Vercel should auto-detect this from `web/package.json`.
4. **Environment Variables:** add `NEXT_PUBLIC_API_BASE_URL` = `https://lexgraph.duckdns.org` (matching whatever host you set in the Caddyfile).
5. Deploy.

---

## Part 9 — See it live

Once Part 8's build finishes:

1. Open the **`*.vercel.app` URL** Vercel gives you.
2. Confirm the page loads and a search/API call succeeds (this proves Vercel → DuckDNS/Caddy → API → Postgres+AGE is fully wired).
3. Optional: buy a real domain later and point it at Vercel (frontend) and a subdomain at your DuckDNS/Caddy setup (API) — this is the only step in the whole plan that costs money, and it's optional.

---

## Known gaps in this plan (be aware, not blocking)

- I could not read `docker/api/Dockerfile` contents directly — assumed a standard Node base image, which is almost certainly arm64-safe, but worth a 30-second glance.
- The exact Apache AGE branch/tag compatible with PostgreSQL 17 may have moved since this was written — check [github.com/apache/age/branches](https://github.com/apache/age/branches) before building the Dockerfile in 1.1.
- `docker/web/Dockerfile` is no longer used in this plan (Part 3 drops the `web` service in favor of Vercel) — you can leave it in the repo for a future self-hosted fallback, or remove it if you want to keep things tidy.