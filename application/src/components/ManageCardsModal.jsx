"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Tabs,
  Tab,
  Box,
  Stack,
  TextField,
  MenuItem,
  Typography,
  Paper,
  Chip,
  IconButton,
  Alert,
  Popover,
} from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import RestoreIcon from "@mui/icons-material/Restore";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffOutlinedIcon from "@mui/icons-material/VisibilityOffOutlined";
import ArchiveOutlinedIcon from "@mui/icons-material/ArchiveOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLedgerStore } from "@/store/useLedgerStore";
import CurrencyTextField from "@/components/CurrencyTextField";
import MoneyValue from "@/components/MoneyValue";

const CARD_TYPES = [
  { value: "EXPENSE", label: "Expense" },
  { value: "TRANSFER", label: "Vault Transfer" },
  { value: "INCOME", label: "Income / Top Up" },
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

export default function ManageCardsModal({ vaults = [], categories = [], parties = [] }) {
  const { manageCardsDialog, closeManageCardsDialog, enqueueToast } = useLedgerStore();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState(0);
  const [editingCardId, setEditingCardId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editVaultId, setEditVaultId] = useState("");
  const [editSubId, setEditSubId] = useState("");

  // New Card form state
  const [newTitle, setNewTitle] = useState("");
  const [newType, setNewType] = useState("EXPENSE");
  const [newVaultId, setNewVaultId] = useState("");
  const [newSubId, setNewSubId] = useState("");
  const [newTargetVaultId, setNewTargetVaultId] = useState("");
  const [newTargetSubId, setNewTargetSubId] = useState("");
  const [newCategoryId, setNewCategoryId] = useState("");
  const [newPartyId, setNewPartyId] = useState("");
  const [newDefaultAmount, setNewDefaultAmount] = useState("");
  const [newQuickAmounts, setNewQuickAmounts] = useState("");
  const [newCadence, setNewCadence] = useState("ON_DEMAND");
  const [errorMsg, setErrorMsg] = useState("");
  const [infoAnchor, setInfoAnchor] = useState(null);

  const { data: allCards = [] } = useQuery({
    queryKey: ["cards"],
    queryFn: async () => {
      const res = await fetch("/api/cards");
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data || [];
    },
    enabled: manageCardsDialog.open,
  });

  const patchCardMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await fetch("/api/cards", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["cards"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setEditingCardId(null);
      enqueueToast(`Updated card "${updated.title}"`, { severity: "success" });
    },
    onError: (err) => {
      enqueueToast(err.message, { severity: "error" });
    },
  });

  const createCardMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await fetch("/api/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["cards"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      enqueueToast(`Created card "${created.title}"`, { severity: "success" });
      setNewTitle("");
      setNewDefaultAmount("");
      setNewQuickAmounts("");
      setNewTargetSubId("");
      setErrorMsg("");
      setTab(0);
    },
    onError: (err) => {
      setErrorMsg(err.message);
    },
  });

  const startEdit = (card) => {
    setEditingCardId(card.id);
    setEditTitle(card.title || "");
    setEditAmount(card.defaultAmount ? Number(card.defaultAmount) : "");
    setEditVaultId(card.defaultVaultId || "");
    setEditSubId(card.defaultSubContainerId || "");
  };

  const handleSaveEdit = (cardId) => {
    if (!editTitle.trim()) return;
    patchCardMutation.mutate({
      id: cardId,
      title: editTitle.trim(),
      defaultAmount: editAmount === "" ? 0 : Number(editAmount),
      defaultVaultId: editVaultId || null,
      defaultSubContainerId: editSubId || null,
    });
  };

  const handleCreateSubmit = (e) => {
    e.preventDefault();
    setErrorMsg("");
    if (!newTitle.trim()) {
      setErrorMsg("Card title is required.");
      return;
    }
    const parsedQuick = newQuickAmounts
      .split(",")
      .map((s) => Number(s.replace(/[^0-9]/g, "")))
      .filter((n) => n > 0);

    createCardMutation.mutate({
      title: newTitle.trim(),
      cardActionType: newType,
      defaultVaultId: newVaultId || null,
      defaultSubContainerId: newSubId || null,
      targetVaultId: newType === "TRANSFER" ? newTargetVaultId || null : null,
      targetSubContainerId: newType === "TRANSFER" ? newTargetSubId || null : null,
      defaultCategoryId: newCategoryId || null,
      defaultPartyId: newPartyId || null,
      defaultAmount: newDefaultAmount === "" ? 0 : Number(newDefaultAmount),
      quickAmounts: parsedQuick,
      expectedCadence: newCadence,
    });
  };

  const visibleOrSoftHidden = allCards.filter((c) => c.visibilityMode !== "ARCHIVED");
  const archivedList = allCards.filter((c) => c.visibilityMode === "ARCHIVED");

  return (
    <Dialog open={manageCardsDialog.open} onClose={closeManageCardsDialog} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "space-between", pb: 1 }}>
        <span>Manage Action Cards</span>
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
        <Typography variant="caption" sx={{ p: 1.5, display: "block", maxWidth: 280 }}>
          • Active cards appear in your Recommended strip.<br />
          • Soft-Hidden cards stay searchable in the All Cards tab.<br />
          • Archived cards are hidden everywhere until restored here.
        </Typography>
      </Popover>

      <Box sx={{ borderBottom: 1, borderColor: "divider", px: 2 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto">
          <Tab label={`Active / Soft Hidden (${visibleOrSoftHidden.length})`} />
          <Tab label={`Archived (${archivedList.length})`} />
          <Tab label="+ Create New Card" icon={<AddCircleOutlineIcon fontSize="small" />} iconPosition="start" />
        </Tabs>
      </Box>

      <DialogContent dividers sx={{ minHeight: 340 }}>
        {tab === 0 && (
          <Stack spacing={1.25}>
            {visibleOrSoftHidden.map((card) => {
              const isEditing = editingCardId === card.id;
              return (
                <Paper key={card.id} variant="outlined" sx={{ p: 1.5 }}>
                  {isEditing ? (
                    <Stack spacing={1.5}>
                      <TextField
                        label="Card Title"
                        size="small"
                        fullWidth
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                      />
                      <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                        <CurrencyTextField
                          label="Default Amount"
                          value={editAmount}
                          onValueChange={(num) => setEditAmount(num)}
                        />
                        <TextField
                          select
                          label="Default Vault"
                          size="small"
                          fullWidth
                          value={editVaultId}
                          onChange={(e) => {
                            setEditVaultId(e.target.value);
                            setEditSubId("");
                          }}
                        >
                          <MenuItem value="">None</MenuItem>
                          {vaults.map((v) => (
                            <MenuItem key={v.id} value={v.id}>
                              {v.name}
                            </MenuItem>
                          ))}
                        </TextField>

                        {(vaults.find((v) => v.id === Number(editVaultId))?.subContainers || []).length > 0 && (
                          <TextField
                            select
                            label="Default Sub-Vault (Optional)"
                            size="small"
                            fullWidth
                            value={editSubId}
                            onChange={(e) => setEditSubId(e.target.value)}
                          >
                            <MenuItem value="">Auto (Vault Default)</MenuItem>
                            {(vaults.find((v) => v.id === Number(editVaultId))?.subContainers || []).map((sc) => (
                              <MenuItem key={sc.id} value={sc.id}>
                                {sc.name} ({sc.currency})
                              </MenuItem>
                            ))}
                          </TextField>
                        )}
                      </Stack>
                      <Stack direction="row" spacing={1} justifyContent="flex-end">
                        <Button size="small" color="inherit" onClick={() => setEditingCardId(null)}>
                          Cancel
                        </Button>
                        <Button
                          size="small"
                          variant="contained"
                          onClick={() => handleSaveEdit(card.id)}
                          disabled={patchCardMutation.isPending}
                        >
                          Save Changes
                        </Button>
                      </Stack>
                    </Stack>
                  ) : (
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                      <Box>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>
                            {card.title}
                          </Typography>
                          <Chip
                            size="small"
                            label={card.visibilityMode === "SOFT_HIDDEN" ? "Soft Hidden" : "Active"}
                            color={card.visibilityMode === "SOFT_HIDDEN" ? "warning" : "success"}
                            variant="outlined"
                            sx={{ height: 20, fontSize: "0.65rem" }}
                          />
                        </Stack>
                        <Typography variant="caption" color="text.secondary">
                          {card.defaultVault?.name || "Any Vault"} • Default:{" "}
                          {Number(card.defaultAmount || 0) > 0 ? <MoneyValue value={card.defaultAmount} /> : "Manual"}
                        </Typography>
                      </Box>

                      <Stack direction="row" spacing={0.5}>
                        <IconButton size="small" onClick={() => startEdit(card)} title="Edit card">
                          <EditOutlinedIcon fontSize="small" />
                        </IconButton>
                        {card.visibilityMode === "SOFT_HIDDEN" ? (
                          <IconButton
                            size="small"
                            color="primary"
                            title="Unhide to Recommended"
                            onClick={() => patchCardMutation.mutate({ id: card.id, visibilityMode: "ACTIVE" })}
                          >
                            <VisibilityIcon fontSize="small" />
                          </IconButton>
                        ) : (
                          <IconButton
                            size="small"
                            color="warning"
                            title="Soft-Hide (keep searchable)"
                            onClick={() => patchCardMutation.mutate({ id: card.id, visibilityMode: "SOFT_HIDDEN" })}
                          >
                            <VisibilityOffOutlinedIcon fontSize="small" />
                          </IconButton>
                        )}
                        <IconButton
                          size="small"
                          color="error"
                          title="Archive completely"
                          onClick={() => patchCardMutation.mutate({ id: card.id, visibilityMode: "ARCHIVED" })}
                        >
                          <ArchiveOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                    </Box>
                  )}
                </Paper>
              );
            })}
          </Stack>
        )}

        {tab === 1 && (
          <Stack spacing={1.25}>
            {archivedList.length === 0 ? (
              <Alert severity="info">No archived Action Cards.</Alert>
            ) : (
              archivedList.map((card) => (
                <Paper key={card.id} variant="outlined" sx={{ p: 1.5, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      {card.title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {card.cardActionType} • Used {card.habitStats?.totalUses || 0} times
                    </Typography>
                  </Box>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<RestoreIcon />}
                    onClick={() => patchCardMutation.mutate({ id: card.id, visibilityMode: "ACTIVE" })}
                  >
                    Restore
                  </Button>
                </Paper>
              ))
            )}
          </Stack>
        )}

        {tab === 2 && (
          <Box component="form" onSubmit={handleCreateSubmit}>
            <Stack spacing={2}>
              {errorMsg && <Alert severity="error">{errorMsg}</Alert>}
              <TextField
                label="Action Card Title"
                placeholder='e.g. "Beli Air Galon", "Parkir Stasiun"'
                size="small"
                fullWidth
                required
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
              />

              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                <TextField
                  select
                  label="Card Action Type"
                  size="small"
                  fullWidth
                  value={newType}
                  onChange={(e) => setNewType(e.target.value)}
                >
                  {CARD_TYPES.map((t) => (
                    <MenuItem key={t.value} value={t.value}>
                      {t.label}
                    </MenuItem>
                  ))}
                </TextField>

                <TextField
                  select
                  label="Expected Cadence"
                  size="small"
                  fullWidth
                  value={newCadence}
                  onChange={(e) => setNewCadence(e.target.value)}
                >
                  {CADENCE_OPTIONS.map((c) => (
                    <MenuItem key={c.value} value={c.value}>
                      {c.label}
                    </MenuItem>
                  ))}
                </TextField>
              </Stack>

              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                <TextField
                  select
                  label={newType === "INCOME" ? "Destination Vault" : "Default Vault"}
                  size="small"
                  fullWidth
                  value={newVaultId}
                  onChange={(e) => {
                    setNewVaultId(e.target.value);
                    setNewSubId("");
                  }}
                >
                  <MenuItem value="">Select per tap</MenuItem>
                  {vaults.map((v) => (
                    <MenuItem key={v.id} value={v.id}>
                      {v.name}
                    </MenuItem>
                  ))}
                </TextField>

                {(vaults.find((v) => v.id === Number(newVaultId))?.subContainers || []).length > 0 && (
                  <TextField
                    select
                    label="Default Sub-Vault (Optional)"
                    size="small"
                    fullWidth
                    value={newSubId}
                    onChange={(e) => setNewSubId(e.target.value)}
                  >
                    <MenuItem value="">Auto (Vault Default)</MenuItem>
                    {(vaults.find((v) => v.id === Number(newVaultId))?.subContainers || []).map((sc) => (
                      <MenuItem key={sc.id} value={sc.id}>
                        {sc.name} ({sc.currency})
                      </MenuItem>
                    ))}
                  </TextField>
                )}

                {newType === "TRANSFER" && (
                  <>
                    <TextField
                      select
                      label="Target Vault"
                      size="small"
                      fullWidth
                      value={newTargetVaultId}
                      onChange={(e) => {
                        setNewTargetVaultId(e.target.value);
                        setNewTargetSubId("");
                      }}
                    >
                      <MenuItem value="">Select target</MenuItem>
                      {vaults.map((v) => (
                        <MenuItem key={v.id} value={v.id}>
                          {v.name}
                        </MenuItem>
                      ))}
                    </TextField>

                    {(vaults.find((v) => v.id === Number(newTargetVaultId))?.subContainers || []).length > 0 && (
                      <TextField
                        select
                        label="Target Sub-Vault (Optional)"
                        size="small"
                        fullWidth
                        value={newTargetSubId}
                        onChange={(e) => setNewTargetSubId(e.target.value)}
                      >
                        <MenuItem value="">Auto (Vault Default)</MenuItem>
                        {(vaults.find((v) => v.id === Number(newTargetVaultId))?.subContainers || []).map((sc) => (
                          <MenuItem key={sc.id} value={sc.id}>
                            {sc.name} ({sc.currency})
                          </MenuItem>
                        ))}
                      </TextField>
                    )}
                  </>
                )}
              </Stack>

              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                <TextField
                  select
                  label="Default Category"
                  size="small"
                  fullWidth
                  value={newCategoryId}
                  onChange={(e) => setNewCategoryId(e.target.value)}
                >
                  <MenuItem value="">Default</MenuItem>
                  {categories.map((cat) => (
                    <MenuItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </MenuItem>
                  ))}
                </TextField>

                <TextField
                  select
                  label="Default Party / Person"
                  size="small"
                  fullWidth
                  value={newPartyId}
                  onChange={(e) => setNewPartyId(e.target.value)}
                >
                  <MenuItem value="">Self (Personal)</MenuItem>
                  {parties
                    .filter((p) => p.code !== "SELF" && p.partyType !== "SELF")
                    .map((p) => (
                      <MenuItem key={p.id} value={p.id}>
                        {p.name}
                      </MenuItem>
                    ))}
                </TextField>
              </Stack>

              <CurrencyTextField
                label="Default Amount (Optional)"
                value={newDefaultAmount}
                onValueChange={(num) => setNewDefaultAmount(num)}
                helperText="Leave blank for manual-entry cards."
              />

              <TextField
                label="Quick Amount Pills (comma-separated, optional)"
                placeholder="e.g. 5000, 10000, 20000"
                size="small"
                fullWidth
                value={newQuickAmounts}
                onChange={(e) => setNewQuickAmounts(e.target.value)}
              />

              <Button type="submit" variant="contained" disabled={createCardMutation.isPending}>
                {createCardMutation.isPending ? "Creating..." : "Create Smart Action Card"}
              </Button>
            </Stack>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        <Button onClick={closeManageCardsDialog} color="inherit">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}

