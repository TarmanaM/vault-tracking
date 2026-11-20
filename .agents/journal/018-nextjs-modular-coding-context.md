# 018 — Next.js Modular Architecture Compliance (`.agents/CodingContext.md`)

**Date:** 2026-11-16  
**Scope:** Full App Router Page Refactoring (`page.js` Server Component + `[Feature]UI.jsx` + `use[Feature]Logic.js`) & `AGENTS.md` Rule Update

---

## 1. Summary of Changes

1. **Updated `AGENTS.md`**
   - Added reference to [`.agents/CodingContext.md`](file:///d:/Isa%20Tarmana/software/learning-code/vault-tracking/.agents/CodingContext.md) under *Layered Codebase Architecture*, *Context & Checkpoint Directory*, and *Core Rules & Behavioral Guidelines* (Rule 14: Next.js Modular Page & Component Architecture — Server `page.js` Entrypoint, `[Feature]UI.jsx`, `use[Feature]Logic.js`, and lazy `"use client"`).

2. **Refactored All 11 App Router Pages (`application/src/app/**`)**
   Removed `"use client"` and monolithic state/fetching logic from every `page.js` entrypoint, splitting each route into a declarative Server Component `page.js`, a visual `[Feature]UI.jsx`, and a colocated `use[Feature]Logic.js` custom hook:
   - `/` (`src/app/page.js`, `DashboardUI.jsx`, `useDashboardLogic.js`)
   - `/login` (`src/app/login/page.js`, `LoginUI.jsx`, `useLoginLogic.js`)
   - `/force-password-change` (`src/app/force-password-change/page.js`, `ForcePasswordChangeUI.jsx`, `useForcePasswordChangeLogic.js`)
   - `/onboarding` (`src/app/onboarding/page.js`, `OnboardingUI.jsx`, `useOnboardingLogic.js`)
   - `/settings` (`src/app/settings/page.js`, `SettingsUI.jsx`, `useSettingsLogic.js`)
   - `/admin` (`src/app/admin/page.js`, `AdminUI.jsx`, `useAdminLogic.js`)
   - `/analytics` (`src/app/analytics/page.js`, `AnalyticsUI.jsx`, `useAnalyticsLogic.js`)
   - `/checkpoints` (`src/app/checkpoints/page.js`, `CheckpointsUI.jsx`, `useCheckpointsLogic.js`)
   - `/ledger` (`src/app/ledger/page.js`, `LedgerUI.jsx`, `useLedgerLogic.js`)
   - `/debts` (`src/app/debts/page.js`, `DebtsUI.jsx`, `useDebtsLogic.js`)
   - `/debts/[id]` (`src/app/debts/[id]/page.js`, `PartyDebtDetailUI.jsx`, `usePartyDebtDetailLogic.js`)
