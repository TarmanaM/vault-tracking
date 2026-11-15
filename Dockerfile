# syntax=docker/dockerfile:1
# Multi-stage production Dockerfile for Vault Tracking (Next.js 15 standalone + Prisma 6 + PostgreSQL)

FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat openssl

FROM base AS deps
WORKDIR /app
COPY application/package.json application/package-lock.json ./
COPY application/prisma ./prisma/
RUN npm ci

FROM base AS builder
WORKDIR /app
ARG DATABASE_URL="postgresql://postgres:postgres@localhost:5432/vault_tracking?schema=public"
ARG DIRECT_URL="postgresql://postgres:postgres@localhost:5432/vault_tracking?schema=public"
ENV DATABASE_URL=$DATABASE_URL
ENV DIRECT_URL=$DIRECT_URL
COPY --from=deps /app/node_modules ./node_modules
COPY application/ ./
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate --schema=./prisma/schema.prisma
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/prisma.config.ts ./prisma.config.ts

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
