"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  Stack,
  Typography,
  Alert,
  IconButton,
  Popover,
  Box,
  Chip,
  useTheme,
  useMediaQuery,
} from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import CloseIcon from "@mui/icons-material/Close";
import CurrencyExchangeIcon from "@mui/icons-material/CurrencyExchange";
import dayjs from "dayjs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLedgerStore } from "@/store/useLedgerStore";
import CurrencyTextField from "@/components/CurrencyTextField";
import MoneyValue from "@/components/MoneyValue";
import CoinExpenseControls from "@/components/CoinExpenseControls";
import { isPhysicalCashVault } from "@/shared/vaultHelpers";
import { SUPPORTED_CURRENCIES, formatNativeMoney } from "@/shared/currencyHelpers";
import { isTransactionPromotable } from "@/shared/cardPromotionUtils";
import TransactionNatureAndTitleSection, {
  PRIMARY_TYPE_PILLS,
} from "@/features/transactions/TransactionNatureAndTitleSection";
import TransactionVaultAndTransferSection from "@/features/transactions/TransactionVaultAndTransferSection";
import TransactionDebtAndOptionsSection from "@/features/transactions/TransactionDebtAndOptionsSection";

function getNowDayjs() {
  return dayjs();
}

export default function CustomTransactionModal({
  vaults = [],
  categories = [],
  parties = [],
  latestCheckpointsByVault = {},
  defaultMonthlyVaultId = null,
  defaultCashVaultId = null,
  baseCurrency = "IDR",
  exchangeRates = {},
}) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const {
    transactionDialog,
    closeTransactionDialog,
    openAddPartyDialog,
    openCardSuggestionDialog,
    enqueueToast,
  } = useLedgerStore();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const [selectedCardId, setSelectedCardId] = useState(null);
  const [selectedCardTitle, setSelectedCardTitle] = useState("");
  const [nature, setNature] = useState("EXPENSE");
  const [payableMode, setPayableMode] = useState("EXPENSE_TALANG");
  const [sourceVaultId, setSourceVaultId] = useState("");
  const [sourceSubContainerId, setSourceSubContainerId] = useState("");
  const [targetVaultId, setTargetVaultId] = useState("");
  const [targetSubContainerId, setTargetSubContainerId] = useState("");
  const [entryCurrency, setEntryCurrency] = useState(baseCurrency);
  const [manualFxRate, setManualFxRate] = useState("");
  const [targetTransferAmount, setTargetTransferAmount] = useState("");

  const [categoryId, setCategoryId] = useState("");
  const [partyId, setPartyId] = useState("");
  const [grossAmount, setGrossAmount] = useState("");
  const [taxFeeAmount, setTaxFeeAmount] = useState("");
  const [coinMode, setCoinMode] = useState("NONE"); // NONE | SPLIT | CHANGE
  const [coinUsedAmount, setCoinUsedAmount] = useState("");
  const [coinChangeAmount, setCoinChangeAmount] = useState("");
  const [dateValue, setDateValue] = useState(() => getNowDayjs());
  const [timeValue, setTimeValue] = useState(() => getNowDayjs());
  const [referenceDebtId, setReferenceDebtId] = useState("");
  const [counterpartyAccountNote, setCounterpartyAccountNote] = useState("");
  const [notes, setNotes] = useState("");
  const [moreExpanded, setMoreExpanded] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [infoAnchor, setInfoAnchor] = useState(null);

  const baseUpper = String(baseCurrency || "IDR").toUpperCase();

  const selfParty = useMemo(
    () => parties.find((p) => p.code === "SELF" || p.partyType === "SELF"),
    [parties]
  );

  const findDefaultSubId = (vId) => {
    const v = vaults.find((item) => String(item.id) === String(vId));
    if (!v || !v.subContainers || v.subContainers.length === 0) return "";
    const def = v.subContainers.find((sc) => sc.isDefault) || v.subContainers[0];
    return def ? String(def.id) : "";
  };

  useEffect(() => {
    if (!transactionDialog.open) return;

    const preset = transactionDialog.presetCard;
    const nowDt = getNowDayjs();
    const resolvedDefaultVaultId =
      defaultMonthlyVaultId || defaultCashVaultId || vaults[0]?.id || "";

    if (preset) {
      setTitle(preset.title || "");
      setSelectedCardId(preset.actionCardId || null);
      setSelectedCardTitle(preset.actionCardId ? preset.title || "" : "");
      setNature(preset.nature || "EXPENSE");
      setPayableMode(preset.payableMode || "EXPENSE_TALANG");
      const sVId = preset.sourceVaultId
        ? String(preset.sourceVaultId)
        : resolvedDefaultVaultId
        ? String(resolvedDefaultVaultId)
        : "";
      setSourceVaultId(sVId);
      const sSubId = preset.sourceSubContainerId
        ? String(preset.sourceSubContainerId)
        : findDefaultSubId(sVId);
      setSourceSubContainerId(sSubId);

      const tVId = preset.targetVaultId ? String(preset.targetVaultId) : "";
      setTargetVaultId(tVId);
      setTargetSubContainerId(preset.targetSubContainerId ? String(preset.targetSubContainerId) : findDefaultSubId(tVId));

      const sVaultObj = vaults.find((v) => String(v.id) === sVId);
      const sSubObj = sVaultObj?.subContainers?.find((sc) => String(sc.id) === sSubId);
      setEntryCurrency(String(preset.currency || sSubObj?.currency || baseUpper).toUpperCase());
      setManualFxRate("");
      setTargetTransferAmount("");

      setCategoryId(preset.categoryId ? String(preset.categoryId) : "");
      setPartyId(
        preset.partyId
          ? String(preset.partyId)
          : selfParty?.id
          ? String(selfParty.id)
          : ""
      );
      setGrossAmount(preset.grossAmount ? Number(preset.grossAmount) : "");
      setTaxFeeAmount(preset.taxFeeAmount ? Number(preset.taxFeeAmount) : "");
      const presetCoinUsed = preset.coinUsedAmount ? Number(preset.coinUsedAmount) : "";
      const presetCoinChange = preset.coinChangeAmount ? Number(preset.coinChangeAmount) : "";
      setCoinUsedAmount(presetCoinUsed);
      setCoinChangeAmount(presetCoinChange);
      setCoinMode(presetCoinUsed ? "SPLIT" : presetCoinChange ? "CHANGE" : "NONE");
      setReferenceDebtId(preset.referenceDebtId ? String(preset.referenceDebtId) : "");
      setCounterpartyAccountNote(preset.counterpartyAccountNote || "");
      setNotes(preset.notes || "");
      setMoreExpanded(Boolean(preset.taxFeeAmount || preset.notes));

      if (preset.transactionDate) {
        const dt = dayjs(`${preset.transactionDate}T${preset.transactionTime || "12:00"}`);
        setDateValue(dt.isValid() ? dt : nowDt);
        setTimeValue(dt.isValid() ? dt : nowDt);
      } else {
        setDateValue(nowDt);
        setTimeValue(nowDt);
      }
    } else {
      const sVId = resolvedDefaultVaultId ? String(resolvedDefaultVaultId) : "";
      const sSubId = findDefaultSubId(sVId);
      const fallbackTarget = vaults.find((v) => String(v.id) !== sVId);
      const tVId = fallbackTarget?.id ? String(fallbackTarget.id) : sVId;

      setTitle("");
      setSelectedCardId(null);
      setSelectedCardTitle("");
      setNature("EXPENSE");
      setPayableMode("EXPENSE_TALANG");
      setSourceVaultId(sVId);
      setSourceSubContainerId(sSubId);
      setTargetVaultId(tVId);
      setTargetSubContainerId(findDefaultSubId(tVId));

      const sVaultObj = vaults.find((v) => String(v.id) === sVId);
      const sSubObj = sVaultObj?.subContainers?.find((sc) => String(sc.id) === sSubId);
      setEntryCurrency(String(sSubObj?.currency || baseUpper).toUpperCase());
      setManualFxRate("");
      setTargetTransferAmount("");

      setCategoryId("");
      setPartyId(selfParty?.id ? String(selfParty.id) : "");
      setGrossAmount("");
      setTaxFeeAmount("");
      setCoinMode("NONE");
      setCoinUsedAmount("");
      setCoinChangeAmount("");
      setReferenceDebtId("");
      setCounterpartyAccountNote("");
      setNotes("");
      setMoreExpanded(false);
      setDateValue(nowDt);
      setTimeValue(nowDt);
    }
    setErrorMsg("");
  }, [
    transactionDialog.open,
    transactionDialog.presetCard,
    vaults,
    selfParty,
    defaultMonthlyVaultId,
    defaultCashVaultId,
    baseUpper,
  ]);

  const isDebtNature =
    nature === "RECEIVABLE_LEND" ||
    nature === "RECEIVABLE_COLLECT" ||
    nature === "PAYABLE_BORROW" ||
    nature === "PAYABLE_REPAY";

  const activePrimaryKey = isDebtNature ? "DEBT" : nature;
  const isSettlementNature =
    nature === "RECEIVABLE_COLLECT" || nature === "PAYABLE_REPAY";
  const needsVaultSelection =
    nature !== "PAYABLE_BORROW" || payableMode === "CASH_LOAN";

  const selectedSourceVaultObj = useMemo(
    () => vaults.find((v) => String(v.id) === String(sourceVaultId)),
    [vaults, sourceVaultId]
  );

  const selectedSourceSubObj = useMemo(
    () =>
      selectedSourceVaultObj?.subContainers?.find(
        (sc) => String(sc.id) === String(sourceSubContainerId)
      ) || null,
    [selectedSourceVaultObj, sourceSubContainerId]
  );

  const selectedTargetVaultObj = useMemo(
    () => vaults.find((v) => String(v.id) === String(targetVaultId)),
    [vaults, targetVaultId]
  );

  const selectedTargetSubObj = useMemo(
    () =>
      selectedTargetVaultObj?.subContainers?.find(
        (sc) => String(sc.id) === String(targetSubContainerId)
      ) || null,
    [selectedTargetVaultObj, targetSubContainerId]
  );

  const handleSelectSourceVault = (nextVaultId) => {
    const strId = String(nextVaultId);
    setSourceVaultId(strId);
    const vObj = vaults.find((v) => String(v.id) === strId);
    const defSub = vObj?.subContainers?.find((s) => s.isDefault) || vObj?.subContainers?.[0];
    setSourceSubContainerId(defSub ? String(defSub.id) : "");
    setEntryCurrency(String(defSub?.currency || baseUpper).toUpperCase());
  };

  const handleSelectSourceSub = (subObj) => {
    setSourceSubContainerId(String(subObj.id));
    setEntryCurrency(String(subObj.currency || baseUpper).toUpperCase());
  };

  const handleSelectTargetVault = (nextVaultId) => {
    const strId = String(nextVaultId);
    setTargetVaultId(strId);
    const vObj = vaults.find((v) => String(v.id) === strId);
    const defSub = vObj?.subContainers?.find((s) => s.isDefault) || vObj?.subContainers?.[0];
    setTargetSubContainerId(defSub ? String(defSub.id) : "");
  };

  const showCoinControls =
    nature === "EXPENSE" &&
    entryCurrency === baseUpper &&
    isPhysicalCashVault(selectedSourceVaultObj);

  const selectedPartyObj = useMemo(
    () => parties.find((p) => String(p.id) === String(partyId)),
    [parties, partyId]
  );

  const isForeignEntry = entryCurrency !== baseUpper;
  const cachedFxRate = Number(exchangeRates?.[entryCurrency]?.rate || 0);
  const effectiveFxRate =
    Number(manualFxRate) > 0 ? Number(manualFxRate) : cachedFxRate;
  const convertedBasePreview =
    isForeignEntry && effectiveFxRate > 0 && Number(grossAmount) > 0
      ? Number(grossAmount) * effectiveFxRate
      : null;

  const potentialSpilloverHint = useMemo(() => {
    if (!needsVaultSelection || !selectedSourceVaultObj || isForeignEntry) return null;
    if (nature !== "EXPENSE" && nature !== "TRANSFER" && nature !== "RECEIVABLE_LEND" && nature !== "PAYABLE_REPAY") {
      return null;
    }
    const amt = Number(grossAmount) || 0;
    if (amt <= 0) return null;
    const pSum = selectedSourceVaultObj.partitionSummary;
    if (!pSum?.hasBaseSubVaults) return null;

    if (selectedSourceSubObj?.isSynced) {
      const pocketBal = Number(selectedSourceSubObj.effectiveBalance ?? selectedSourceSubObj.currentBalance ?? 0);
      if (amt > pocketBal) {
        return `"${selectedSourceSubObj.name}" (${formatNativeMoney(pocketBal, baseUpper)}) will dip negative and flag an Out-of-Sync reminder.`;
      }
    } else if (pSum.unallocatedBasePool < amt) {
      return `Exceeds Unallocated Pool (${formatNativeMoney(pSum.unallocatedBasePool, baseUpper)}); transaction is still allowed and will mark splits Out-of-Sync.`;
    }
    return null;
  }, [needsVaultSelection, selectedSourceVaultObj, selectedSourceSubObj, isForeignEntry, nature, grossAmount, baseUpper]);

  useEffect(() => {
    if (!transactionDialog.open) return;
    if (isDebtNature && (!partyId || String(partyId) === String(selfParty?.id))) {
      const firstExternal = parties.find((p) => p.code !== "SELF" && p.partyType !== "SELF");
      if (firstExternal) setPartyId(String(firstExternal.id));
    } else if (!isDebtNature && !partyId && selfParty) {
      setPartyId(String(selfParty.id));
    }
  }, [isDebtNature, partyId, parties, selfParty, transactionDialog.open]);

  const { data: partyDetail } = useQuery({
    queryKey: ["debt-detail", partyId],
    queryFn: async () => {
      const res = await fetch(`/api/debts/${partyId}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
    enabled: Boolean(
      transactionDialog.open &&
        isSettlementNature &&
        partyId &&
        String(partyId) !== String(selfParty?.id)
    ),
  });

  const openItemsForSettlement = useMemo(() => {
    if (!partyDetail) return [];
    return nature === "RECEIVABLE_COLLECT"
      ? partyDetail.openReceivables || []
      : partyDetail.openPayables || [];
  }, [partyDetail, nature]);

  const txDateStr = dateValue && dateValue.isValid() ? dateValue.format("YYYY-MM-DD") : getNowDayjs().format("YYYY-MM-DD");
  const txTimeStr = timeValue && timeValue.isValid() ? timeValue.format("HH:mm") : getNowDayjs().format("HH:mm");

  const retroactiveAlert = useMemo(() => {
    if (!needsVaultSelection || !sourceVaultId || !txDateStr) return null;
    const latestCp = latestCheckpointsByVault[sourceVaultId];
    if (!latestCp || !latestCp.checkpointTimestamp) return null;

    const chosenDt = new Date(`${txDateStr}T${txTimeStr}:00`);
    const cpDt = new Date(latestCp.checkpointTimestamp);
    if (Number.isNaN(chosenDt.getTime()) || Number.isNaN(cpDt.getTime())) return null;

    if (chosenDt < cpDt) {
      return {
        periodLabel: latestCp.periodLabel,
        checkpointDate: cpDt.toLocaleDateString(),
      };
    }
    return null;
  }, [needsVaultSelection, sourceVaultId, txDateStr, txTimeStr, latestCheckpointsByVault]);

  const filteredCategories = useMemo(() => {
    if (nature === "INCOME") {
      return [...categories].sort((a, b) => (a.defaultNature === "INCOME" ? -1 : 1) - (b.defaultNature === "INCOME" ? -1 : 1));
    }
    return categories;
  }, [categories, nature]);

  const { data: suggestionsData } = useQuery({
    queryKey: ["title-suggestions"],
    queryFn: async () => {
      const res = await fetch("/api/transactions/title-suggestions");
      const json = await res.json();
      return json.success ? json.data : { cards: [], historySuggestions: [] };
    },
    enabled: Boolean(transactionDialog.open),
    staleTime: 30_000,
  });

  const sortedTitleOptions = useMemo(() => {
    const cards = suggestionsData?.cards || [];
    const history = suggestionsData?.historySuggestions || [];
    const combined = [...cards, ...history];
    return combined.sort((a, b) => {
      const aMatch = a.nature === nature ? 0 : 1;
      const bMatch = b.nature === nature ? 0 : 1;
      if (aMatch !== bMatch) return aMatch - bMatch;
      if (a.kind !== b.kind) return a.kind === "CARD" ? -1 : 1;
      return (b.totalUses || 0) - (a.totalUses || 0);
    });
  }, [suggestionsData, nature]);

  const handleSelectTitleOption = (option) => {
    if (!option) return;
    setTitle(option.title || "");

    const nextNature = option.nature || nature;
    setNature(nextNature);

    if (option.sourceVaultId) {
      const vaultObj = vaults.find((v) => String(v.id) === String(option.sourceVaultId));
      if (vaultObj) {
        setSourceVaultId(String(vaultObj.id));
        const matchedSub =
          vaultObj.subContainers?.find((sc) => String(sc.id) === String(option.sourceSubContainerId)) ||
          vaultObj.subContainers?.find((sc) => sc.isDefault) ||
          vaultObj.subContainers?.[0] ||
          null;
        setSourceSubContainerId(matchedSub ? String(matchedSub.id) : "");
        setEntryCurrency(String(matchedSub?.currency || option.currency || baseUpper).toUpperCase());
      }
    } else if (option.currency) {
      setEntryCurrency(String(option.currency).toUpperCase());
    }

    if (nextNature === "TRANSFER" && option.targetVaultId) {
      const targetVaultObj = vaults.find((v) => String(v.id) === String(option.targetVaultId));
      if (targetVaultObj) {
        setTargetVaultId(String(targetVaultObj.id));
        const matchedTargetSub =
          targetVaultObj.subContainers?.find(
            (sc) => String(sc.id) === String(option.targetSubContainerId)
          ) ||
          targetVaultObj.subContainers?.find((sc) => sc.isDefault) ||
          targetVaultObj.subContainers?.[0] ||
          null;
        setTargetSubContainerId(matchedTargetSub ? String(matchedTargetSub.id) : "");
      }
    }

    if (option.categoryId) {
      setCategoryId(String(option.categoryId));
    }
    if (option.partyId) {
      setPartyId(String(option.partyId));
    }

    setGrossAmount((prev) => {
      if (prev !== "" && Number(prev) > 0) return prev;
      return option.defaultAmount > 0 ? option.defaultAmount : "";
    });

    if (option.kind === "CARD" && option.cardId) {
      setSelectedCardId(option.cardId);
      setSelectedCardTitle(option.title || "");
    } else {
      setSelectedCardId(null);
      setSelectedCardTitle("");
    }
  };

  const submitMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Transaction failed");
      return {
        tx: json.data,
        cardSuggestion: json.cardSuggestion || null,
      };
    },
    onSuccess: ({ tx: createdTx, cardSuggestion }, vars) => {
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
      queryClient.invalidateQueries({ queryKey: ["debts"] });
      queryClient.invalidateQueries({ queryKey: ["debt-detail"] });
      queryClient.invalidateQueries({ queryKey: ["checkpoints"] });
      queryClient.invalidateQueries({ queryKey: ["title-suggestions"] });

      const wasAdHocUnlinked = !transactionDialog?.presetCard && !vars.actionCardId;
      const promoteSnapshot =
        wasAdHocUnlinked && !cardSuggestion
          ? {
              id: createdTx.id,
              title: vars.title,
              nature: createdTx.nature || vars.nature,
              currency: createdTx.currency || vars.currency || baseCurrency,
              originalGrossAmount:
                createdTx.originalGrossAmount ?? (vars.currency !== baseCurrency ? vars.grossAmount : null),
              grossAmount: createdTx.grossAmount ?? vars.grossAmount,
              sourceVaultId: vars.sourceVaultId ?? null,
              sourceSubContainerId: vars.sourceSubContainerId ?? null,
              targetVaultId: vars.targetVaultId ?? null,
              targetSubContainerId: vars.targetSubContainerId ?? null,
              categoryId: vars.categoryId ?? null,
              partyId: vars.partyId ?? null,
              actionCardId: createdTx.actionCardId ?? null,
              parentTransactionId: createdTx.parentTransactionId ?? null,
            }
          : null;

      closeTransactionDialog();
      enqueueToast(`Recorded "${vars.title}"`, {
        severity: "success",
        undoTransactionId: createdTx.id,
        promoteTransaction:
          promoteSnapshot && isTransactionPromotable(promoteSnapshot) ? promoteSnapshot : null,
      });

      if (cardSuggestion) {
        openCardSuggestionDialog(cardSuggestion);
      }

      if (createdTx?.subVaultWarning) {
        enqueueToast(
          `Saved! Sub-vault split on this vault is now Out-of-Sync.`,
          { severity: "warning" }
        );
      }
    },
    onError: (err) => {
      setErrorMsg(err.message);
      enqueueToast(err.message, { severity: "error" });
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrorMsg("");

    const amt = Number(grossAmount) || 0;
    if (amt <= 0) {
      setErrorMsg("Transaction amount must be greater than zero.");
      return;
    }

    if (isForeignEntry && (!effectiveFxRate || effectiveFxRate <= 0)) {
      setErrorMsg(
        `No cached exchange rate for ${entryCurrency} to ${baseUpper}. Enter a manual FX rate or sync FX rates first.`
      );
      setMoreExpanded(true);
      return;
    }

    const coinUsedVal = showCoinControls && coinMode === "SPLIT" ? Number(coinUsedAmount) || 0 : 0;
    const coinChangeVal = showCoinControls && coinMode === "CHANGE" ? Number(coinChangeAmount) || 0 : 0;

    if (coinUsedVal > amt) {
      setErrorMsg("Coin split payment cannot exceed transaction amount.");
      return;
    }

    if (isDebtNature && (!partyId || String(partyId) === String(selfParty?.id))) {
      setErrorMsg("Please select an external contact/party (or click + Add Contact).");
      return;
    }

    const pickedCat = categories.find((c) => String(c.id) === String(categoryId));
    const finalTitle =
      title.trim() ||
      (nature === "PAYABLE_REPAY"
        ? `Pay Debt - ${selectedPartyObj?.name || "Contact"}`
        : nature === "RECEIVABLE_COLLECT"
        ? `Collect Receivable - ${selectedPartyObj?.name || "Contact"}`
        : nature === "PAYABLE_BORROW"
        ? `Borrowed from ${selectedPartyObj?.name || "Contact"}`
        : nature === "RECEIVABLE_LEND"
        ? `Lent to ${selectedPartyObj?.name || "Contact"}`
        : pickedCat?.name || "Custom Transaction");

    submitMutation.mutate({
      title: finalTitle,
      nature,
      payableMode: nature === "PAYABLE_BORROW" ? payableMode : undefined,
      categoryId: pickedCat ? pickedCat.id : null,
      commitmentType: pickedCat?.commitmentType || "NONE",
      priorityTier: pickedCat?.priorityTier || "NONE",
      partyId: partyId ? parseInt(partyId, 10) : selfParty?.id,
      actionCardId: transactionDialog?.presetCard?.actionCardId || selectedCardId || undefined,
      sourceVaultId: needsVaultSelection && sourceVaultId ? parseInt(sourceVaultId, 10) : null,
      sourceSubContainerId:
        needsVaultSelection && sourceSubContainerId ? parseInt(sourceSubContainerId, 10) : null,
      targetVaultId: nature === "TRANSFER" && targetVaultId ? parseInt(targetVaultId, 10) : null,
      targetSubContainerId:
        nature === "TRANSFER" && targetSubContainerId ? parseInt(targetSubContainerId, 10) : null,
      targetAmount:
        nature === "TRANSFER" && Number(targetTransferAmount) > 0
          ? Number(targetTransferAmount)
          : null,
      currency: entryCurrency,
      manualFxRate: Number(manualFxRate) > 0 ? Number(manualFxRate) : null,
      grossAmount: amt,
      taxFeeAmount: Number(taxFeeAmount) || 0,
      coinUsedAmount: coinUsedVal,
      coinChangeAmount: coinChangeVal,
      transactionDate: `${txDateStr}T${txTimeStr}:00`,
      transactionTime: txTimeStr,
      referenceDebtId: isSettlementNature && referenceDebtId ? parseInt(referenceDebtId, 10) : null,
      counterpartyAccountNote:
        isDebtNature && counterpartyAccountNote ? counterpartyAccountNote.trim() : null,
      notes: notes.trim() || null,
    });
  };

  const partyList = isDebtNature
    ? parties.filter((p) => p.code !== "SELF" && p.partyType !== "SELF")
    : parties;

  const savedExternalAccounts = selectedPartyObj?.externalAccounts || [];
  const activeTypeMeta =
    PRIMARY_TYPE_PILLS.find((p) => p.key === activePrimaryKey) || PRIMARY_TYPE_PILLS[0];

  return (
    <Dialog
      open={transactionDialog.open}
      onClose={closeTransactionDialog}
      maxWidth="sm"
      fullWidth
      fullScreen={isMobile}
      PaperProps={{
        sx: {
          borderRadius: isMobile ? 0 : 3,
          overflow: "hidden",
        },
      }}
    >
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <DialogTitle
          sx={{
            fontWeight: 800,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderBottom: "1px solid #E2E8F0",
            py: 1.5,
            px: 2.5,
          }}
        >
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="h6" sx={{ fontWeight: 800 }}>
              Record Transaction
            </Typography>
            <IconButton size="small" onClick={(e) => setInfoAnchor(e.currentTarget)}>
              <InfoOutlinedIcon fontSize="small" />
            </IconButton>
          </Stack>
          <IconButton size="small" onClick={closeTransactionDialog}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <Popover
          open={Boolean(infoAnchor)}
          anchorEl={infoAnchor}
          onClose={() => setInfoAnchor(null)}
          anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
          PaperProps={{ sx: { p: 2, maxWidth: 330, borderRadius: 2 } }}
        >
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.75 }}>
            Multi-Vault &amp; Multi-Currency Ledger Flow
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
            • <b>Sub-Vaults:</b> Picking a Vault auto-selects its Default pocket. Switch pockets directly if paying from another split or foreign currency.
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
            • <b>Foreign Entry:</b> Foreign amounts lock their FX conversion rate permanently at entry time.
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
            • <b>Backdated Safety:</b> Entries dated before a physical audit checkpoint absorb safely without breaking live balances.
          </Typography>
        </Popover>

        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 2, pb: 3 }}>
          {errorMsg && <Alert severity="error">{errorMsg}</Alert>}

          <TransactionNatureAndTitleSection
            activePrimaryKey={activePrimaryKey}
            isDebtNature={isDebtNature}
            nature={nature}
            setNature={setNature}
            sortedTitleOptions={sortedTitleOptions}
            title={title}
            setTitle={setTitle}
            selectedCardId={selectedCardId}
            setSelectedCardId={setSelectedCardId}
            selectedCardTitle={selectedCardTitle}
            setSelectedCardTitle={setSelectedCardTitle}
            handleSelectTitleOption={handleSelectTitleOption}
            categoryId={categoryId}
            setCategoryId={setCategoryId}
            filteredCategories={filteredCategories}
            baseUpper={baseUpper}
          />

          <Box
            sx={{
              p: 2,
              borderRadius: 2.5,
              bgcolor: activeTypeMeta.bg,
              border: `1px solid ${activeTypeMeta.border}`,
            }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
              <Typography variant="caption" sx={{ fontWeight: 800, color: activeTypeMeta.color, letterSpacing: 0.6 }}>
                AMOUNT ({entryCurrency})
              </Typography>

              <TextField
                select
                size="small"
                value={entryCurrency}
                onChange={(e) => setEntryCurrency(e.target.value)}
                variant="standard"
                sx={{ minWidth: 82 }}
                inputProps={{ style: { fontWeight: 800, fontSize: "0.82rem" } }}
              >
                {SUPPORTED_CURRENCIES.map((c) => (
                  <MenuItem key={c.code} value={c.code}>
                    {c.code} ({c.symbol.trim()})
                  </MenuItem>
                ))}
              </TextField>
            </Stack>

            <CurrencyTextField
              label=""
              placeholder="0"
              required
              size="medium"
              value={grossAmount}
              onValueChange={(num) => setGrossAmount(num)}
              sx={{
                bgcolor: "#FFFFFF",
                borderRadius: 2,
                "& .MuiInputBase-input": {
                  fontSize: "1.45rem",
                  fontWeight: 800,
                  color: "#0F172A",
                  py: 1.25,
                },
              }}
            />

            {isForeignEntry && (
              <Stack
                direction="row"
                spacing={1}
                alignItems="center"
                justifyContent="space-between"
                sx={{ mt: 1, flexWrap: "wrap", rowGap: 0.5 }}
              >
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <CurrencyExchangeIcon sx={{ fontSize: 15, color: "#7C3AED" }} />
                  <Typography variant="caption" sx={{ fontWeight: 700, color: "#4C1D95" }}>
                    {effectiveFxRate > 0
                      ? `1 ${entryCurrency} = ${effectiveFxRate.toLocaleString("en-US", { maximumFractionDigits: 4 })} ${baseUpper}`
                      : `No cached FX rate (${entryCurrency} -> ${baseUpper})`}
                  </Typography>
                </Stack>
                {convertedBasePreview !== null && (
                  <Chip
                    size="small"
                    color="secondary"
                    label={
                      <>
                        ≈ <MoneyValue value={convertedBasePreview} currency={baseUpper} forceExact />
                      </>
                    }
                    sx={{ height: 22, fontWeight: 800, fontSize: "0.74rem" }}
                  />
                )}
              </Stack>
            )}
          </Box>

          <TransactionVaultAndTransferSection
            needsVaultSelection={needsVaultSelection}
            nature={nature}
            vaults={vaults}
            sourceVaultId={sourceVaultId}
            handleSelectSourceVault={handleSelectSourceVault}
            selectedSourceVaultObj={selectedSourceVaultObj}
            sourceSubContainerId={sourceSubContainerId}
            handleSelectSourceSub={handleSelectSourceSub}
            potentialSpilloverHint={potentialSpilloverHint}
            targetVaultId={targetVaultId}
            handleSelectTargetVault={handleSelectTargetVault}
            selectedTargetVaultObj={selectedTargetVaultObj}
            targetSubContainerId={targetSubContainerId}
            setTargetSubContainerId={setTargetSubContainerId}
            selectedTargetSubObj={selectedTargetSubObj}
            entryCurrency={entryCurrency}
            baseUpper={baseUpper}
            targetTransferAmount={targetTransferAmount}
            setTargetTransferAmount={setTargetTransferAmount}
          />

          {showCoinControls && (
            <CoinExpenseControls
              grossAmount={grossAmount}
              coinMode={coinMode}
              onCoinModeChange={setCoinMode}
              coinUsedAmount={coinUsedAmount}
              onCoinUsedChange={setCoinUsedAmount}
              coinChangeAmount={coinChangeAmount}
              onCoinChangeAmount={setCoinChangeAmount}
            />
          )}

          <TransactionDebtAndOptionsSection
            isDebtNature={isDebtNature}
            nature={nature}
            payableMode={payableMode}
            setPayableMode={setPayableMode}
            partyId={partyId}
            setPartyId={setPartyId}
            setReferenceDebtId={setReferenceDebtId}
            partyList={partyList}
            openAddPartyDialog={openAddPartyDialog}
            isSettlementNature={isSettlementNature}
            referenceDebtId={referenceDebtId}
            openItemsForSettlement={openItemsForSettlement}
            baseUpper={baseUpper}
            savedExternalAccounts={savedExternalAccounts}
            counterpartyAccountNote={counterpartyAccountNote}
            setCounterpartyAccountNote={setCounterpartyAccountNote}
            dateValue={dateValue}
            setDateValue={setDateValue}
            timeValue={timeValue}
            setTimeValue={setTimeValue}
            retroactiveAlert={retroactiveAlert}
            moreExpanded={moreExpanded}
            setMoreExpanded={setMoreExpanded}
            isForeignEntry={isForeignEntry}
            entryCurrency={entryCurrency}
            cachedFxRate={cachedFxRate}
            manualFxRate={manualFxRate}
            setManualFxRate={setManualFxRate}
            taxFeeAmount={taxFeeAmount}
            setTaxFeeAmount={setTaxFeeAmount}
            notes={notes}
            setNotes={setNotes}
          />
        </DialogContent>

        <DialogActions
          sx={{
            px: 2.5,
            py: 1.75,
            borderTop: "1px solid #E2E8F0",
            bgcolor: "#FFFFFF",
            justifyContent: "space-between",
          }}
        >
          <Button onClick={closeTransactionDialog} color="inherit" sx={{ fontWeight: 700 }}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            size="large"
            disabled={submitMutation.isPending}
            sx={{
              fontWeight: 800,
              px: 3.5,
              borderRadius: 2,
              bgcolor: activeTypeMeta.color,
              "&:hover": { bgcolor: activeTypeMeta.color, filter: "brightness(0.92)" },
            }}
          >
            {submitMutation.isPending ? "Recording..." : "Save Transaction"}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
