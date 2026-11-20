"use client";

import React, { useEffect, useMemo, useState } from "react";
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
  Chip,
  IconButton,
  Popover,
  Box,
  Switch,
  FormControlLabel,
  InputAdornment,
  useTheme,
  useMediaQuery,
} from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import CloseIcon from "@mui/icons-material/Close";
import FlashOnIcon from "@mui/icons-material/FlashOn";
import LinkIcon from "@mui/icons-material/Link";
import HistoryIcon from "@mui/icons-material/History";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLedgerStore } from "@/store/useLedgerStore";
import CurrencyTextField from "@/components/common/CurrencyTextField";
import MoneyValue from "@/components/common/MoneyValue";
import {
  extractCardDraftFromTransaction,
  normalizeCardTitle,
} from "@/lib/cardPromotionUtils";
import { parseCurrencyInput } from "@/lib/money";

const CARD_TYPES = [
  { value: "EXPENSE", label: "Expense" },
  { value: "INCOME", label: "Income / Top Up" },
  { value: "TRANSFER", label: "Vault Transfer" },
  { value: "RECEIVABLE_LEND", label: "Lend / Talangi" },
  { value: "RECEIVABLE_COLLECT", label: "Collect Receivable" },
  { value: "PAYABLE_BORROW", label: "I Borrow / Ditalangi" },
  { value: "PAYABLE_REPAY", label: "Repay Debt / PayLater" },
];

const CADENCE_OPTIONS = [
  { value: "ON_DEMAND", label: "On Demand" },
  { value: "DAILY_WORKDAY", label: "Daily (Workdays)" },
  { value: "DAILY_ANY", label: "Daily (Every Day)" },
  { value: "WEEKLY", label: "Weekly Habit" },
  { value: "MONTHLY", label: "Monthly Bill" },
];

export default function PromoteToCardModal({
  vaults = [],
  categories = [],
  parties = [],
  baseCurrency = "IDR",
}) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const queryClient = useQueryClient();

  const { promoteCardDialog, closePromoteCardDialog, enqueueToast } = useLedgerStore();
  const isOpen = Boolean(promoteCardDialog?.open);
  const rawTx = promoteCardDialog?.transaction || null;

  const [title, setTitle] = useState("");
  const [cardActionType, setCardActionType] = useState("EXPENSE");
  const [defaultAmount, setDefaultAmount] = useState("");
  const [quickAmounts, setQuickAmounts] = useState([]);
  const [quickInput, setQuickInput] = useState("");
  const [defaultVaultId, setDefaultVaultId] = useState("");
  const [defaultSubContainerId, setDefaultSubContainerId] = useState("");
  const [targetVaultId, setTargetVaultId] = useState("");
  const [targetSubContainerId, setTargetSubContainerId] = useState("");
  const [defaultCategoryId, setDefaultCategoryId] = useState("");
  const [defaultPartyId, setDefaultPartyId] = useState("");
  const [expectedCadence, setExpectedCadence] = useState("ON_DEMAND");
  const [oneTapSubmit, setOneTapSubmit] = useState(false);
  const [allowDuplicate, setAllowDuplicate] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [infoAnchor, setInfoAnchor] = useState(null);

  const previewQuery = useQuery({
    queryKey: ["promote-card-preview", rawTx?.id],
    queryFn: async () => {
      const res = await fetch(`/api/cards/from-transaction?sourceTransactionId=${rawTx.id}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to load transaction preview");
      return json.data;
    },
    enabled: isOpen && Boolean(rawTx?.id),
    staleTime: 0,
  });

  const cardsListQuery = useQuery({
    queryKey: ["cards-all-active"],
    queryFn: async () => {
      const res = await fetch("/api/cards");
      const json = await res.json();
      if (!json.success) return [];
      return json.data || [];
    },
    enabled: isOpen,
  });

  const hydratedTx = previewQuery.data?.transaction || rawTx;

  // Populate fields once when opening for a transaction
  useEffect(() => {
    if (!isOpen || !rawTx) return;
    const draft = extractCardDraftFromTransaction(rawTx);
    if (!draft) return;

    setTitle(draft.title || "");
    setCardActionType(draft.cardActionType || "EXPENSE");
    setDefaultAmount(draft.defaultAmount > 0 ? String(draft.defaultAmount) : "");
    setQuickAmounts(Array.isArray(draft.quickAmounts) ? draft.quickAmounts : []);
    setQuickInput("");
    setDefaultVaultId(draft.defaultVaultId ? String(draft.defaultVaultId) : "");
    setDefaultSubContainerId(draft.defaultSubContainerId ? String(draft.defaultSubContainerId) : "");
    setTargetVaultId(draft.targetVaultId ? String(draft.targetVaultId) : "");
    setTargetSubContainerId(draft.targetSubContainerId ? String(draft.targetSubContainerId) : "");
    setDefaultCategoryId(draft.defaultCategoryId ? String(draft.defaultCategoryId) : "");
    setDefaultPartyId(draft.defaultPartyId ? String(draft.defaultPartyId) : "");
    setExpectedCadence(draft.expectedCadence || "ON_DEMAND");
    setOneTapSubmit(Boolean(draft.oneTapSubmit));
    setAllowDuplicate(false);
    setErrorMsg("");
  }, [isOpen, rawTx]);

  // Fill in leg-derived vault/sub-vault details if initial snapshot didn't include legs
  useEffect(() => {
    if (!isOpen || !previewQuery.data?.transaction) return;
    const fullDraft = extractCardDraftFromTransaction(previewQuery.data.transaction);
    if (!fullDraft) return;

    setDefaultVaultId((prev) => prev || (fullDraft.defaultVaultId ? String(fullDraft.defaultVaultId) : ""));
    setDefaultSubContainerId(
      (prev) => prev || (fullDraft.defaultSubContainerId ? String(fullDraft.defaultSubContainerId) : "")
    );
    setTargetVaultId((prev) => prev || (fullDraft.targetVaultId ? String(fullDraft.targetVaultId) : ""));
    setTargetSubContainerId(
      (prev) => prev || (fullDraft.targetSubContainerId ? String(fullDraft.targetSubContainerId) : "")
    );
    setDefaultCategoryId(
      (prev) => prev || (fullDraft.defaultCategoryId ? String(fullDraft.defaultCategoryId) : "")
    );
    setDefaultPartyId((prev) => prev || (fullDraft.defaultPartyId ? String(fullDraft.defaultPartyId) : ""));
  }, [isOpen, previewQuery.data]);

  const selectedSourceVault = useMemo(
    () => vaults.find((v) => v.id === Number(defaultVaultId)) || null,
    [vaults, defaultVaultId]
  );
  const sourceSubContainers = useMemo(
    () => selectedSourceVault?.subContainers || [],
    [selectedSourceVault]
  );
  const selectedSourceSub = useMemo(
    () => sourceSubContainers.find((sc) => sc.id === Number(defaultSubContainerId)) || null,
    [sourceSubContainers, defaultSubContainerId]
  );

  const selectedTargetVault = useMemo(
    () => vaults.find((v) => v.id === Number(targetVaultId)) || null,
    [vaults, targetVaultId]
  );
  const targetSubContainers = useMemo(
    () => selectedTargetVault?.subContainers || [],
    [selectedTargetVault]
  );

  const effectiveCurrency =
    selectedSourceSub?.currency || hydratedTx?.currency || baseCurrency;

  // Detect any active existing card matching current normalized Title + Card Action Type
  const matchingExistingCard = useMemo(() => {
    const key = normalizeCardTitle(title);
    if (!key) return null;

    const listMatch = (cardsListQuery.data || []).find(
      (c) =>
        c.isActive &&
        c.visibilityMode !== "ARCHIVED" &&
        c.cardActionType === cardActionType &&
        normalizeCardTitle(c.title) === key
    );
    if (listMatch) return listMatch;

    const previewDup = previewQuery.data?.duplicateCard;
    if (
      previewDup &&
      previewDup.cardActionType === cardActionType &&
      normalizeCardTitle(previewDup.title) === key
    ) {
      return previewDup;
    }
    return null;
  }, [cardsListQuery.data, previewQuery.data, title, cardActionType]);

  const handleAddQuickAmount = () => {
    const num =
      effectiveCurrency === baseCurrency
        ? parseCurrencyInput(quickInput)
        : Number(String(quickInput).replace(/,/g, ""));
    if (!Number.isFinite(num) || num <= 0) return;
    if (!quickAmounts.includes(num)) {
      setQuickAmounts((prev) => [...prev, num].slice(0, 6));
    }
    setQuickInput("");
  };

  const promoteMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await fetch("/api/cards/from-transaction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.success) {
        const err = new Error(json.error || "Failed to save Action Card");
        err.code = json.code;
        err.existingCard = json.existingCard || null;
        throw err;
      }
      return json.data;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["cards"] });
      queryClient.invalidateQueries({ queryKey: ["cards-all-active"] });

      closePromoteCardDialog();
      const cardTitle = result.card?.title || title;
      if (result.mode === "LINK_EXISTING") {
        enqueueToast(`Linked transaction to "${cardTitle}"`, { severity: "success" });
      } else {
        enqueueToast(
          `Saved "${cardTitle}" to Action Cards (seeded from ${result.seededFromCount || 1} tx)`,
          { severity: "success" }
        );
      }
    },
    onError: (err) => {
      setErrorMsg(err.message || "Failed to save Action Card");
    },
  });

  const handleCreateSubmit = (e) => {
    e.preventDefault();
    setErrorMsg("");

    if (!title.trim()) {
      setErrorMsg("Card title is required.");
      return;
    }

    if (matchingExistingCard && !allowDuplicate) {
      setErrorMsg(
        `Card "${matchingExistingCard.title}" already exists. Link to it or click "Keep Separate".`
      );
      return;
    }

    const numericAmount = Number(defaultAmount) > 0 ? Number(defaultAmount) : 0;

    promoteMutation.mutate({
      mode: "CREATE",
      sourceTransactionId: hydratedTx?.id || rawTx?.id,
      title: title.trim(),
      cardActionType,
      defaultAmount: numericAmount,
      quickAmounts,
      defaultVaultId: defaultVaultId ? Number(defaultVaultId) : null,
      defaultSubContainerId: defaultSubContainerId ? Number(defaultSubContainerId) : null,
      targetVaultId: cardActionType === "TRANSFER" && targetVaultId ? Number(targetVaultId) : null,
      targetSubContainerId:
        cardActionType === "TRANSFER" && targetSubContainerId ? Number(targetSubContainerId) : null,
      defaultCategoryId: defaultCategoryId ? Number(defaultCategoryId) : null,
      defaultPartyId: defaultPartyId ? Number(defaultPartyId) : null,
      expectedCadence,
      oneTapSubmit,
      allowDuplicate,
    });
  };

  const handleLinkExisting = () => {
    if (!matchingExistingCard || !rawTx?.id) return;
    setErrorMsg("");
    promoteMutation.mutate({
      mode: "LINK_EXISTING",
      sourceTransactionId: hydratedTx?.id || rawTx.id,
      existingCardId: matchingExistingCard.id,
    });
  };

  const matchingHistoryCount = previewQuery.data?.matchingHistoryCount || 0;

  return (
    <Dialog
      open={isOpen}
      onClose={closePromoteCardDialog}
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
      <form
        onSubmit={handleCreateSubmit}
        style={{ display: "flex", flexDirection: "column", height: "100%" }}
      >
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
            <FlashOnIcon color="primary" fontSize="small" />
            <Typography variant="h6" sx={{ fontWeight: 800 }}>
              Save as Action Card
            </Typography>
            <IconButton
              size="small"
              aria-label="How promoted cards work"
              onClick={(e) => setInfoAnchor(e.currentTarget)}
            >
              <InfoOutlinedIcon fontSize="small" color="action" />
            </IconButton>
          </Stack>
          <IconButton size="small" onClick={closePromoteCardDialog}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <Popover
          open={Boolean(infoAnchor)}
          anchorEl={infoAnchor}
          onClose={() => setInfoAnchor(null)}
          anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        >
          <Box sx={{ p: 2, maxWidth: 320 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 0.5 }}>
              Habit Seeding &amp; 24h Spotlight
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", lineHeight: 1.5 }}>
              Promoted cards scan past matching transactions to seed time-of-day, day-of-week, and interval stats without modifying historical rows, and receive a 24-hour spotlight inside Top 5 Recommended.
            </Typography>
          </Box>
        </Popover>

        <DialogContent sx={{ p: 2.5, overflowY: "auto", flex: 1 }}>
          <Stack spacing={2}>
            {matchingHistoryCount > 1 && (
              <Alert
                severity="info"
                icon={<HistoryIcon fontSize="small" />}
                sx={{ py: 0.5, alignItems: "center" }}
              >
                <Typography variant="caption" sx={{ fontWeight: 700 }}>
                  Found {matchingHistoryCount} matching entries — Habit stats will be seeded automatically.
                </Typography>
              </Alert>
            )}

            {matchingExistingCard && !allowDuplicate && (
              <Alert
                severity="warning"
                sx={{
                  "& .MuiAlert-message": { width: "100%" },
                }}
              >
                <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>
                  Active card &ldquo;{matchingExistingCard.title}&rdquo; ({matchingExistingCard.cardActionType}) already exists.
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1.25 }}>
                  Link this transaction to the existing card&apos;s habit stats, or create a separate card.
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  <Button
                    size="small"
                    variant="contained"
                    color="warning"
                    startIcon={<LinkIcon />}
                    disabled={promoteMutation.isPending}
                    onClick={handleLinkExisting}
                    sx={{ fontWeight: 800 }}
                  >
                    Link to Existing Card
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    color="inherit"
                    disabled={promoteMutation.isPending}
                    onClick={() => {
                      setAllowDuplicate(true);
                      setErrorMsg("");
                    }}
                    sx={{ fontWeight: 700 }}
                  >
                    Create Separate Card
                  </Button>
                </Stack>
              </Alert>
            )}

            {matchingExistingCard && allowDuplicate && (
              <Alert
                severity="info"
                action={
                  <Button size="small" onClick={() => setAllowDuplicate(false)}>
                    Reset
                  </Button>
                }
                sx={{ py: 0.5 }}
              >
                <Typography variant="caption" sx={{ fontWeight: 700 }}>
                  Creating a separate Action Card alongside &ldquo;{matchingExistingCard.title}&rdquo;.
                </Typography>
              </Alert>
            )}

            {errorMsg && (
              <Alert severity="error" onClose={() => setErrorMsg("")}>
                {errorMsg}
              </Alert>
            )}

            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
              <TextField
                label="Card Title"
                size="small"
                fullWidth
                required
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setAllowDuplicate(false);
                }}
              />
              <TextField
                select
                label="Action Type"
                size="small"
                sx={{ minWidth: { sm: 195 } }}
                value={cardActionType}
                onChange={(e) => {
                  const nextType = e.target.value;
                  setCardActionType(nextType);
                  setAllowDuplicate(false);
                  if (nextType !== "TRANSFER") {
                    setTargetVaultId("");
                    setTargetSubContainerId("");
                  }
                }}
              >
                {CARD_TYPES.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>

            {/* Default Amount & Quick Amount Presets */}
            <Box>
              {effectiveCurrency === baseCurrency ? (
                <CurrencyTextField
                  label={`Default Amount (${effectiveCurrency})`}
                  value={defaultAmount}
                  onValueChange={(val) => setDefaultAmount(val)}
                  showClear
                  onClear={() => setDefaultAmount("")}
                />
              ) : (
                <TextField
                  label={`Default Amount (${effectiveCurrency})`}
                  type="number"
                  size="small"
                  fullWidth
                  inputProps={{ step: "any", min: 0 }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start" sx={{ fontWeight: 700 }}>
                        {effectiveCurrency}
                      </InputAdornment>
                    ),
                  }}
                  value={defaultAmount}
                  onChange={(e) => setDefaultAmount(e.target.value)}
                />
              )}

              <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1.25 }}>
                <TextField
                  label="Add Quick Amount Preset"
                  placeholder={effectiveCurrency === "IDR" ? "e.g. 20000" : "e.g. 10"}
                  size="small"
                  fullWidth
                  value={quickInput}
                  onChange={(e) => setQuickInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddQuickAmount();
                    }
                  }}
                />
                <Button
                  variant="outlined"
                  size="small"
                  onClick={handleAddQuickAmount}
                  sx={{ minWidth: 74, height: 40, fontWeight: 700 }}
                >
                  Add
                </Button>
              </Stack>

              {quickAmounts.length > 0 && (
                <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
                  {quickAmounts.map((amt) => (
                    <Chip
                      key={amt}
                      size="small"
                      variant="outlined"
                      label={<MoneyValue value={amt} currency={effectiveCurrency} />}
                      onDelete={() => setQuickAmounts((prev) => prev.filter((item) => item !== amt))}
                    />
                  ))}
                </Stack>
              )}
            </Box>

            {/* Source Vault & Source Sub-Vault */}
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
              <TextField
                select
                label={
                  cardActionType === "INCOME" ||
                  cardActionType === "RECEIVABLE_COLLECT" ||
                  cardActionType === "PAYABLE_BORROW"
                    ? "Destination Vault"
                    : "Source Vault"
                }
                size="small"
                fullWidth
                value={defaultVaultId}
                onChange={(e) => {
                  setDefaultVaultId(e.target.value);
                  setDefaultSubContainerId("");
                }}
              >
                <MenuItem value="">Select per tap</MenuItem>
                {vaults.map((v) => (
                  <MenuItem key={v.id} value={String(v.id)}>
                    {v.name}
                  </MenuItem>
                ))}
              </TextField>

              {sourceSubContainers.length > 0 && (
                <TextField
                  select
                  label="Sub-Vault Pocket (Optional)"
                  size="small"
                  fullWidth
                  value={defaultSubContainerId}
                  onChange={(e) => setDefaultSubContainerId(e.target.value)}
                >
                  <MenuItem value="">Auto (Vault Default)</MenuItem>
                  {sourceSubContainers.map((sc) => (
                    <MenuItem key={sc.id} value={String(sc.id)}>
                      {sc.name} ({sc.currency})
                    </MenuItem>
                  ))}
                </TextField>
              )}
            </Stack>

            {/* Target Vault & Target Sub-Vault (TRANSFER only) */}
            {cardActionType === "TRANSFER" && (
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                <TextField
                  select
                  label="Target Destination Vault"
                  size="small"
                  fullWidth
                  value={targetVaultId}
                  onChange={(e) => {
                    setTargetVaultId(e.target.value);
                    setTargetSubContainerId("");
                  }}
                >
                  <MenuItem value="">Select per tap</MenuItem>
                  {vaults.map((v) => (
                    <MenuItem key={v.id} value={String(v.id)}>
                      {v.name}
                    </MenuItem>
                  ))}
                </TextField>

                {targetSubContainers.length > 0 && (
                  <TextField
                    select
                    label="Target Sub-Vault Pocket"
                    size="small"
                    fullWidth
                    value={targetSubContainerId}
                    onChange={(e) => setTargetSubContainerId(e.target.value)}
                  >
                    <MenuItem value="">Auto (Vault Default)</MenuItem>
                    {targetSubContainers.map((sc) => (
                      <MenuItem key={sc.id} value={String(sc.id)}>
                        {sc.name} ({sc.currency})
                      </MenuItem>
                    ))}
                  </TextField>
                )}
              </Stack>
            )}

            {/* Category & Party */}
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
              <TextField
                select
                label="Category (Optional)"
                size="small"
                fullWidth
                value={defaultCategoryId}
                onChange={(e) => setDefaultCategoryId(e.target.value)}
              >
                <MenuItem value="">None</MenuItem>
                {categories.map((c) => (
                  <MenuItem key={c.id} value={String(c.id)}>
                    {c.name}
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                select
                label="Party"
                size="small"
                fullWidth
                value={defaultPartyId}
                onChange={(e) => setDefaultPartyId(e.target.value)}
              >
                <MenuItem value="">Auto (Self)</MenuItem>
                {parties.map((p) => (
                  <MenuItem key={p.id} value={String(p.id)}>
                    {p.name}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>

            {/* Cadence & 1-Tap Toggle */}
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1.5}
              alignItems={{ sm: "center" }}
              justifyContent="space-between"
            >
              <TextField
                select
                label="Expected Cadence"
                size="small"
                fullWidth
                value={expectedCadence}
                onChange={(e) => setExpectedCadence(e.target.value)}
              >
                {CADENCE_OPTIONS.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </MenuItem>
                ))}
              </TextField>

              <FormControlLabel
                sx={{ minWidth: { sm: 210 }, mx: 0 }}
                control={
                  <Switch
                    checked={oneTapSubmit}
                    onChange={(e) => setOneTapSubmit(e.target.checked)}
                    color="primary"
                  />
                }
                label={
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    1-Tap Instant Submit
                  </Typography>
                }
              />
            </Stack>
          </Stack>
        </DialogContent>

        <DialogActions
          sx={{
            p: 2,
            borderTop: "1px solid #E2E8F0",
            justifyContent: "flex-end",
            gap: 1,
          }}
        >
          <Button onClick={closePromoteCardDialog} color="inherit" disabled={promoteMutation.isPending}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={promoteMutation.isPending || (Boolean(matchingExistingCard) && !allowDuplicate)}
            sx={{ fontWeight: 800, px: 3 }}
          >
            {promoteMutation.isPending ? "Saving..." : "Save Action Card"}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
