# Journal 012 — Title Autocomplete & Save-Time Card Suggestion (`/grill-me`)

**Date:** 2026-11-14  
**Scope:** Add Title Autocomplete (`ActionCard` + historical `Transaction` patterns) inside `+ Transaction`, reorder Title above Amount & Vault, and show a persistent in-house suggestion dialog on Save (`"Do you want to make a card?"` / `"Link to Existing Card?"`).

## Agreed Design Decisions
1. **Form Reorder & Safe Autofill ([CustomTransactionModal.jsx](file:///d:/Isa%20Tarmana/software/learning-code/vault-tracking/application/src/components/CustomTransactionModal.jsx))**:
   - Move **Transaction Title (Autocomplete)** & Category right below **Nature Pills**, above **Hero Amount** and **Vault Picker**.
   - Autocomplete merges active/soft-hidden Action Cards (`[Card]`) and grouped non-child Transaction history (`[History]`).
   - Selecting a suggestion autofills Nature, Vault/Sub-Vault (plus Target Vault/Sub-Vault for `TRANSFER`), Category, Party, and fills Amount **only if empty** so user-entered custom amounts are never overwritten.
   - Selecting a `[Card]` binds `actionCardId` when saving, updating `CardHabitStats` and avoiding duplicate card creation.
2. **Deterministic Save-Time Suggestion Trigger (`>= 1` Prior Match)**:
   - On saving an ad-hoc transaction (where `presetCard` and Autocomplete `[Card]` were not used):
     - If an active card already shares the same normalized `title` & `nature` → prompt **`LINK_EXISTING`** (*"Card already exists — link this transaction?"*).
     - Else if **at least 1 previous matching transaction** exists (`totalCount >= 2` including the new tx) and `(nature::normalizedTitle)` is not muted → prompt **`CREATE_CARD`** with deterministic reasons (occurrence count, typical hour window, most frequent vault & amount).
3. **Save-First Persistent Dialog & Toast Coordination**:
   - Saving always writes the transaction atomically first so data is never lost or delayed.
   - When triggered, a persistent MUI Dialog (`CardSuggestionModal.jsx`) opens without a 5s timer; the toast suppresses `+ CARD` in that case (keeping only `UNDO (5s)`), while first-time ad-hoc transactions continue showing `+ CARD`.
4. **Cross-Device Mute via `AppSetting`**:
   - Added `dismissedCardSuggestionsJson String @default("[]")` on `AppSetting` in [`schema.prisma`](file:///d:/Isa%20Tarmana/software/learning-code/vault-tracking/application/prisma/schema.prisma) so **`Don't Ask Again`** persists across Phone & Desktop.

## Implementation Status
- `[x]` Updated [`schema.prisma`](file:///d:/Isa%20Tarmana/software/learning-code/vault-tracking/application/prisma/schema.prisma) (`AppSetting.dismissedCardSuggestionsJson`) and ran migration `add_dismissed_card_suggestions`.
- `[x]` Backend (`cardPromotionUtils.js`, `cardPromotionService.js`, `api/transactions/route.js`, `api/transactions/title-suggestions/route.js`, `api/cards/suggestions/dismiss/route.js`).
- `[x]` Frontend (`useLedgerStore.js`, `CardSuggestionModal.jsx`, `CustomTransactionModal.jsx`, `Navigation/AppLayout.jsx`).

## Verification Notes
- Ran ESLint (`npm --prefix application run lint`, exit `0`).
- Ran `verify-title-autocomplete-suggestions.mjs` covering `makeSuggestionKey`, 1st-time silence, 2nd-time `CREATE_CARD` factual detection (`occurrenceCount`, `mostFrequentVaultName`, `typicalHourLabel`), child split exclusion, `LINK_EXISTING` prompt for forgotten existing cards, `getTransactionTitleSuggestions` (`[Card]` + grouped `[History]` without card duplication), and cross-device mute via `dismissCardSuggestionKey`.
