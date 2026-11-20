"use client";

import React, { useState, useMemo } from "react";
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Chip,
  Button,
  Stack,
  IconButton,
  Tabs,
  Tab,
  TextField,
  Menu,
  MenuItem,
  Popover,
  InputAdornment,
  Collapse,
} from "@mui/material";
import FlashOnIcon from "@mui/icons-material/FlashOn";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import ShowChartIcon from "@mui/icons-material/ShowChart";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import TuneOutlinedIcon from "@mui/icons-material/TuneOutlined";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLedgerStore } from "@/store/useLedgerStore";
import CurrencyTextField from "@/components/common/CurrencyTextField";
import MoneyValue from "@/components/common/MoneyValue";
import CoinExpenseControls from "@/components/transactions/CoinExpenseControls";
import { isPhysicalCashVault, isSelectableSpendVault } from "@/lib/vaultHelpers";

export default function SmartActionCards({
  actionCards = [],
  searchableCards = [],
  vaults = [],
  parties = [],
  defaultMonthlyVaultId = null,
  defaultCashVaultId = null,
  baseCurrency = "IDR",
}) {
  const queryClient = useQueryClient();
  const {
    openTransactionDialog,
    openManageCardsDialog,
    openChartDrawer,
    enqueueToast,
  } = useLedgerStore();

  const [viewTab, setViewTab] = useState(0); // 0 = Recommended, 1 = All Cards & Search
  const [visibleRecommendedCount, setVisibleRecommendedCount] = useState(5);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");

  // Per-card local interactive overrides (#16 inline manual amount, #18 reset, Backlog 02 #1/#4/#9)
  const [vaultOverrides, setVaultOverrides] = useState({});
  const [amountOverrides, setAmountOverrides] = useState({});
  const [openCustomInputs, setOpenCustomInputs] = useState({});
  const [expandedTitles, setExpandedTitles] = useState({});
  const [taxOverrides, setTaxOverrides] = useState({});
  const [coinModeOverrides, setCoinModeOverrides] = useState({});
  const [coinUsedOverrides, setCoinUsedOverrides] = useState({});
  const [coinOverrides, setCoinOverrides] = useState({});
  const [expandedExtras, setExpandedExtras] = useState({});

  // Menu & info popovers
  const [menuState, setMenuState] = useState({ anchorEl: null, card: null });
  const [infoAnchor, setInfoAnchor] = useState(null);

  const selfPartyId = useMemo(() => {
    const selfP = parties.find((p) => p.code === "SELF" || p.partyType === "SELF");
    return selfP?.id || parties[0]?.id || 1;
  }, [parties]);

  const liquidVaults = useMemo(
    () => vaults.filter(isSelectableSpendVault),
    [vaults]
  );

  // Resolve dynamic default vault hierarchy per card (#4): card habit -> card static default -> monthly top -> CASH -> first vault
  const getDefaultCardVaultId = (card) =>
    card?.habitVaultId ||
    card?.defaultVaultId ||
    defaultMonthlyVaultId ||
    defaultCashVaultId ||
    liquidVaults[0]?.id;

  const displayedCards = useMemo(() => {
    if (viewTab === 0) return actionCards;
    return searchableCards.filter((card) => {
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        card.title.toLowerCase().includes(q) ||
        (card.subtitle && card.subtitle.toLowerCase().includes(q)) ||
        (card.defaultCategory?.name && card.defaultCategory.name.toLowerCase().includes(q));

      const matchesType =
        typeFilter === "ALL" ||
        (typeFilter === "DEBT"
          ? card.cardActionType === "RECEIVABLE_LEND" ||
            card.cardActionType === "RECEIVABLE_COLLECT" ||
            card.cardActionType === "PAYABLE_BORROW" ||
            card.cardActionType === "PAYABLE_REPAY"
          : card.cardActionType === typeFilter);

      return matchesSearch && matchesType;
    });
  }, [viewTab, actionCards, searchableCards, searchQuery, typeFilter]);

  const resetCardOverrides = (cardId) => {
    setVaultOverrides((prev) => {
      const next = { ...prev };
      delete next[cardId];
      return next;
    });
    setAmountOverrides((prev) => {
      const next = { ...prev };
      delete next[cardId];
      return next;
    });
    setOpenCustomInputs((prev) => {
      const next = { ...prev };
      delete next[cardId];
      return next;
    });
    setTaxOverrides((prev) => {
      const next = { ...prev };
      delete next[cardId];
      return next;
    });
    setCoinModeOverrides((prev) => {
      const next = { ...prev };
      delete next[cardId];
      return next;
    });
    setCoinUsedOverrides((prev) => {
      const next = { ...prev };
      delete next[cardId];
      return next;
    });
    setCoinOverrides((prev) => {
      const next = { ...prev };
      delete next[cardId];
      return next;
    });
    setExpandedExtras((prev) => ({ ...prev, [cardId]: false }));
  };

  const hasCardOverrides = (card) => {
    const defaultVaultForCard = getDefaultCardVaultId(card);
    return (
      (vaultOverrides[card.id] && vaultOverrides[card.id] !== defaultVaultForCard) ||
      (amountOverrides[card.id] !== undefined && amountOverrides[card.id] !== "") ||
      (taxOverrides[card.id] !== undefined && taxOverrides[card.id] !== "" && Number(taxOverrides[card.id]) > 0) ||
      (coinUsedOverrides[card.id] !== undefined && coinUsedOverrides[card.id] !== "" && Number(coinUsedOverrides[card.id]) > 0) ||
      (coinOverrides[card.id] !== undefined && coinOverrides[card.id] !== "" && Number(coinOverrides[card.id]) > 0)
    );
  };

  const executeCardMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Transaction failed");
      return data.data;
    },
    onSuccess: (createdTx, vars) => {
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
      queryClient.invalidateQueries({ queryKey: ["debts"] });
      queryClient.invalidateQueries({ queryKey: ["debt-detail"] });
      queryClient.invalidateQueries({ queryKey: ["checkpoints"] });

      if (vars.actionCardId) {
        resetCardOverrides(vars.actionCardId);
      }

      enqueueToast(`Recorded "${vars.title}"`, {
        severity: "success",
        undoTransactionId: createdTx.id,
      });

      if (createdTx?.subVaultWarning) {
        enqueueToast(
          `Warning: "${vars.title}" crossed into synced sub-vault splits for that vault.`,
          { severity: "warning" }
        );
      }
    },
    onError: (err) => {
      enqueueToast(err.message, { severity: "error" });
    },
  });

  const patchVisibilityMutation = useMutation({
    mutationFn: async ({ id, visibilityMode }) => {
      const res = await fetch("/api/cards", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, visibilityMode }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data;
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["cards"] });
      const label =
        updated.visibilityMode === "SOFT_HIDDEN"
          ? "Moved to All Cards (Soft-Hidden)"
          : updated.visibilityMode === "ARCHIVED"
          ? "Archived card"
          : "Restored to Recommended";
      enqueueToast(`${label}: "${updated.title}"`, { severity: "info" });
      setMenuState({ anchorEl: null, card: null });
    },
    onError: (err) => {
      enqueueToast(err.message, { severity: "error" });
    },
  });

  const handleCardSubmit = (card) => {
    const selectedVaultId = vaultOverrides[card.id] || getDefaultCardVaultId(card);
    const selectedVaultObj = vaults.find((v) => v.id === selectedVaultId);
    const allowCoinForCard =
      (card.cardActionType || "EXPENSE") === "EXPENSE" && isPhysicalCashVault(selectedVaultObj);

    const overrideAmt = amountOverrides[card.id];
    const effectiveAmount =
      overrideAmt !== undefined && overrideAmt !== "" && Number(overrideAmt) > 0
        ? Number(overrideAmt)
        : Number(card.defaultAmount) || 0;

    if (effectiveAmount <= 0) {
      enqueueToast(`Enter an amount for "${card.title}"`, { severity: "warning" });
      return;
    }

    const coinMode = coinModeOverrides[card.id] || "NONE";
    const coinUsedVal = allowCoinForCard && coinMode === "SPLIT" ? Number(coinUsedOverrides[card.id]) || 0 : 0;
    const coinChangeVal = allowCoinForCard && coinMode === "CHANGE" ? Number(coinOverrides[card.id]) || 0 : 0;

    if (coinUsedVal > effectiveAmount) {
      enqueueToast("Coin split payment cannot exceed transaction amount.", { severity: "warning" });
      return;
    }

    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    const selectedSubObj =
      selectedVaultObj && selectedVaultId === card.defaultVaultId && card.defaultSubContainerId
        ? selectedVaultObj.subContainers?.find((sc) => sc.id === card.defaultSubContainerId) ||
          card.defaultSubContainer ||
          null
        : null;
    const selectedSubId = selectedSubObj?.id || null;
    const effectiveCurrency = selectedSubObj?.currency || baseCurrency;

    executeCardMutation.mutate({
      title: card.title,
      nature: card.cardActionType || "EXPENSE",
      categoryId: card.defaultCategoryId,
      commitmentType: card.defaultCategory?.commitmentType || "NONE",
      priorityTier: card.defaultCategory?.priorityTier || "NONE",
      partyId: card.defaultPartyId || selfPartyId,
      actionCardId: card.id,
      sourceVaultId: selectedVaultId,
      sourceSubContainerId: selectedSubId,
      targetVaultId: card.targetVaultId || null,
      targetSubContainerId: card.targetSubContainerId || null,
      currency: effectiveCurrency,
      grossAmount: effectiveAmount,
      taxFeeAmount: Number(taxOverrides[card.id]) || 0,
      coinUsedAmount: coinUsedVal,
      coinChangeAmount: coinChangeVal,
      transactionDate: `${dateStr}T${timeStr}:00`,
      transactionTime: timeStr,
      payableMode: card.cardActionType === "PAYABLE_BORROW" ? "EXPENSE_TALANG" : undefined,
    });
  };

  return (
    <Box sx={{ mb: 3 }}>
      {/* Top Bar */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 1, mb: 1.5 }}>
        <Stack direction="row" spacing={0.5} alignItems="center">
          <FlashOnIcon color="primary" fontSize="small" />
          <Typography variant="subtitle1" sx={{ fontWeight: 800, color: "#0F172A" }}>
            Smart Action Cards
          </Typography>
          <IconButton size="small" onClick={(e) => setInfoAnchor(e.currentTarget)}>
            <InfoOutlinedIcon fontSize="small" sx={{ color: "#64748B" }} />
          </IconButton>
        </Stack>

        <Stack direction="row" spacing={1} alignItems="center">
          <Button
            size="small"
            variant="outlined"
            startIcon={<SettingsOutlinedIcon />}
            onClick={openManageCardsDialog}
            sx={{ fontSize: "0.75rem", fontWeight: 700, borderColor: "#CBD5E1", color: "#334155" }}
          >
            Manage Cards
          </Button>
        </Stack>
      </Box>

      {/* Info Popover (Rule 11) */}
      <Popover
        open={Boolean(infoAnchor)}
        anchorEl={infoAnchor}
        onClose={() => setInfoAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
      >
        <Typography variant="caption" sx={{ p: 1.5, display: "block", maxWidth: 300 }}>
          <strong>In-House Habit Engine:</strong> Automatically ranks cards by frequency, time-of-day match, and day-of-week patterns. Switch vaults with 1 tap, type a custom inline amount, or undo any tap within 5 seconds.
        </Typography>
      </Popover>

      {/* Recommended vs All Cards Tabs (#23) */}
      <Box sx={{ borderBottom: 1, borderColor: "#E2E8F0", mb: 2 }}>
        <Tabs value={viewTab} onChange={(_, val) => setViewTab(val)} sx={{ minHeight: 38 }}>
          <Tab label={`Recommended (${actionCards.length})`} sx={{ minHeight: 38, py: 0.5, fontSize: "0.8rem", fontWeight: 700 }} />
          <Tab label={`All Cards & Search (${searchableCards.length})`} sx={{ minHeight: 38, py: 0.5, fontSize: "0.8rem", fontWeight: 700 }} />
        </Tabs>
      </Box>

      {/* Search & Filter Row in All Cards Mode */}
      {viewTab === 1 && (
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ sm: "center" }} sx={{ mb: 2 }}>
          <TextField
            size="small"
            placeholder="Search action card or category..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            sx={{ minWidth: { sm: 260 }, bgcolor: "#FFFFFF" }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" color="action" />
                </InputAdornment>
              ),
              endAdornment: searchQuery ? (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setSearchQuery("")}>
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ) : null,
            }}
          />

          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
            {[
              { value: "ALL", label: "All" },
              { value: "EXPENSE", label: "Expense" },
              { value: "TRANSFER", label: "Transfer" },
              { value: "DEBT", label: "Debt" },
              { value: "INCOME", label: "Income" },
            ].map((f) => (
              <Chip
                key={f.value}
                label={f.label}
                size="small"
                clickable
                color={typeFilter === f.value ? "primary" : "default"}
                variant={typeFilter === f.value ? "filled" : "outlined"}
                onClick={() => setTypeFilter(f.value)}
              />
            ))}
          </Stack>
        </Stack>
      )}

      {/* Action Cards Grid (#6 5-card pagination in Recommended tab, #9 2 cols desktop / 1 col mobile) */}
      {displayedCards.length === 0 ? (
        <Card variant="outlined" sx={{ p: 3, textAlign: "center", bgcolor: "#FFFFFF" }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            No matching Smart Action Cards found.
          </Typography>
          <Button size="small" variant="outlined" onClick={openManageCardsDialog}>
            + Create New Action Card
          </Button>
        </Card>
      ) : (
        <>
          <Grid container spacing={{ xs: 1.25, sm: 2 }}>
            {(viewTab === 0 ? displayedCards.slice(0, visibleRecommendedCount) : displayedCards).map((card) => {
              const activeVaultId = vaultOverrides[card.id] || getDefaultCardVaultId(card);
              const activeVaultObj = vaults.find((v) => v.id === activeVaultId);
              const activeSubObj =
                activeVaultId === card.defaultVaultId && card.defaultSubContainerId
                  ? activeVaultObj?.subContainers?.find((sc) => sc.id === card.defaultSubContainerId) ||
                    card.defaultSubContainer ||
                    null
                  : null;
              const cardCurrency = activeSubObj?.currency || baseCurrency;
              const isCashExpense =
                (card.cardActionType || "EXPENSE") === "EXPENSE" &&
                isPhysicalCashVault(activeVaultObj);

              const overrideAmt = amountOverrides[card.id];
              const defaultAmt = Number(card.defaultAmount) || 0;
              const effectiveAmt =
                overrideAmt !== undefined && overrideAmt !== "" && Number(overrideAmt) > 0
                  ? Number(overrideAmt)
                  : defaultAmt;

              let quickAmounts = [];
              try {
                quickAmounts = card.quickAmountsJson ? JSON.parse(card.quickAmountsJson) : [];
                if (!Array.isArray(quickAmounts)) quickAmounts = [];
              } catch {
                quickAmounts = [];
              }

              const hasNoPresets = quickAmounts.length === 0 && defaultAmt === 0;
              const isCustomOpen = hasNoPresets || Boolean(openCustomInputs[card.id]);
              const isTitleExpanded = Boolean(expandedTitles[card.id]);
              const isModified = hasCardOverrides(card);
              const showExtras = Boolean(expandedExtras[card.id]) || (isCashExpense && Boolean(card.isCoinChangeCapable));

              return (
                <Grid size={{ xs: 12, md: 6 }} key={card.id}>
                  <Card
                    sx={{
                      height: "100%",
                      display: "flex",
                      flexDirection: "column",
                      border: card.visibilityMode === "SOFT_HIDDEN" ? "1px dashed #94A3B8" : "1px solid #E2E8F0",
                    }}
                  >
                    <CardContent sx={{ p: { xs: 1.5, sm: 2 }, flexGrow: 1, display: "flex", flexDirection: "column", gap: 1 }}>
                      {/* Card Header (#9 tap truncated title to expand/wrap without widening card) */}
                      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 1 }}>
                        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                          <Stack direction="row" spacing={0.75} alignItems="flex-start" sx={{ minWidth: 0 }}>
                            <Typography
                              variant="subtitle2"
                              onClick={() =>
                                setExpandedTitles((prev) => ({
                                  ...prev,
                                  [card.id]: !prev[card.id],
                                }))
                              }
                              title={isTitleExpanded ? "Tap to collapse title" : "Tap to view full title"}
                              noWrap={!isTitleExpanded}
                              sx={{
                                fontWeight: 800,
                                color: "#0F172A",
                                cursor: "pointer",
                                minWidth: 0,
                                whiteSpace: isTitleExpanded ? "normal" : "nowrap",
                                overflowWrap: "anywhere",
                                lineHeight: 1.3,
                              }}
                            >
                              {card.title}
                            </Typography>
                            {card.visibilityMode === "SOFT_HIDDEN" && (
                              <Chip label="Hidden" size="small" sx={{ height: 18, fontSize: "0.62rem", flexShrink: 0 }} />
                            )}
                          </Stack>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            noWrap
                            onClick={() => openChartDrawer("CARD", card.id, card.title, card.subtitle)}
                            sx={{ display: "block", cursor: "pointer" }}
                          >
                            {card.defaultCategory?.name || card.cardActionType}
                            {activeSubObj ? ` • ${activeSubObj.name}` : ""}
                            {card.targetVault
                              ? ` → ${card.targetVault.name}${
                                  card.targetSubContainer ? ` (${card.targetSubContainer.name})` : ""
                                }`
                              : ""}
                          </Typography>
                        </Box>

                        <Stack direction="row" spacing={0.25} alignItems="center" flexShrink={0}>
                          {isModified && (
                            <IconButton
                              size="small"
                              color="warning"
                              title="Reset card inputs to default"
                              onClick={() => resetCardOverrides(card.id)}
                            >
                              <RestartAltIcon fontSize="small" />
                            </IconButton>
                          )}
                          <IconButton
                            size="small"
                            title="View card analytics"
                            onClick={() => openChartDrawer("CARD", card.id, card.title, card.subtitle)}
                          >
                            <ShowChartIcon fontSize="small" sx={{ color: "#64748B" }} />
                          </IconButton>
                          <IconButton
                            size="small"
                            title="Card options"
                            onClick={(e) => setMenuState({ anchorEl: e.currentTarget, card })}
                          >
                            <MoreVertIcon fontSize="small" sx={{ color: "#64748B" }} />
                          </IconButton>
                        </Stack>
                      </Box>

                      {/* Quick Vault Pill Switcher (Rule 16) */}
                      <Box>
                        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap alignItems="center">
                          {liquidVaults.map((v) => {
                            const isSelected = activeVaultId === v.id;
                            return (
                              <Chip
                                key={v.id}
                                label={v.name}
                                size="small"
                                clickable
                                onClick={() => setVaultOverrides((prev) => ({ ...prev, [card.id]: v.id }))}
                                color={isSelected ? "primary" : "default"}
                                variant={isSelected ? "filled" : "outlined"}
                                sx={{
                                  fontSize: "0.68rem",
                                  height: 22,
                                  fontWeight: isSelected ? 700 : 500,
                                  borderColor: isSelected ? undefined : "#E2E8F0",
                                }}
                              />
                            );
                          })}
                          {card.cardActionType === "TRANSFER" && card.targetVault && (
                            <Chip
                              icon={<ArrowForwardIcon sx={{ fontSize: "0.75rem !important" }} />}
                              label={
                                card.targetSubContainer
                                  ? `${card.targetVault.name} (${card.targetSubContainer.name})`
                                  : card.targetVault.name
                              }
                              size="small"
                              color="info"
                              variant="outlined"
                              sx={{ fontSize: "0.68rem", height: 22, fontWeight: 700 }}
                            />
                          )}
                        </Stack>
                      </Box>

                      {/* Quick Amount Chips + Custom Toggle Chip (#1) */}
                      <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap alignItems="center">
                        {quickAmounts.map((amt) => {
                          const isPicked = Number(overrideAmt) === Number(amt);
                          return (
                            <Chip
                              key={amt}
                              label={<MoneyValue value={amt} currency={cardCurrency} />}
                              size="small"
                              clickable
                              onClick={() => setAmountOverrides((prev) => ({ ...prev, [card.id]: Number(amt) }))}
                              color={isPicked ? "secondary" : "default"}
                              variant={isPicked ? "filled" : "outlined"}
                              sx={{ fontSize: "0.7rem", height: 22, fontWeight: 700 }}
                            />
                          );
                        })}

                        {!hasNoPresets && (
                          <Chip
                            icon={<EditOutlinedIcon sx={{ fontSize: "0.75rem !important" }} />}
                            label={isCustomOpen ? "Hide Custom" : "Custom"}
                            size="small"
                            clickable
                            onClick={() =>
                              setOpenCustomInputs((prev) => ({
                                ...prev,
                                [card.id]: !prev[card.id],
                              }))
                            }
                            color={isCustomOpen ? "primary" : "default"}
                            variant={isCustomOpen ? "filled" : "outlined"}
                            sx={{ fontSize: "0.7rem", height: 22, fontWeight: 700 }}
                          />
                        )}
                      </Stack>

                      {/* Inline Manual Amount Field (Hidden by default behind Custom chip per #1) */}
                      <Collapse in={isCustomOpen} timeout="auto" unmountOnExit>
                        {cardCurrency === baseCurrency ? (
                          <CurrencyTextField
                            label={defaultAmt > 0 ? "Custom Amount (or use default)" : "Enter Amount"}
                            placeholder={defaultAmt > 0 ? String(defaultAmt) : "0"}
                            value={overrideAmt ?? ""}
                            onValueChange={(num) => setAmountOverrides((prev) => ({ ...prev, [card.id]: num }))}
                            showClear
                          />
                        ) : (
                          <TextField
                            label={
                              defaultAmt > 0
                                ? `Custom Amount (${cardCurrency})`
                                : `Enter Amount (${cardCurrency})`
                            }
                            type="number"
                            size="small"
                            fullWidth
                            inputProps={{ step: "any", min: 0 }}
                            InputProps={{
                              startAdornment: (
                                <InputAdornment position="start" sx={{ fontWeight: 700 }}>
                                  {cardCurrency}
                                </InputAdornment>
                              ),
                            }}
                            value={overrideAmt ?? ""}
                            onChange={(e) => setAmountOverrides((prev) => ({ ...prev, [card.id]: e.target.value }))}
                          />
                        )}
                      </Collapse>

                      {/* Optional Tax / Cash Coin Options (Coin hidden unless Physical CASH selected per #4) */}
                      <Box>
                        <Button
                          size="small"
                          startIcon={<TuneOutlinedIcon sx={{ fontSize: "0.85rem !important" }} />}
                          onClick={() =>
                            setExpandedExtras((prev) => ({ ...prev, [card.id]: !prev[card.id] }))
                          }
                          sx={{ fontSize: "0.7rem", color: "#64748B", p: 0, minWidth: 0, textTransform: "none" }}
                        >
                          {showExtras
                            ? isCashExpense
                              ? "Hide Fee / Coin Options"
                              : "Hide Fee Options"
                            : isCashExpense
                            ? "+ Add Admin Fee / Coin"
                            : "+ Add Admin Fee / Tax"}
                        </Button>

                        <Collapse in={showExtras} timeout="auto" unmountOnExit>
                          <Stack spacing={1} sx={{ mt: 1 }}>
                            <CurrencyTextField
                              label="Admin Fee / Tax"
                              value={taxOverrides[card.id] ?? ""}
                              onValueChange={(num) =>
                                setTaxOverrides((prev) => ({ ...prev, [card.id]: num }))
                              }
                              showClear
                            />
                            {isCashExpense && (
                              <CoinExpenseControls
                                compact
                                grossAmount={effectiveAmt}
                                coinMode={coinModeOverrides[card.id] || "NONE"}
                                onCoinModeChange={(mode) =>
                                  setCoinModeOverrides((prev) => ({ ...prev, [card.id]: mode }))
                                }
                                coinUsedAmount={coinUsedOverrides[card.id] ?? ""}
                                onCoinUsedChange={(num) =>
                                  setCoinUsedOverrides((prev) => ({ ...prev, [card.id]: num }))
                                }
                                coinChangeAmount={coinOverrides[card.id] ?? ""}
                                onCoinChangeAmount={(num) =>
                                  setCoinOverrides((prev) => ({ ...prev, [card.id]: num }))
                                }
                              />
                            )}
                          </Stack>
                        </Collapse>
                      </Box>

                      {/* 1-Tap Pay Footer */}
                      <Box sx={{ mt: "auto", pt: 0.5 }}>
                        <Button
                          variant="contained"
                          fullWidth
                          disabled={executeCardMutation.isPending || effectiveAmt <= 0}
                          onClick={() => handleCardSubmit(card)}
                          sx={{ fontWeight: 800, py: 0.85, fontSize: "0.82rem" }}
                        >
                          {effectiveAmt > 0 ? (
                            <Stack direction="row" spacing={0.5} alignItems="center">
                              <span>Pay</span>
                              <MoneyValue value={effectiveAmt} currency={cardCurrency} />
                            </Stack>
                          ) : (
                            "Enter Amount"
                          )}
                        </Button>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>

          {/* Incremental +5 more pagination in Recommended mode (#6) */}
          {viewTab === 0 && displayedCards.length > 5 && (
            <Stack direction="row" spacing={1} justifyContent="center" sx={{ mt: 1.75 }}>
              {visibleRecommendedCount < displayedCards.length && (
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<ExpandMoreIcon />}
                  onClick={() => setVisibleRecommendedCount((c) => c + 5)}
                  sx={{ fontWeight: 700, borderColor: "#CBD5E1", color: "#334155" }}
                >
                  +{Math.min(5, displayedCards.length - visibleRecommendedCount)} more ({displayedCards.length - visibleRecommendedCount} left)
                </Button>
              )}
              {visibleRecommendedCount > 5 && (
                <Button
                  size="small"
                  variant="text"
                  onClick={() => setVisibleRecommendedCount(5)}
                  sx={{ fontWeight: 700, color: "#64748B" }}
                >
                  Show Less
                </Button>
              )}
            </Stack>
          )}
        </>
      )}

      {/* 2-Tier Visibility & Action Menu (#23) */}
      <Menu
        anchorEl={menuState.anchorEl}
        open={Boolean(menuState.anchorEl)}
        onClose={() => setMenuState({ anchorEl: null, card: null })}
      >
        <MenuItem
          onClick={() => {
            const c = menuState.card;
            setMenuState({ anchorEl: null, card: null });
            if (!c) return;
            const activeCardVaultId = vaultOverrides[c.id] || getDefaultCardVaultId(c);
            const activeMode = coinModeOverrides[c.id] || "NONE";
            openTransactionDialog({
              title: c.title,
              nature: c.cardActionType || "EXPENSE",
              categoryId: c.defaultCategoryId,
              partyId: c.defaultPartyId,
              sourceVaultId: activeCardVaultId,
              targetVaultId: c.targetVaultId,
              grossAmount: Number(amountOverrides[c.id]) || Number(c.defaultAmount) || "",
              taxFeeAmount: Number(taxOverrides[c.id]) || "",
              coinUsedAmount: activeMode === "SPLIT" ? Number(coinUsedOverrides[c.id]) || "" : "",
              coinChangeAmount: activeMode === "CHANGE" ? Number(coinOverrides[c.id]) || "" : "",
            });
          }}
        >
          Open in Custom Modal
        </MenuItem>

        {menuState.card?.visibilityMode === "SOFT_HIDDEN" ? (
          <MenuItem
            onClick={() =>
              patchVisibilityMutation.mutate({ id: menuState.card.id, visibilityMode: "ACTIVE" })
            }
          >
            Unhide to Recommended
          </MenuItem>
        ) : (
          <MenuItem
            onClick={() =>
              patchVisibilityMutation.mutate({ id: menuState.card.id, visibilityMode: "SOFT_HIDDEN" })
            }
          >
            Soft-Hide (Keep in Search)
          </MenuItem>
        )}

        <MenuItem
          sx={{ color: "#DC2626" }}
          onClick={() =>
            patchVisibilityMutation.mutate({ id: menuState.card.id, visibilityMode: "ARCHIVED" })
          }
        >
          Archive Card (Hide Everywhere)
        </MenuItem>
      </Menu>
    </Box>
  );
}
