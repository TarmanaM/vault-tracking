# 016 — Global FX Sync Sharing, ExchangeRateHistory & 2-Line Wealth Trajectory

**Date:** 2026-11-15  
**Scope:** Multi-User FX Sync Sharing, Daily FX Rate History Table, & 2-Line Mark-to-Market Wealth Trajectory

---

## 1. Design Decisions

1. **Global `ExchangeRateHistory` Table (`application/prisma/schema.prisma`)**
   - Added `ExchangeRateHistory` (`baseCurrency`, `quoteCurrency`, `rateDate`, `rate`, `source`, `createdAt`, `@@unique([baseCurrency, quoteCurrency, rateDate])`) to persist daily FX rate snapshots whenever any user syncs FX rates or saves a manual FX override.

2. **Multi-User Global Sync Sharing (`application/src/lib/fxService.js`)**
   - `isFxSyncDue`, `syncFxRatesFromFrankfurter`, and `ensureFxRatesSyncedIfDue` now evaluate the oldest global `ExchangeRateCache.fetchedAt` across all active target currencies before calling Frankfurter v2.
   - If another user already synced that currency pair within the current user's `fxSyncIntervalDays` window, the external API call is skipped and the shared database cache is reused (`0` background threads/cronjobs).

3. **2-Line Wealth Trajectory Timeline (`analyticsWealth.service.js` & `WealthDistributionAndTimelineSection.jsx`)**
   - Merged transaction dates with `ExchangeRateHistory` snapshot dates so non-transaction days still plot FX movement.
   - Emits two series on `Wealth Trajectory Timeline`:
     - **Book / Locked Basis**: Net wealth using transaction-time locked FX rates.
     - **Mark-to-Market (Live FX)**: Net wealth valuing foreign-currency holdings using the historical/snapshot FX rate on each date (automatically shown alongside Book Basis when foreign currency holdings exist).

---

## 2. Files Modified
- `application/prisma/schema.prisma`
- `application/src/lib/fxService.js`
- `application/src/server/modules/analytics/analyticsWealth.service.js`
- `application/src/features/analytics/WealthDistributionAndTimelineSection.jsx`
