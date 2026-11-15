# Deploying Vault Tracking on Vercel + Neon PostgreSQL (Free Tier)

This guide walks you through deploying **Vault Tracking** to **Vercel** (Hobby Free Tier) backed by **Neon Serverless PostgreSQL** (Free Tier) at **$0/month**.

> [!NOTE]
> All uploaded vault avatars are cropped and compressed to WebP in the browser and stored directly inside PostgreSQL (`media_assets` table), so **no external S3/Blob bucket or persistent disk is required on Vercel**.

---

## Prerequisites

1. A free [GitHub](https://github.com/) account with this repository pushed.
2. A free [Neon](https://neon.tech/) account (or any managed PostgreSQL provider such as Supabase).
3. A free [Vercel](https://vercel.com/) account.

---

## Step 1: Create a Neon PostgreSQL Database

1. Log in to the [Neon Console](https://console.neon.tech/) and click **New Project**.
2. Choose a project name (e.g., `vault-tracking`) and a region close to you (e.g., `Singapore ap-southeast-1`).
3. In the Neon dashboard, click **Connect** to view your connection strings:
   - **Pooled connection string** (`-pooler` hostname) → use this for `DATABASE_URL`.
   - **Direct connection string** (non-pooler hostname) → use this for `DIRECT_URL`.

Example format:
```ini
DATABASE_URL="postgresql://neondb_owner:PASSWORD@ep-example-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&pgbouncer=true&connection_limit=1"
DIRECT_URL="postgresql://neondb_owner:PASSWORD@ep-example.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"
```

---

## Step 2: Run Database Migrations & Seed Initial Admin

From your local machine, configure `application/.env` with your Neon `DATABASE_URL` and `DIRECT_URL` (plus `INITIAL_ADMIN_USERNAME` and `INITIAL_ADMIN_PASSWORD`), then run:

```bash
cd application
npx prisma migrate deploy
npx prisma db seed
```

> [!TIP]
> If you are initializing the very first migration from `schema.prisma`, run:
> ```bash
> cd application
> npx prisma migrate dev --name init_postgres
> npx prisma db seed
> ```
> And commit the generated `application/prisma/migrations/` folder to Git.

---

## Step 3: Import the Project in Vercel

1. Open the [Vercel Dashboard](https://vercel.com/new) and import your GitHub repository.
2. Configure the **Root Directory**:
   - Click **Edit** next to **Root Directory** and select **`application`**.
3. Framework Preset will automatically detect **Next.js**.
4. Expand **Environment Variables** and add the following variables:

| Variable | Description | Example / Requirement |
| :--- | :--- | :--- |
| `DATABASE_URL` | Pooled PostgreSQL connection URL | `postgresql://...-pooler.../neondb?sslmode=require&pgbouncer=true&connection_limit=1` |
| `DIRECT_URL` | Direct PostgreSQL connection URL | `postgresql://.../neondb?sslmode=require` |
| `JWT_SECRET` | Secret key used to sign HTTP-only auth cookies | **Required in production**: random string with **at least 32 characters** (e.g., `openssl rand -hex 32`) |
| `LOG_LEVEL` | Structured server log level | `info` (options: `debug`, `info`, `warn`, `error`) |

> [!WARNING]
> In production (`NODE_ENV=production`), Vault Tracking enforces a fail-fast security check on `JWT_SECRET`. If `JWT_SECRET` is missing, shorter than 32 characters, or left as the placeholder value, authentication will refuse to start.

5. Click **Deploy**.

---

## Step 4: First Sign-In & Password Change

1. Once Vercel finishes building, open your deployment URL (`https://your-app.vercel.app`).
2. Sign in with the `INITIAL_ADMIN_USERNAME` and `INITIAL_ADMIN_PASSWORD` you seeded in Step 2.
3. You will be prompted to set a new personal password immediately, followed by the 3-step Lifestyle Onboarding Wizard.
