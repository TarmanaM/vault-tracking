// Pure client-safe spending layer helpers for Vault Tracking v2.0

export const CLIENT_SPENDING_LAYER_META = {
  FIXED_MANDATORY: {
    key: "FIXED_MANDATORY",
    label: "Fixed & Bills",
    shortLabel: "Fixed",
    colorHex: "#2563EB",
    description: "Recurring obligations, fuel, parking, rent, utilities, and subscriptions.",
  },
  VARIABLE_ESSENTIAL: {
    key: "VARIABLE_ESSENTIAL",
    label: "Everyday Needs",
    shortLabel: "Essential",
    colorHex: "#F97316",
    description: "Groceries, daily meals, commuting, health, and essential upkeep.",
  },
  DISCRETIONARY_JAJAN: {
    key: "DISCRETIONARY_JAJAN",
    label: "Lifestyle & Wants",
    shortLabel: "Lifestyle",
    colorHex: "#D97706",
    description: "Coffee, dining out, entertainment, hobbies, and flexible personal spending.",
  },
  SOCIAL_CHARITY: {
    key: "SOCIAL_CHARITY",
    label: "Giving & Gifts",
    shortLabel: "Giving",
    colorHex: "#10B981",
    description: "Charity, donations, gifts for family and friends, or forgiven receivables.",
  },
  NONE: {
    key: "NONE",
    label: "Non-Spending",
    shortLabel: "System",
    colorHex: "#64748B",
    description: "Transfers, income, opening balances, and principal debt repayments.",
  },
  RECONCILIATION_LOST: {
    key: "RECONCILIATION_LOST",
    label: "Cash Shortage",
    shortLabel: "Audit",
    colorHex: "#DC2626",
    description: "Unexplained cash differences detected during vault audits.",
  },
};

export function getSpendingLayerMeta(commitmentType = "NONE") {
  const key = String(commitmentType || "NONE").toUpperCase();
  return (
    CLIENT_SPENDING_LAYER_META[key] || {
      key,
      label: key.replace(/_/g, " "),
      shortLabel: key,
      colorHex: "#64748B",
      description: "",
    }
  );
}
