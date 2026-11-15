# 014 — Backlog 05 (Going Public) Grill-Me Decisions

Date: 2026-11-15
Source: `.agents/backlog/05-Going-public/note.txt` (#1–#8)

## Codebase Findings (pre-decision)

- `schema.prisma` uses `provider = "sqlite"`; no `$queryRaw` / `$executeRaw`, no `setInterval`, no in-memory SSE bus → DB switch is Prisma-only.
- Only `application/src/lib/mediaStorage.js` writes to disk (vault profile images, 3MB limit, base64 dataURL upload).
- Largest files: `ledgerService.js` (1277 lines), `CustomTransactionModal.jsx` (1275), 8 files > 500 lines; 46 `console.*` calls.
- Route handlers mix validation + Prisma queries + business logic (e.g. `api/vaults/route.js` 305 lines) with repeated `requireUser` / try-catch boilerplate.
- `src/lib/` mixes server-only (`prisma.js`, `auth.js`, services) and client-safe helpers (`money.js`, `currencyHelpers.js`, `spendingLayers.js`).
- Security: `auth.js` has hardcoded `JWT_SECRET` fallback; `seed.js` defaults admin password `admin123`.
- Vercel facts: read-only filesystem (only ephemeral `/tmp`), 4.5MB request body limit, Vercel Postgres discontinued (now Marketplace: Neon / Supabase / Prisma Postgres).

## Decisions

| # | Topic | Decision |
|---|---|---|
| 1–3 | Cloud DB | **Neon Postgres** (via Vercel Marketplace). Current data is dummy → no data migration; SQLite migration history replaced by a fresh Postgres baseline (user runs `prisma migrate dev`, Rule 18). |
| 3 | DB strategy | **Postgres everywhere** (single `schema.prisma`). Portability = change `DATABASE_URL`; keep "no raw SQL" rule. |
| 3 | Schema types | Default `Decimal` (no `@db.*`), enums stay `String` (validated by zod) for maximum portability. |
| 5 | Media | Store in Postgres (`bytea` via new media table, `userId`-scoped) + client-side WebP compression/resize before upload. |
| 5 | Old data | Delete `data-server/main.db` and `data-server/media/` (dummy). |
| 4 | Architecture | **Full layered refactor**, domain by domain: `src/server/` (server-only: db, http/apiHandler, logger, modules/<domain>/{repository,service,validator}), `src/shared/` (client-safe pure helpers), `src/features/<domain>/` (client components + React Query hooks), `src/components/ui/`. Targets: files ≈ ≤300 lines, route handlers ≤50 lines, Prisma queries only in `*.repository.js`. |
| 4 | Tests | Unit-test framework postponed. Safety net = `lint` + `build` + HTTP integration script moved to `application/scripts/` (adapted for Postgres), run at each domain checkpoint. |
| 4 | Logging | In-house `logger.js` (`LOG_LEVEL` env, JSON in production, pretty in dev, requestId, sensitive-field redaction). |
| 4 | Validation | **zod** (schemas shared between server validators and client forms). |
| — | Security | Only **fail-fast `JWT_SECRET`** in production (remove hardcoded fallback). Declined for now: seed hardening, DB-based login lockout, security headers. |
| 8 | Docker | Multi-stage `Dockerfile` with Next.js `output: "standalone"`; single `docker-compose.yml` (Postgres + production app). Dev stays `npm run dev` on host. |
| 8 | Migrations | **Manual**: user runs `prisma migrate deploy` against target DB (Docker & Vercel); not auto-run in entrypoint/build command. |
| 6–7 | Docs | **English**. Root `README.md` (non-technical user guide + end-to-end mermaid), `docs/DEPLOY-VERCEL.md`, `docs/DEPLOY-DOCKER.md`, `docs/ARCHITECTURE.md`. |
| — | AGENTS.md | Update: Postgres/Neon, media in DB, Vercel/Docker deployment, layered architecture conventions. |
| — | Execution | Phase 1 → 5; implementation plan artifact reviewed by user before starting. |


## Implementation Status (Completed)

- **Phase 1 (PostgreSQL & In-DB Media)**: `application/prisma/schema.prisma` switched to `postgresql` (`DATABASE_URL` + `DIRECT_URL`), `MediaAsset` (`bytea`) added, legacy SQLite migrations and `data-server/` deleted, `application/scripts/verify-v2-api.mjs` added.
- **Phase 2 (Foundation Layer)**: `src/server/logger.js`, `src/server/db/prisma.js`, `src/server/http/{errors,apiHandler}.js`, `src/shared/*`, `src/shared/schemas/index.js`, and fail-fast `JWT_SECRET` in production implemented.
- **Phase 3 (Server Domain Modules & Thin API Routes)**: Extracted domain services/repositories under `src/server/modules/` and converted all 25 API routes under `src/app/api/` to thin `withApiHandler` wrappers with zero `console.error`.
- **Phase 4 (Client Feature Modularization & WebP Compression)**: Extracted modular feature components under `src/features/{vaults,transactions,analytics,settings}/` and implemented client-side WebP compression (`image/webp`, quality `0.85`).
- **Phase 5 (Docker, English Docs & Context Update)**: Added `output: "standalone"`, `Dockerfile`, `.dockerignore`, `docker-compose.yml`, `README.md`, `docs/DEPLOY-VERCEL.md`, `docs/DEPLOY-DOCKER.md`, `docs/ARCHITECTURE.md`, and updated `AGENTS.md`.
