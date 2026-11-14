// Pure client- and server-safe helpers for promoting ledger transactions to Smart Action Cards

export const ELIGIBLE_PROMOTE_NATURES = [
  "EXPENSE",
  "INCOME",
  "TRANSFER",
  "RECEIVABLE_LEND",
  "RECEIVABLE_COLLECT",
  "PAYABLE_BORROW",
  "PAYABLE_REPAY",
];

/**
 * Normalize a title string for case-insensitive comparison.
 * @param {string|null|undefined} title
 * @returns {string}
 */
export function normalizeCardTitle(title) {
  return String(title || "").trim().toLowerCase();
}

/**
 * Build a stable lookup key combining nature and normalized title.
 * @param {string|null|undefined} nature
 * @param {string|null|undefined} title
 * @returns {string}
 */
export function makeSuggestionKey(nature, title) {
  return `${String(nature || "EXPENSE").trim().toUpperCase()}::${normalizeCardTitle(title)}`;
}

/**
 * Determine whether a transaction row is eligible to be saved/promoted as an Action Card.
 * Excludes system bookkeeping entries, child split rows, and transactions already linked to a card.
 * @param {Object|null|undefined} tx
 * @returns {boolean}
 */
export function isTransactionPromotable(tx) {
  if (!tx) return false;
  if (tx.parentTransactionId != null) return false;
  if (tx.actionCardId != null) return false;
  return ELIGIBLE_PROMOTE_NATURES.includes(tx.nature);
}

/**
 * Extract pre-filled Action Card form defaults from either a full Transaction (with legs)
 * or a submission snapshot captured right after recording a new transaction.
 * @param {Object|null|undefined} tx
 * @returns {Object|null}
 */
export function extractCardDraftFromTransaction(tx) {
  if (!tx) return null;

  const legs = Array.isArray(tx.legs) ? tx.legs : [];
  const primaryLeg =
    legs.find((leg) => leg.vaultId != null && leg.legRole === "PRIMARY") ||
    legs.find((leg) => leg.vaultId != null && Number(leg.netMutation ?? 0) < 0) ||
    legs.find((leg) => leg.vaultId != null);
  const transferTargetLeg =
    legs.find((leg) => leg.vaultId != null && leg.legRole === "TRANSFER_TARGET") ||
    legs.find((leg) => leg.vaultId != null && Number(leg.netMutation ?? 0) > 0 && leg !== primaryLeg);

  const rawDefaultAmount =
    tx.originalGrossAmount != null && Number(tx.originalGrossAmount) > 0
      ? Number(tx.originalGrossAmount)
      : Number(tx.grossAmount || 0);

  return {
    sourceTransactionId: tx.id,
    title: String(tx.title || "").trim(),
    cardActionType: ELIGIBLE_PROMOTE_NATURES.includes(tx.nature) ? tx.nature : "EXPENSE",
    defaultAmount: Number.isFinite(rawDefaultAmount) ? rawDefaultAmount : 0,
    currency: tx.currency || primaryLeg?.subContainer?.currency || primaryLeg?.currency || "IDR",
    defaultVaultId: tx.sourceVaultId ?? primaryLeg?.vaultId ?? null,
    defaultSubContainerId: tx.sourceSubContainerId ?? primaryLeg?.subContainerId ?? null,
    targetVaultId:
      tx.nature === "TRANSFER" ? tx.targetVaultId ?? transferTargetLeg?.vaultId ?? null : null,
    targetSubContainerId:
      tx.nature === "TRANSFER" ? tx.targetSubContainerId ?? transferTargetLeg?.subContainerId ?? null : null,
    defaultCategoryId: tx.categoryId ?? null,
    defaultPartyId: tx.partyId ?? null,
    expectedCadence: "ON_DEMAND",
    oneTapSubmit: false,
    quickAmounts: [],
  };
}
