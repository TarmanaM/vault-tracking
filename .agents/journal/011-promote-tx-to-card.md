# Journal 011 — Save Transaction as Action Card (`/grill-me` Design & Implementation)

**Date:** 2026-11-14  
**Scope:** Promote-to-Card flow allowing frequent regular transactions to be converted directly into Smart Action Cards and surfaced in Recommended cards.

## Agreed Design Decisions
1. **Entry Points**:
   - Row action button (**Save as Card**) in [`ledger/page.js`](file:///d:/Isa%20Tarmana/software/learning-code/vault-tracking/application/src/app/ledger/page.js) on eligible operational transactions (`EXPENSE`, `INCOME`, `TRANSFER`, `RECEIVABLE_LEND`, `RECEIVABLE_COLLECT`, `PAYABLE_BORROW`, `PAYABLE_REPAY`, excluding child fee splits `parentTransactionId != null` and system rows `INITIAL_FUND`, `RECONCILIATION_*`, `DEBT_OFFSET`, `RECEIVABLE_WRITEOFF`).
   - Quick **`+ CARD`** button on the success Toast Snackbar ([`ToastProvider.jsx`](file:///d:/Isa%20Tarmana/software/learning-code/vault-tracking/application/src/components/ToastProvider.jsx)) immediately after recording a custom ad-hoc transaction via `CustomTransactionModal`.
2. **Pre-Filled Review Modal**:
   - Clicking either entry point opens a pre-filled confirmation modal so users can refine Title, `cardActionType`, `defaultAmount`, optional `quickAmounts`, Source Vault/Sub-Vault, Target Vault/Sub-Vault (`TRANSFER`), Category, Party, Cadence, and 1-Tap toggle before saving.
3. **Habit Seeding & 24-Hour Spotlight (`habitEngine.js`)**:
   - Creating a card from a transaction automatically seeds `CardHabitStats` by scanning the source transaction plus matching historical `Transaction` rows with identical normalized `title` & `nature` (populating `totalUses`, `hourCountsJson`, `dowCountsJson`, `avgIntervalDays`, `lastUsedTimestamp`, `lastUsedDate`, `mostFrequentAmount`, `mostFrequentVaultId`).
   - Sets elevated initial `pinPriority` (e.g. `8`) plus a **24-hour New Card Spotlight** rule in `calculateCardScore()` (bypassing same-day `-0.4` cooldown + adding `+25` spotlight bonus during the first 24 hours from `card.createdAt`, decaying automatically afterward).
4. **Linking Scope & Duplicate Handling**:
   - `actionCardId` is linked **only on the clicked source transaction** (older matching transactions are read-only during habit seeding).
   - Rows already linked to a card (`t.actionCardId != null`) hide the Save-as-Card button and display a small linked card badge instead.
   - If another active card with matching title & action type already exists, the preview modal warns the user and offers **Link to Existing Card** vs **Create Separate Card**.
5. **Schema Update**:
   - Added nullable `ActionCard.targetSubContainerId` (`ActionCardTargetSubContainer`) in [`schema.prisma`](file:///d:/Isa%20Tarmana/software/learning-code/vault-tracking/application/prisma/schema.prisma) so promoted `TRANSFER` cards preserve target pocket selection accurately, alongside native Valas currency awareness in `SmartActionCards.jsx`.

## Implementation Status
- `[x]` Updated [`schema.prisma`](file:///d:/Isa%20Tarmana/software/learning-code/vault-tracking/application/prisma/schema.prisma) (`ActionCard.targetSubContainerId`) and ran migration `add_action_card_target_subcontainer`.
- `[x]` Backend (`habitEngine.js`, `cardPromotionUtils.js`, `cardPromotionService.js`, `api/cards/route.js`, `api/cards/from-transaction/route.js`, `api/transactions/[id]/route.js`, `api/dashboard/route.js`).
- `[x]` Frontend (`PromoteToCardModal.jsx`, `useLedgerStore.js`, `ToastProvider.jsx`, `CustomTransactionModal.jsx`, `Navigation/AppLayout.jsx`, `ledger/page.js`, `app/page.js`, `SmartActionCards.jsx`, `ManageCardsModal.jsx`).

## Verification Notes
- Caught and fixed leg role extraction bug (`TransactionLeg.legRole` / `netMutation` instead of non-existent `legType` / `amount`) while running integration tests.
- Passed `verify-promote-card.mjs` covering eligibility checks, draft extraction, `CREATE` promotion with historical habit seeding, strict read-only historical linking (`actionCardId` only on source tx), 24-hour Spotlight score (`84` fresh vs `27` after 24h cooldown), `DUPLICATE_CARD` `409` detection + `LINK_EXISTING` increment, and `TRANSFER` `targetSubContainerId` + native `USD` amount preservation.
- Passed ESLint (`npm --prefix application run lint`, exit code `0`).
