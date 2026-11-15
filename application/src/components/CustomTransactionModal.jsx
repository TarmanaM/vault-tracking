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
  RadioGroup,
  FormControlLabel,
  Radio,
  Autocomplete,
  IconButton,
  Popover,
  Box,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  useTheme,
  useMediaQuery,
} from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import PersonAddAlt1OutlinedIcon from "@mui/icons-material/PersonAddAlt1Outlined";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import CloseIcon from "@mui/icons-material/Close";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import TuneOutlinedIcon from "@mui/icons-material/TuneOutlined";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import CurrencyExchangeIcon from "@mui/icons-material/CurrencyExchange";
import FlashOnIcon from "@mui/icons-material/FlashOn";
import HistoryIcon from "@mui/icons-material/History";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { TimePicker } from "@mui/x-date-pickers/TimePicker";
import dayjs from "dayjs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLedgerStore } from "@/store/useLedgerStore";
import CurrencyTextField from "@/components/CurrencyTextField";
import MoneyValue from "@/components/MoneyValue";
import CoinExpenseControls from "@/components/CoinExpenseControls";
import VaultAvatar from "@/components/VaultAvatar";
import { isPhysicalCashVault } from "@/lib/vaultHelpers";
import { SUPPORTED_CURRENCIES, formatNativeMoney } from "@/lib/currencyHelpers";
import { isTransactionPromotable, normalizeCardTitle } from "@/lib/cardPromotionUtils";

const PRIMARY_TYPE_PILLS = [
  { key: "EXPENSE", label: "Expense", color: "#DC2626", bg: "#FEF2F2", border: "#FECACA" },
  { key: "INCOME", label: "Income", color: "#059669", bg: "#ECFDF5", border: "#A7F3D0" },
  { key: "TRANSFER", label: "Transfer", color: "#2563EB", bg: "#EFF6FF", border: "#BFDBFE" },
  { key: "DEBT", label: "Debt / Loan", color: "#D97706", bg: "#FFFBEB", border: "#FDE68A" },
];

const DEBT_SUB_PILLS = [
  { value: "RECEIVABLE_LEND", label: "Lent / Talangi" },
  { value: "RECEIVABLE_COLLECT", label: "Collected Debt" },
  { value: "PAYABLE_BORROW", label: "Borrowed / Utang" },
  { value: "PAYABLE_REPAY", label: "Repay Debt / PayLater" },
];

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

  // Helper to resolve default sub-vault on any vault cleanly (#3 silent default)
  const findDefaultSubId = (vId) => {
    const v = vaults.find((item) => String(item.id) === String(vId));
    if (!v || !v.subContainers || v.subContainers.length === 0) return "";
    const def = v.subContainers.find((sc) => sc.isDefault) || v.subContainers[0];
    return def ? String(def.id) : "";
  };

  // Sync preset values whenever the dialog opens
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

  // Sync FX calculation preview when spending/receiving foreign Valas
  const isForeignEntry = entryCurrency !== baseUpper;
  const cachedFxRate = Number(exchangeRates?.[entryCurrency]?.rate || 0);
  const effectiveFxRate =
    Number(manualFxRate) > 0 ? Number(manualFxRate) : cachedFxRate;
  const convertedBasePreview =
    isForeignEntry && effectiveFxRate > 0 && Number(grossAmount) > 0
      ? Number(grossAmount) * effectiveFxRate
      : null;

  // Non-blocking warning if transaction hits unallocated pool and crosses synced splits (#3)
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

  // Ensure non-SELF party default is picked when switching into debt natures
  useEffect(() => {
    if (!transactionDialog.open) return;
    if (isDebtNature && (!partyId || String(partyId) === String(selfParty?.id))) {
      const firstExternal = parties.find((p) => p.code !== "SELF" && p.partyType !== "SELF");
      if (firstExternal) setPartyId(String(firstExternal.id));
    } else if (!isDebtNature && !partyId && selfParty) {
      setPartyId(String(selfParty.id));
    }
  }, [isDebtNature, partyId, parties, selfParty, transactionDialog.open]);

  // Fetch party's open debt items for specific vs FIFO settlement (#17)
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

  // #15 Auto-Detect Retroactive against latest checkpoint of the affected vault
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

    // Preserve user-entered Amount if already typed before picking Title
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
        {/* Clean Flagship Header (#9) */}
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

          {/* 1. Segmented Color-Coded Nature Selector (#9) */}
          <Box>
            <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
              {PRIMARY_TYPE_PILLS.map((pill) => {
                const selected = activePrimaryKey === pill.key;
                return (
                  <Chip
                    key={pill.key}
                    label={pill.label}
                    clickable
                    onClick={() => {
                      if (pill.key === "DEBT") {
                        if (!isDebtNature) setNature("RECEIVABLE_LEND");
                      } else {
                        setNature(pill.key);
                      }
                    }}
                    sx={{
                      flex: "1 1 0",
                      minWidth: 74,
                      height: 36,
                      fontWeight: 800,
                      fontSize: "0.78rem",
                      borderRadius: 2,
                      bgcolor: selected ? pill.bg : "#F8FAFC",
                      color: selected ? pill.color : "#475569",
                      border: `1.5px solid ${selected ? pill.color : "#E2E8F0"}`,
                    }}
                  />
                );
              })}
            </Stack>

            {activePrimaryKey === "DEBT" && (
              <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
                {DEBT_SUB_PILLS.map((d) => (
                  <Chip
                    key={d.value}
                    label={d.label}
                    size="small"
                    clickable
                    color={nature === d.value ? "warning" : "default"}
                    variant={nature === d.value ? "filled" : "outlined"}
                    onClick={() => setNature(d.value)}
                    sx={{ fontWeight: 700, fontSize: "0.72rem" }}
                  />
                ))}
              </Stack>
            )}
          </Box>

          {/* 2. Transaction Title Autocomplete (Cards + History) & Category Row */}
          <Box>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
              <Autocomplete
                freeSolo
                fullWidth
                size="small"
                options={sortedTitleOptions}
                value={null}
                inputValue={title}
                getOptionLabel={(opt) => (typeof opt === "string" ? opt : opt.title || "")}
                isOptionEqualToValue={(opt, val) => opt?.suggestionKey === val?.suggestionKey}
                filterOptions={(opts, state) => {
                  const q = normalizeCardTitle(state.inputValue);
                  if (!q) return opts.slice(0, 14);
                  return opts.filter((o) => normalizeCardTitle(o.title).includes(q)).slice(0, 14);
                }}
                onChange={(_, selectedOpt) => {
                  if (selectedOpt && typeof selectedOpt !== "string") {
                    handleSelectTitleOption(selectedOpt);
                  }
                }}
                onInputChange={(_, newInputValue, reason) => {
                  if (reason === "input" || reason === "clear") {
                    setTitle(newInputValue);
                    if (
                      selectedCardId &&
                      normalizeCardTitle(newInputValue) !== normalizeCardTitle(selectedCardTitle)
                    ) {
                      setSelectedCardId(null);
                      setSelectedCardTitle("");
                    }
                  }
                }}
                renderOption={(props, option) => {
                  const { key, ...restProps } = props;
                  return (
                    <Box
                      component="li"
                      key={key || option.suggestionKey}
                      {...restProps}
                      sx={{
                        display: "flex !important",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 1,
                        py: 0.75,
                      }}
                    >
                      <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
                        {option.kind === "CARD" ? (
                          <Chip
                            size="small"
                            icon={<FlashOnIcon sx={{ fontSize: "0.75rem !important" }} />}
                            label="Card"
                            color="primary"
                            sx={{ height: 20, fontSize: "0.66rem", fontWeight: 800, flexShrink: 0 }}
                          />
                        ) : (
                          <Chip
                            size="small"
                            icon={<HistoryIcon sx={{ fontSize: "0.75rem !important" }} />}
                            label={`${option.totalUses}x`}
                            variant="outlined"
                            sx={{ height: 20, fontSize: "0.66rem", fontWeight: 700, flexShrink: 0 }}
                          />
                        )}
                        <Typography variant="body2" noWrap sx={{ fontWeight: 700 }}>
                          {option.title}
                        </Typography>
                      </Stack>
                      <Typography variant="caption" color="text.secondary" noWrap sx={{ flexShrink: 0 }}>
                        {[option.nature !== nature ? option.nature : null, option.sourceVaultName]
                          .filter(Boolean)
                          .join(" • ")}
                        {option.defaultAmount > 0 && (
                          <>
                            {" "}
                            • <MoneyValue value={option.defaultAmount} currency={option.currency || baseUpper} />
                          </>
                        )}
                      </Typography>
                    </Box>
                  );
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Transaction Title"
                    placeholder="Type or pick Card / past transaction..."
                  />
                )}
              />

              {(nature === "EXPENSE" || nature === "INCOME" || nature === "PAYABLE_BORROW") && (
                <TextField
                  select
                  label="Category"
                  size="small"
                  fullWidth
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                >
                  <MenuItem value="">Auto / Uncategorized</MenuItem>
                  {filteredCategories.map((c) => (
                    <MenuItem key={c.id} value={c.id}>
                      {c.name}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            </Stack>

            {selectedCardId && (
              <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 0.75 }}>
                <Chip
                  size="small"
                  color="primary"
                  variant="outlined"
                  icon={<FlashOnIcon sx={{ fontSize: "0.78rem !important" }} />}
                  label={`Linked to Card: "${selectedCardTitle || title}"`}
                  onDelete={() => {
                    setSelectedCardId(null);
                    setSelectedCardTitle("");
                  }}
                  sx={{ fontWeight: 700, fontSize: "0.72rem" }}
                />
              </Stack>
            )}
          </Box>

          {/* 3. Hero Amount Section + Currency Badge + Live FX Conversion Preview (#4, #9) */}
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

          {/* 3. Visual Vault & Optional Sub-Vault Pocket Picker (#3, #7, #9) */}
          {needsVaultSelection && (
            <Box>
              <Typography variant="caption" sx={{ fontWeight: 800, color: "#475569", display: "block", mb: 0.75 }}>
                {nature === "INCOME" || nature === "RECEIVABLE_COLLECT"
                  ? "DESTINATION VAULT"
                  : nature === "TRANSFER"
                  ? "FROM SOURCE VAULT"
                  : "PAYMENT VAULT"}
              </Typography>

              <Box
                sx={{
                  display: "flex",
                  gap: 0.75,
                  overflowX: "auto",
                  pb: 0.75,
                  "&::-webkit-scrollbar": { height: 5 },
                }}
              >
                {vaults.map((v) => {
                  const selected = String(v.id) === String(sourceVaultId);
                  return (
                    <Chip
                      key={v.id}
                      avatar={<VaultAvatar vault={v} size={22} shape="circle" />}
                      label={v.name}
                      clickable
                      onClick={() => handleSelectSourceVault(v.id)}
                      color={selected ? "primary" : "default"}
                      variant={selected ? "filled" : "outlined"}
                      sx={{
                        height: 32,
                        fontWeight: selected ? 800 : 600,
                        flexShrink: 0,
                        borderColor: selected ? undefined : "#CBD5E1",
                      }}
                    />
                  );
                })}
              </Box>

              {/* Sub-Vault Pocket Chips if the Vault has sub-containers (#3) */}
              {selectedSourceVaultObj?.subContainers?.length > 0 && (
                <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 0.75, alignItems: "center" }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, mr: 0.5 }}>
                    Pocket:
                  </Typography>
                  {selectedSourceVaultObj.subContainers.map((sc) => {
                    const isPicked = String(sc.id) === String(sourceSubContainerId);
                    const bal = sc.effectiveBalance ?? sc.currentBalance ?? sc.lastCountedBalance;
                    return (
                      <Chip
                        key={sc.id}
                        size="small"
                        clickable
                        onClick={() => handleSelectSourceSub(sc)}
                        color={isPicked ? "secondary" : "default"}
                        variant={isPicked ? "filled" : "outlined"}
                        label={
                          <>
                            {sc.name} ({sc.currency}): <MoneyValue value={bal} currency={sc.currency || baseUpper} />
                          </>
                        }
                        sx={{ height: 24, fontSize: "0.7rem", fontWeight: isPicked ? 700 : 500 }}
                      />
                    );
                  })}
                </Stack>
              )}

              {potentialSpilloverHint && (
                <Alert severity="warning" icon={<WarningAmberIcon fontSize="small" />} sx={{ mt: 1, py: 0.4 }}>
                  <Typography variant="caption">{potentialSpilloverHint}</Typography>
                </Alert>
              )}
            </Box>
          )}

          {/* Transfer Target Vault & Target Pocket Picker (including intra-vault currency splits!) */}
          {nature === "TRANSFER" && (
            <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: "#F8FAFC", border: "1px solid #E2E8F0" }}>
              <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 0.75 }}>
                <ArrowForwardIcon fontSize="small" color="primary" />
                <Typography variant="caption" sx={{ fontWeight: 800, color: "#1E3A8A" }}>
                  TO TARGET VAULT
                </Typography>
              </Stack>

              <Box
                sx={{
                  display: "flex",
                  gap: 0.75,
                  overflowX: "auto",
                  pb: 0.75,
                }}
              >
                {vaults.map((v) => {
                  const selected = String(v.id) === String(targetVaultId);
                  return (
                    <Chip
                      key={v.id}
                      avatar={<VaultAvatar vault={v} size={22} shape="circle" />}
                      label={v.name}
                      clickable
                      onClick={() => handleSelectTargetVault(v.id)}
                      color={selected ? "info" : "default"}
                      variant={selected ? "filled" : "outlined"}
                      sx={{ height: 32, fontWeight: selected ? 800 : 600, flexShrink: 0 }}
                    />
                  );
                })}
              </Box>

              {selectedTargetVaultObj?.subContainers?.length > 0 && (
                <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 0.5, alignItems: "center" }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, mr: 0.5 }}>
                    Target Pocket:
                  </Typography>
                  {selectedTargetVaultObj.subContainers.map((sc) => {
                    const isPicked = String(sc.id) === String(targetSubContainerId);
                    return (
                      <Chip
                        key={sc.id}
                        size="small"
                        clickable
                        onClick={() => setTargetSubContainerId(String(sc.id))}
                        color={isPicked ? "info" : "default"}
                        variant={isPicked ? "filled" : "outlined"}
                        label={`${sc.name} (${sc.currency})`}
                        sx={{ height: 24, fontSize: "0.7rem", fontWeight: isPicked ? 700 : 500 }}
                      />
                    );
                  })}
                </Stack>
              )}

              {selectedTargetSubObj &&
                String(selectedTargetSubObj.currency || baseUpper).toUpperCase() !== entryCurrency && (
                  <Box sx={{ mt: 1.25 }}>
                    <CurrencyTextField
                      label={`Received in ${selectedTargetSubObj.currency} (Optional override)`}
                      value={targetTransferAmount}
                      onValueChange={(num) => setTargetTransferAmount(num)}
                      helperText={`Leave blank to auto-convert via cached FX rate into ${selectedTargetSubObj.currency}.`}
                    />
                  </Box>
                )}
            </Box>
          )}

          {/* Physical Cash Coin Split / Coin Change Controls */}
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

          {/* Debt & Contact Contextual Controls */}
          {isDebtNature && (
            <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: "#FFFBEB", border: "1px solid #FDE68A", display: "flex", flexDirection: "column", gap: 1.5 }}>
              {nature === "PAYABLE_BORROW" && (
                <Box>
                  <Typography variant="caption" sx={{ fontWeight: 700, display: "block", mb: 0.5 }}>
                    How did this borrowing happen?
                  </Typography>
                  <RadioGroup
                    row
                    value={payableMode}
                    onChange={(e) => setPayableMode(e.target.value)}
                  >
                    <FormControlLabel
                      value="EXPENSE_TALANG"
                      control={<Radio size="small" />}
                      label={<Typography variant="caption">Covered Directly (Expense + Debt)</Typography>}
                    />
                    <FormControlLabel
                      value="CASH_LOAN"
                      control={<Radio size="small" />}
                      label={<Typography variant="caption">Cash / Transfer Loan to My Vault</Typography>}
                    />
                  </RadioGroup>
                </Box>
              )}

              <Box>
                <Stack direction="row" spacing={1} alignItems="center">
                  <TextField
                    select
                    label="Counterparty / Lender / Friend"
                    size="small"
                    fullWidth
                    value={partyId}
                    onChange={(e) => {
                      setPartyId(e.target.value);
                      setReferenceDebtId("");
                    }}
                  >
                    {partyList.map((p) => (
                      <MenuItem key={p.id} value={p.id}>
                        {p.name} ({p.partyType})
                      </MenuItem>
                    ))}
                  </TextField>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<PersonAddAlt1OutlinedIcon />}
                    onClick={() =>
                      openAddPartyDialog((created) => setPartyId(String(created.id)), {
                        isDebtContact: true,
                      })
                    }
                    sx={{ flexShrink: 0, whiteSpace: "nowrap" }}
                  >
                    + Contact
                  </Button>
                </Stack>
              </Box>

              {isSettlementNature && (
                <TextField
                  select
                  label={
                    nature === "RECEIVABLE_COLLECT"
                      ? "Settle Which Open Receivable?"
                      : "Pay Which Open Payable?"
                  }
                  size="small"
                  fullWidth
                  value={referenceDebtId}
                  onChange={(e) => setReferenceDebtId(e.target.value)}
                >
                  <MenuItem value="">Auto FIFO (Oldest First)</MenuItem>
                  {openItemsForSettlement.map((item) => (
                    <MenuItem key={item.id} value={String(item.id)}>
                      {item.transaction?.title || "Open Item"} — Rem:{" "}
                      {formatNativeMoney(item.remainingOpenAmount, baseUpper)}
                    </MenuItem>
                  ))}
                </TextField>
              )}

              <Autocomplete
                freeSolo
                size="small"
                options={savedExternalAccounts}
                value={counterpartyAccountNote}
                onInputChange={(_, newVal) => setCounterpartyAccountNote(newVal)}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Counterparty External Account (Optional)"
                    placeholder="e.g. BRI - Amet, BCA - Nando"
                  />
                )}
              />
            </Box>
          )}

          {/* 5. Spacious Mobile-Friendly Date & Time Pickers + Now Button (#6) */}
          <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: "#F8FAFC", border: "1px solid #E2E8F0" }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.25 }}>
              <Typography variant="caption" sx={{ fontWeight: 800, color: "#475569" }}>
                TRANSACTION DATE &amp; TIME
              </Typography>
              <Button
                size="small"
                variant="outlined"
                startIcon={<AccessTimeIcon />}
                onClick={() => {
                  const nowDt = getNowDayjs();
                  setDateValue(nowDt);
                  setTimeValue(nowDt);
                }}
                sx={{ height: 26, fontSize: "0.72rem", fontWeight: 700 }}
              >
                Now
              </Button>
            </Stack>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
              <DatePicker
                label="Date"
                value={dateValue}
                onChange={(newVal) => newVal && setDateValue(newVal)}
                format="DD MMM YYYY"
                slotProps={{ textField: { size: "small", fullWidth: true } }}
              />
              <TimePicker
                label="Time"
                value={timeValue}
                onChange={(newVal) => newVal && setTimeValue(newVal)}
                ampm={false}
                slotProps={{ textField: { size: "small", fullWidth: true } }}
              />
            </Stack>

            {retroactiveAlert && (
              <Alert severity="info" sx={{ mt: 1.25, py: 0.5 }}>
                <Typography variant="caption">
                  <b>Retroactive Absorbed Mode:</b> This date precedes checkpoint &quot;{retroactiveAlert.periodLabel}&quot; ({retroactiveAlert.checkpointDate}). Live vault balance stays intact and discrepancies auto-adjust.
                </Typography>
              </Alert>
            )}
          </Box>

          {/* 6. Collapsible More Options (Admin Fee, Manual FX Rate Override, Notes) (#9) */}
          <Accordion
            expanded={moreExpanded || isForeignEntry}
            onChange={(_, exp) => setMoreExpanded(exp)}
            variant="outlined"
            sx={{ borderRadius: "10px !important", "&:before": { display: "none" } }}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Stack direction="row" spacing={1} alignItems="center">
                <TuneOutlinedIcon fontSize="small" color="action" />
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "#334155" }}>
                  More Options (Admin Fee, Notes{isForeignEntry ? ", FX Rate" : ""})
                </Typography>
              </Stack>
            </AccordionSummary>
            <AccordionDetails sx={{ display: "flex", flexDirection: "column", gap: 1.5, pt: 0 }}>
              {isForeignEntry && (
                <TextField
                  size="small"
                  type="number"
                  label={`FX Rate Override (1 ${entryCurrency} = ? ${baseUpper})`}
                  placeholder={cachedFxRate > 0 ? String(cachedFxRate) : "Enter rate"}
                  value={manualFxRate}
                  onChange={(e) => setManualFxRate(e.target.value)}
                  helperText="Optional override. Saved rate locks permanently onto this historical transaction."
                />
              )}

              <CurrencyTextField
                label={`Admin Fee / Auto-Split Tax (${entryCurrency})`}
                value={taxFeeAmount}
                onValueChange={(num) => setTaxFeeAmount(num)}
                helperText="Automatically split into a separate child EXP_ADMIN_TAX record."
              />

              <TextField
                label="Notes / Receipt Reference (Optional)"
                multiline
                minRows={2}
                size="small"
                fullWidth
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </AccordionDetails>
          </Accordion>
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
