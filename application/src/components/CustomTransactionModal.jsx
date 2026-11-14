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
  FormLabel,
  FormControl,
  Autocomplete,
  IconButton,
  Popover,
  Box,
  Grid,
} from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import PersonAddAlt1OutlinedIcon from "@mui/icons-material/PersonAddAlt1Outlined";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLedgerStore } from "@/store/useLedgerStore";
import CurrencyTextField from "@/components/CurrencyTextField";
import MoneyValue from "@/components/MoneyValue";
import CoinExpenseControls from "@/components/CoinExpenseControls";
import { isPhysicalCashVault } from "@/lib/vaultHelpers";

const NATURE_OPTIONS = [
  { value: "EXPENSE", label: "Expense (Pengeluaran)" },
  { value: "INCOME", label: "Income / Top Up (Pemasukan)" },
  { value: "TRANSFER", label: "Transfer (Move Between Vaults)" },
  { value: "RECEIVABLE_LEND", label: "Lend / Talangi Teman (Piutang)" },
  { value: "RECEIVABLE_COLLECT", label: "Receive Debt Payment (Terima Piutang)" },
  { value: "PAYABLE_BORROW", label: "I Borrow / Ditalangi (Utang Saya)" },
  { value: "PAYABLE_REPAY", label: "Pay My Debt / PayLater (Bayar Utang)" },
];

function getLocalNowParts() {
  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  return { dateStr, timeStr };
}

export default function CustomTransactionModal({
  vaults = [],
  categories = [],
  parties = [],
  latestCheckpointsByVault = {},
  defaultMonthlyVaultId = null,
  defaultCashVaultId = null,
}) {
  const {
    transactionDialog,
    closeTransactionDialog,
    openAddPartyDialog,
    enqueueToast,
  } = useLedgerStore();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const [nature, setNature] = useState("EXPENSE");
  const [payableMode, setPayableMode] = useState("EXPENSE_TALANG");
  const [sourceVaultId, setSourceVaultId] = useState("");
  const [targetVaultId, setTargetVaultId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [partyId, setPartyId] = useState("");
  const [grossAmount, setGrossAmount] = useState("");
  const [taxFeeAmount, setTaxFeeAmount] = useState("");
  const [coinMode, setCoinMode] = useState("NONE"); // "NONE" | "SPLIT" | "CHANGE"
  const [coinUsedAmount, setCoinUsedAmount] = useState("");
  const [coinChangeAmount, setCoinChangeAmount] = useState("");
  const [transactionDate, setTransactionDate] = useState(() => getLocalNowParts().dateStr);
  const [transactionTime, setTransactionTime] = useState(() => getLocalNowParts().timeStr);
  const [referenceDebtId, setReferenceDebtId] = useState("");
  const [counterpartyAccountNote, setCounterpartyAccountNote] = useState("");
  const [notes, setNotes] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [infoAnchor, setInfoAnchor] = useState(null);

  const selfParty = useMemo(
    () => parties.find((p) => p.code === "SELF" || p.partyType === "SELF"),
    [parties]
  );

  // Sync preset values whenever the dialog opens
  useEffect(() => {
    if (!transactionDialog.open) return;

    const preset = transactionDialog.presetCard;
    const { dateStr, timeStr } = getLocalNowParts();
    const resolvedDefaultVaultId =
      defaultMonthlyVaultId || defaultCashVaultId || vaults[0]?.id || "";

    if (preset) {
      setTitle(preset.title || "");
      setNature(preset.nature || "EXPENSE");
      setPayableMode(preset.payableMode || "EXPENSE_TALANG");
      setSourceVaultId(
        preset.sourceVaultId
          ? String(preset.sourceVaultId)
          : resolvedDefaultVaultId
          ? String(resolvedDefaultVaultId)
          : ""
      );
      setTargetVaultId(preset.targetVaultId ? String(preset.targetVaultId) : "");
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
      setTransactionDate(preset.transactionDate || dateStr);
      setTransactionTime(preset.transactionTime || timeStr);
    } else {
      setTitle("");
      setNature("EXPENSE");
      setPayableMode("EXPENSE_TALANG");
      setSourceVaultId(resolvedDefaultVaultId ? String(resolvedDefaultVaultId) : "");
      const fallbackTarget = vaults.find((v) => String(v.id) !== String(resolvedDefaultVaultId));
      setTargetVaultId(fallbackTarget?.id ? String(fallbackTarget.id) : "");
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
      setTransactionDate(dateStr);
      setTransactionTime(timeStr);
    }
    setErrorMsg("");
  }, [
    transactionDialog.open,
    transactionDialog.presetCard,
    vaults,
    selfParty,
    defaultMonthlyVaultId,
    defaultCashVaultId,
  ]);

  const isDebtNature =
    nature === "RECEIVABLE_LEND" ||
    nature === "RECEIVABLE_COLLECT" ||
    nature === "PAYABLE_BORROW" ||
    nature === "PAYABLE_REPAY";

  const isSettlementNature =
    nature === "RECEIVABLE_COLLECT" || nature === "PAYABLE_REPAY";

  const needsVaultSelection =
    nature !== "PAYABLE_BORROW" || payableMode === "CASH_LOAN";

  const selectedSourceVaultObj = useMemo(
    () => vaults.find((v) => String(v.id) === String(sourceVaultId)),
    [vaults, sourceVaultId]
  );

  const showCoinControls =
    nature === "EXPENSE" && isPhysicalCashVault(selectedSourceVaultObj);

  const selectedPartyObj = useMemo(
    () => parties.find((p) => String(p.id) === String(partyId)),
    [parties, partyId]
  );

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
    enabled: Boolean(transactionDialog.open && isSettlementNature && partyId && String(partyId) !== String(selfParty?.id)),
  });

  const openItemsForSettlement = useMemo(() => {
    if (!partyDetail) return [];
    return nature === "RECEIVABLE_COLLECT"
      ? partyDetail.openReceivables || []
      : partyDetail.openPayables || [];
  }, [partyDetail, nature]);

  // #15 Auto-Detect Retroactive against latest checkpoint of the affected vault
  const retroactiveAlert = useMemo(() => {
    if (!needsVaultSelection || !sourceVaultId || !transactionDate) return null;
    const latestCp = latestCheckpointsByVault[sourceVaultId];
    if (!latestCp || !latestCp.checkpointTimestamp) return null;

    const chosenDt = new Date(`${transactionDate}T${transactionTime || "00:00"}:00`);
    const cpDt = new Date(latestCp.checkpointTimestamp);
    if (Number.isNaN(chosenDt.getTime()) || Number.isNaN(cpDt.getTime())) return null;

    if (chosenDt < cpDt) {
      return {
        periodLabel: latestCp.periodLabel,
        checkpointDate: cpDt.toLocaleDateString(),
      };
    }
    return null;
  }, [needsVaultSelection, sourceVaultId, transactionDate, transactionTime, latestCheckpointsByVault]);

  const submitMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Transaction failed");
      return json.data;
    },
    onSuccess: (createdTx, vars) => {
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
      queryClient.invalidateQueries({ queryKey: ["debts"] });
      queryClient.invalidateQueries({ queryKey: ["debt-detail"] });
      queryClient.invalidateQueries({ queryKey: ["checkpoints"] });

      closeTransactionDialog();
      enqueueToast(`Recorded "${vars.title}"`, {
        severity: "success",
        undoTransactionId: createdTx.id,
      });
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
        : "Custom Transaction");

    submitMutation.mutate({
      title: finalTitle,
      nature,
      payableMode: nature === "PAYABLE_BORROW" ? payableMode : undefined,
      categoryId: pickedCat ? pickedCat.id : null,
      commitmentType: pickedCat?.commitmentType || "NONE",
      priorityTier: pickedCat?.priorityTier || "NONE",
      partyId: partyId ? parseInt(partyId, 10) : selfParty?.id,
      sourceVaultId: needsVaultSelection && sourceVaultId ? parseInt(sourceVaultId, 10) : null,
      targetVaultId: nature === "TRANSFER" && targetVaultId ? parseInt(targetVaultId, 10) : null,
      grossAmount: amt,
      taxFeeAmount: Number(taxFeeAmount) || 0,
      coinUsedAmount: coinUsedVal,
      coinChangeAmount: coinChangeVal,
      transactionDate: `${transactionDate}T${transactionTime || "12:00"}:00`,
      transactionTime,
      referenceDebtId: isSettlementNature && referenceDebtId ? parseInt(referenceDebtId, 10) : null,
      counterpartyAccountNote: isDebtNature && counterpartyAccountNote ? counterpartyAccountNote.trim() : null,
      notes: notes.trim() || null,
    });
  };

  const partyList = isDebtNature
    ? parties.filter((p) => p.code !== "SELF" && p.partyType !== "SELF")
    : parties;

  const savedExternalAccounts = selectedPartyObj?.externalAccounts || [];

  return (
    <Dialog open={transactionDialog.open} onClose={closeTransactionDialog} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit}>
        <DialogTitle sx={{ fontWeight: 800, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>Record Transaction</span>
          <IconButton size="small" onClick={(e) => setInfoAnchor(e.currentTarget)}>
            <InfoOutlinedIcon fontSize="small" />
          </IconButton>
        </DialogTitle>

        <Popover
          open={Boolean(infoAnchor)}
          anchorEl={infoAnchor}
          onClose={() => setInfoAnchor(null)}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        >
          <Typography variant="caption" sx={{ p: 1.5, display: "block", maxWidth: 290 }}>
            • <strong>Auto-Retroactive:</strong> Dates older than your vault&apos;s latest checkpoint automatically absorb into unexplained discrepancies without corrupting your current balance.<br />
            • <strong>FIFO Totalan:</strong> Leave Specific Debt Item as Auto-Allocate to pay oldest open items first.
          </Typography>
        </Popover>

        <DialogContent dividers>
          <Stack spacing={2}>
            {errorMsg && <Alert severity="error">{errorMsg}</Alert>}

            <TextField
              select
              label="Transaction Type (Nature)"
              size="small"
              fullWidth
              value={nature}
              onChange={(e) => {
                setNature(e.target.value);
                setReferenceDebtId("");
              }}
            >
              {NATURE_OPTIONS.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              label="Title / Description"
              placeholder='e.g. "Beli Makan Siang", "Bayar Utang ke Budi"'
              size="small"
              fullWidth
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />

            {/* PAYABLE_BORROW Mode Selector (#17) */}
            {nature === "PAYABLE_BORROW" && (
              <FormControl component="fieldset" sx={{ bgcolor: "#F8FAFC", p: 1.5, borderRadius: 2, border: "1px solid #E2E8F0" }}>
                <FormLabel component="legend" sx={{ fontSize: "0.75rem", fontWeight: 800, color: "#334155" }}>
                  Borrowing Mode
                </FormLabel>
                <RadioGroup
                  value={payableMode}
                  onChange={(e) => setPayableMode(e.target.value)}
                >
                  <FormControlLabel
                    value="EXPENSE_TALANG"
                    control={<Radio size="small" />}
                    label={
                      <Typography variant="caption">
                        <strong>Ditalangi Teman:</strong> Personal expense right now (counts in consumption), no cash enters my vault.
                      </Typography>
                    }
                  />
                  <FormControlLabel
                    value="CASH_LOAN"
                    control={<Radio size="small" />}
                    label={
                      <Typography variant="caption">
                        <strong>Pinjam Tunai / Cash Loan:</strong> Cash deposits into my Vault now (0 consumption).
                      </Typography>
                    }
                  />
                </RadioGroup>
              </FormControl>
            )}

            {/* Amount + Admin Fee */}
            <Grid container spacing={1.5}>
              <Grid size={{ xs: 12, sm: nature === "EXPENSE" || nature === "TRANSFER" || nature === "PAYABLE_REPAY" ? 7 : 12 }}>
                <CurrencyTextField
                  label="Gross Amount"
                  value={grossAmount}
                  onValueChange={(num) => setGrossAmount(num)}
                  required
                  showClear
                />
              </Grid>
              {(nature === "EXPENSE" || nature === "TRANSFER" || nature === "PAYABLE_REPAY") && (
                <Grid size={{ xs: 12, sm: 5 }}>
                  <CurrencyTextField
                    label="Admin Fee / Tax (Optional)"
                    value={taxFeeAmount}
                    onValueChange={(num) => setTaxFeeAmount(num)}
                    showClear
                  />
                </Grid>
              )}
            </Grid>

            {/* Vault Selectors */}
            {needsVaultSelection && (
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                <TextField
                  select
                  label={
                    nature === "INCOME" || nature === "RECEIVABLE_COLLECT" || (nature === "PAYABLE_BORROW" && payableMode === "CASH_LOAN")
                      ? "Destination Vault (Money In)"
                      : "Source Vault (Money Out)"
                  }
                  size="small"
                  fullWidth
                  required
                  value={sourceVaultId}
                  onChange={(e) => setSourceVaultId(e.target.value)}
                >
                  {vaults.map((v) => (
                    <MenuItem key={v.id} value={String(v.id)}>
                      {v.name} (<MoneyValue value={v.currentBalance} />)
                    </MenuItem>
                  ))}
                </TextField>

                {nature === "TRANSFER" && (
                  <TextField
                    select
                    label="Target Vault"
                    size="small"
                    fullWidth
                    required
                    value={targetVaultId}
                    onChange={(e) => setTargetVaultId(e.target.value)}
                  >
                    {vaults
                      .filter((v) => String(v.id) !== String(sourceVaultId))
                      .map((v) => (
                        <MenuItem key={v.id} value={String(v.id)}>
                          {v.name}
                        </MenuItem>
                      ))}
                  </TextField>
                )}
              </Stack>
            )}

            {/* Category Selector for Consumption Natures */}
            {(nature === "EXPENSE" || (nature === "PAYABLE_BORROW" && payableMode === "EXPENSE_TALANG")) && (
              <TextField
                select
                label="Category & Consumption Layer"
                size="small"
                fullWidth
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                <MenuItem value="">Uncategorized</MenuItem>
                {categories.map((c) => (
                  <MenuItem key={c.id} value={String(c.id)}>
                    {c.name} ({c.commitmentType})
                  </MenuItem>
                ))}
              </TextField>
            )}

            {/* Party Selector + Quick Add Contact (#17) */}
            <Stack direction="row" spacing={1} alignItems="center">
              <TextField
                select
                label={isDebtNature ? "Contact / Lender / Borrower" : "Party"}
                size="small"
                fullWidth
                value={partyId}
                onChange={(e) => {
                  setPartyId(e.target.value);
                  setReferenceDebtId("");
                }}
              >
                {partyList.map((p) => (
                  <MenuItem key={p.id} value={String(p.id)}>
                    {p.name}
                    {Number(p.receivableBalance || 0) > 0 ? " (Owes you)" : ""}
                    {Number(p.payableBalance || 0) > 0 ? " (You owe)" : ""}
                  </MenuItem>
                ))}
              </TextField>
              <Button
                variant="outlined"
                size="small"
                startIcon={<PersonAddAlt1OutlinedIcon />}
                onClick={() =>
                  openAddPartyDialog((created) => setPartyId(String(created.id)), {
                    isDebtContact: isDebtNature,
                  })
                }
                sx={{ flexShrink: 0, height: 40, fontWeight: 700 }}
              >
                + Contact
              </Button>
            </Stack>

            {/* Specific Item vs FIFO Allocation + External Counterparty Bank Note (#17) */}
            {isSettlementNature && (
              <Stack spacing={1.5} sx={{ bgcolor: "#F8FAFC", p: 1.5, borderRadius: 2, border: "1px solid #E2E8F0" }}>
                <TextField
                  select
                  label="Apply Payment To (Specific vs FIFO Totalan)"
                  size="small"
                  fullWidth
                  value={referenceDebtId}
                  onChange={(e) => {
                    const pickedId = e.target.value;
                    setReferenceDebtId(pickedId);
                    if (pickedId) {
                      const found = openItemsForSettlement.find((i) => String(i.id) === String(pickedId));
                      if (found && !grossAmount) {
                        setGrossAmount(Number(found.remainingOpenAmount));
                      }
                    }
                  }}
                >
                  <MenuItem value="">
                    Auto-Allocate Oldest First / Totalan FIFO ({openItemsForSettlement.length} open item{openItemsForSettlement.length === 1 ? "" : "s"})
                  </MenuItem>
                  {openItemsForSettlement.map((item) => (
                    <MenuItem key={item.id} value={String(item.id)}>
                      {item.transaction?.title || `Entry #${item.id}`} — Open:{" "}
                      <MoneyValue value={item.remainingOpenAmount} />
                    </MenuItem>
                  ))}
                </TextField>

                <Autocomplete
                  freeSolo
                  size="small"
                  options={savedExternalAccounts}
                  inputValue={counterpartyAccountNote}
                  onInputChange={(_, val) => setCounterpartyAccountNote(val)}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Their External Bank / E-Wallet Note (Optional)"
                      placeholder='e.g. "BCA - Budi", "Mandiri"'
                    />
                  )}
                />
              </Stack>
            )}

            {/* External bank note option for Lend / Borrow too */}
            {(nature === "RECEIVABLE_LEND" || nature === "PAYABLE_BORROW") && (
              <Autocomplete
                freeSolo
                size="small"
                options={savedExternalAccounts}
                inputValue={counterpartyAccountNote}
                onInputChange={(_, val) => setCounterpartyAccountNote(val)}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Counterparty External Account Note (Optional)"
                    placeholder='e.g. "Transfer to BCA Budi"'
                  />
                )}
              />
            )}

            {/* Date + Exact Time + "Now" Button (#10) */}
            <Stack direction="row" spacing={1} alignItems="center">
              <TextField
                label="Date"
                type="date"
                size="small"
                fullWidth
                InputLabelProps={{ shrink: true }}
                value={transactionDate}
                onChange={(e) => setTransactionDate(e.target.value)}
                required
              />
              <TextField
                label="Time"
                type="time"
                size="small"
                sx={{ width: 150, flexShrink: 0 }}
                InputLabelProps={{ shrink: true }}
                value={transactionTime}
                onChange={(e) => setTransactionTime(e.target.value)}
                required
              />
              <Button
                variant="outlined"
                size="small"
                startIcon={<AccessTimeIcon />}
                onClick={() => {
                  const { dateStr, timeStr } = getLocalNowParts();
                  setTransactionDate(dateStr);
                  setTransactionTime(timeStr);
                }}
                sx={{ height: 40, flexShrink: 0, fontWeight: 700 }}
              >
                Now
              </Button>
            </Stack>

            {/* Auto-Detected Retroactive Alert (#15) */}
            {retroactiveAlert && (
              <Alert severity="info" variant="outlined">
                <strong>Auto-Detected Retroactive Entry:</strong> Date &amp; time is before this vault&apos;s latest checkpoint ({retroactiveAlert.periodLabel}). It will absorb automatically without throwing off your current vault balance.
              </Alert>
            )}

            {/* Cash Coin Split or Coin Change Controls (Visible ONLY when Physical CASH is selected) */}
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

            <TextField
              label="Notes (Optional)"
              size="small"
              fullWidth
              multiline
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </Stack>
        </DialogContent>

        <DialogActions sx={{ p: 2 }}>
          <Button onClick={closeTransactionDialog} color="inherit" disabled={submitMutation.isPending}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={submitMutation.isPending}>
            {submitMutation.isPending ? "Recording..." : "Save Transaction"}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
