"use client";

import React, { useState } from "react";
import {
  Container,
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  Stack,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Divider,
} from "@mui/material";
import VolunteerActivismIcon from "@mui/icons-material/VolunteerActivism";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatRupiah } from "@/lib/money";
import { useLedgerStore } from "@/store/useLedgerStore";

export default function DebtsPage() {
  const queryClient = useQueryClient();
  const openTransactionDialog = useLedgerStore((s) => s.openTransactionDialog);

  const [writeOffModal, setWriteOffModal] = useState({ open: false, debtEntry: null, partyName: "" });

  const { data, isLoading } = useQuery({
    queryKey: ["debts"],
    queryFn: async () => {
      const res = await fetch("/api/debts");
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
  });

  const writeOffMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await fetch("/api/debt/write-off", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const resJson = await res.json();
      if (!resJson.success) throw new Error(resJson.error);
      return resJson.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["debts"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setWriteOffModal({ open: false, debtEntry: null, partyName: "" });
      alert("Receivable forgiven & converted to Charity expense!");
    },
    onError: (err) => {
      alert(`Error writing off debt: ${err.message}`);
    },
  });

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
        <CircularProgress />
      </Box>
    );
  }

  const { summary, parties = [] } = data || {};

  return (
    <Container maxWidth="lg" sx={{ py: 2 }}>
      {/* Title */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 800, color: "#0F172A", mb: 0.5 }}>
          Debt, Loans &amp; PayLater Sub-Ledger
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Track personal loans given to friends/family, repayments, held benefit pools, and debt forgiveness (Write-Off).
        </Typography>
      </Box>

      {/* Summary KPI Cards */}
      <Grid container spacing={2} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={4}>
          <Card sx={{ borderLeft: "4px solid #2563EB" }}>
            <CardContent sx={{ p: 2 }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                TOTAL RECEIVABLE (PIUTANG TEMAN)
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 800, color: "#2563EB", mt: 0.5 }}>
                {formatRupiah(summary?.totalReceivables)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={4}>
          <Card sx={{ borderLeft: "4px solid #EF4444" }}>
            <CardContent sx={{ p: 2 }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                TOTAL PAYABLES &amp; PAYLATER (UTANG)
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 800, color: "#EF4444", mt: 0.5 }}>
                {formatRupiah(summary?.totalPayables)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={4}>
          <Card sx={{ borderLeft: "4px solid #8B5CF6" }}>
            <CardContent sx={{ p: 2 }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                HELD BENEFIT POOL (TASPEN)
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 800, color: "#8B5CF6", mt: 0.5 }}>
                {formatRupiah(summary?.totalHeldFunds)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Parties Cards */}
      <Grid container spacing={2}>
        {parties
          .filter((p) => p.partyType !== "SELF")
          .map((party) => {
            const netRec = Number(party.netReceivableBalance) || 0;
            const openEntries = party.debtLedgerEntries?.filter((e) => e.status === "OPEN") || [];

            return (
              <Grid item xs={12} sm={6} md={4} key={party.id}>
                <Card sx={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                  <CardContent sx={{ p: 2.5 }}>
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 1.5 }}>
                      <Box>
                        <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                          {party.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {party.partyType}
                        </Typography>
                      </Box>
                      <Chip
                        label={netRec > 0 ? "Owes Isa" : netRec < 0 ? "Isa Owes" : "Settled"}
                        size="small"
                        color={netRec > 0 ? "primary" : netRec < 0 ? "error" : "default"}
                        sx={{ fontSize: "0.7rem", height: 20 }}
                      />
                    </Box>

                    <Typography variant="h6" sx={{ fontWeight: 800, color: netRec > 0 ? "#2563EB" : netRec < 0 ? "#DC2626" : "#64748B", mb: 1.5 }}>
                      {formatRupiah(Math.abs(netRec))}
                    </Typography>

                    {/* Open entries list */}
                    {openEntries.length > 0 && (
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="caption" sx={{ fontWeight: 700, color: "#475569", display: "block", mb: 0.5 }}>
                          OPEN DEBT ENTRIES:
                        </Typography>
                        <Stack spacing={0.8}>
                          {openEntries.map((e) => (
                            <Box
                              key={e.id}
                              sx={{
                                p: 1,
                                bgcolor: "#F8FAFC",
                                borderRadius: 1.5,
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                              }}
                            >
                              <Box>
                                <Typography variant="caption" sx={{ fontWeight: 700, display: "block" }}>
                                  {e.transaction?.title || "Pinjaman"}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.65rem" }}>
                                  Remaining: {formatRupiah(e.remainingOpenAmount)}
                                </Typography>
                              </Box>

                              <Button
                                size="small"
                                variant="text"
                                color="warning"
                                startIcon={<VolunteerActivismIcon sx={{ fontSize: 13 }} />}
                                onClick={() => setWriteOffModal({ open: true, debtEntry: e, partyName: party.name })}
                                sx={{ fontSize: "0.65rem", p: 0.5 }}
                              >
                                Ikhlaskan
                              </Button>
                            </Box>
                          ))}
                        </Stack>
                      </Box>
                    )}
                  </CardContent>

                  <Box sx={{ p: 2, pt: 0 }}>
                    <Stack direction="row" spacing={1}>
                      <Button
                        fullWidth
                        size="small"
                        variant="outlined"
                        onClick={() =>
                          openTransactionDialog({
                            title: `Pinjamkan ke ${party.name}`,
                            partyId: party.id,
                          })
                        }
                        sx={{ fontSize: "0.75rem" }}
                      >
                        + Talangi
                      </Button>
                      <Button
                        fullWidth
                        size="small"
                        variant="contained"
                        startIcon={<CheckCircleOutlineIcon />}
                        onClick={() =>
                          openTransactionDialog({
                            title: `${party.name} Bayar Utang`,
                            partyId: party.id,
                            grossAmount: netRec > 0 ? netRec : 0,
                          })
                        }
                        sx={{ fontSize: "0.75rem", bgcolor: "#059669" }}
                      >
                        Receive Repayment
                      </Button>
                    </Stack>
                  </Box>
                </Card>
              </Grid>
            );
          })}
      </Grid>

      {/* Forgive / Write-Off Dialog */}
      <Dialog open={writeOffModal.open} onClose={() => setWriteOffModal({ open: false, debtEntry: null, partyName: "" })}>
        <DialogTitle sx={{ fontWeight: 800 }}>Forgive / Write-Off Debt?</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Are you sure you want to forgive the debt from <strong>{writeOffModal.partyName}</strong> for the amount of{" "}
            <strong>{formatRupiah(writeOffModal.debtEntry?.remainingOpenAmount || 0)}</strong>?
          </Typography>
          <Typography variant="caption" color="text.secondary">
            This will close the receivable to Rp 0 and convert it into a <strong>Social &amp; Charity (Sedekah)</strong> expense in your consumption ledger.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setWriteOffModal({ open: false, debtEntry: null, partyName: "" })} color="inherit">
            Cancel
          </Button>
          <Button
            variant="contained"
            color="success"
            startIcon={<VolunteerActivismIcon />}
            disabled={writeOffMutation.isPending}
            onClick={() => writeOffMutation.mutate({ debtEntryId: writeOffModal.debtEntry?.id })}
          >
            {writeOffMutation.isPending ? "Forgiving..." : "Yes, Ikhlaskan (Sedekah)"}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

