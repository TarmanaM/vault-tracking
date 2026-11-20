"use client";

import React from "react";
import {
  Box,
  Stack,
  Typography,
  RadioGroup,
  FormControlLabel,
  Radio,
  TextField,
  MenuItem,
  Button,
  Autocomplete,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from "@mui/material";
import PersonAddAlt1OutlinedIcon from "@mui/icons-material/PersonAddAlt1Outlined";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import TuneOutlinedIcon from "@mui/icons-material/TuneOutlined";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { TimePicker } from "@mui/x-date-pickers/TimePicker";
import dayjs from "dayjs";
import CurrencyTextField from "@/components/common/CurrencyTextField";
import { formatNativeMoney } from "@/shared/currencyHelpers";

export default function TransactionDebtAndOptionsSection({
  isDebtNature,
  nature,
  payableMode,
  setPayableMode,
  partyId,
  setPartyId,
  setReferenceDebtId,
  partyList,
  openAddPartyDialog,
  isSettlementNature,
  referenceDebtId,
  openItemsForSettlement,
  baseUpper,
  savedExternalAccounts,
  counterpartyAccountNote,
  setCounterpartyAccountNote,
  dateValue,
  setDateValue,
  timeValue,
  setTimeValue,
  retroactiveAlert,
  moreExpanded,
  setMoreExpanded,
  isForeignEntry,
  entryCurrency,
  cachedFxRate,
  manualFxRate,
  setManualFxRate,
  taxFeeAmount,
  setTaxFeeAmount,
  notes,
  setNotes,
}) {
  return (
    <>
      {isDebtNature && (
        <Box
          sx={{
            p: 1.5,
            borderRadius: 2,
            bgcolor: "#FFFBEB",
            border: "1px solid #FDE68A",
            display: "flex",
            flexDirection: "column",
            gap: 1.5,
          }}
        >
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
              const nowDt = dayjs();
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
    </>
  );
}
