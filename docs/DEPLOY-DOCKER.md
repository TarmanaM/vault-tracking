# Deploying Vault Tracking with Docker & Docker Compose

This guide explains how to run **Vault Tracking** and **PostgreSQL 17** in production containers using **Docker** and **Docker Compose** on a home server, NAS, or VPS.

---

## Architecture Overview

The repository root includes:
- [`Dockerfile`](../Dockerfile): Multi-stage `node:22-alpine` build using Next.js `output: "standalone"` for a minimal production footprint.
- [`docker-compose.yml`](../docker-compose.yml): Launches two services:
  - `db`: `postgres:17-alpine` with a persistent named volume (`vault_pgdata`) and healthcheck.
  - `app`: The standalone Next.js production server listening on port `3000`.

---

## Step 1: Configure Environment Variables

Create a `.env` file in the **repository root** (next to `docker-compose.yml`) or export the variables in your shell:

```ini
POSTGRES_USER=postgres
POSTGRES_PASSWORD=change_this_postgres_password
POSTGRES_DB=vault_tracking
POSTGRES_PORT=5432

APP_PORT=3000
JWT_SECRET=replace-with-a-random-secret-key-at-least-32-characters-long
INITIAL_ADMIN_USERNAME=admin
INITIAL_ADMIN_PASSWORD=ChangeMe123!
LOG_LEVEL=info
```

> [!IMPORTANT]
> `JWT_SECRET` must be at least **32 characters** in production (`NODE_ENV=production`). You can generate one with:
> ```bash
> node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
> ```

---

## Step 2: Build and Start the Containers

From the repository root, run:

```bash
docker compose up -d --build
```

Verify both containers are healthy:

```bash
docker compose ps
```

---

## Step 3: Run Prisma Migrations & Seed the Initial Admin

Migrations and seeding are intentionally executed explicitly from the host machine so you always control schema changes against your database, while keeping the `app` production image minimal (`output: "standalone"` without Prisma CLI bloat).

Point `application/.env` to `localhost:${POSTGRES_PORT:-5432}` (matching `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, plus `INITIAL_ADMIN_USERNAME` and `INITIAL_ADMIN_PASSWORD` if you want custom credentials), then run:

```bash
cd application
npm ci
npx prisma migrate deploy
npx prisma db seed
```

> [!NOTE]
> The `app` container uses Next.js `output: "standalone"` and runs as a non-root `nextjs` user, so `prisma` CLI is intentionally excluded from the runtime image. Always run `prisma migrate deploy` and `prisma db seed` from your host (or CI/CD runner) pointing at the exposed PostgreSQL port.

---

## Step 4: Access Vault Tracking

1. Open `http://localhost:3000` (or `http://<your-server-lan-ip>:3000` from your phone on the same WiFi/Tailscale network).
2. Sign in with `INITIAL_ADMIN_USERNAME` and `INITIAL_ADMIN_PASSWORD`.
3. Change your password when prompted and complete the Lifestyle Onboarding Wizard.

---

## Inspecting Logs & Backups

- **View structured JSON logs**:
  ```bash
  docker compose logs -f app
  ```
- **Backup PostgreSQL database (including all ledger rows and WebP vault avatars)**:
  ```bash
  docker compose exec db pg_dump -U postgres vault_tracking > backup_$(date +%F).sql
  ```
