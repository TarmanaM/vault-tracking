"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  RadioGroup,
  FormControlLabel,
  Radio,
  Typography,
  Stack,
  Box,
} from "@mui/material";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import { useLedgerStore } from "@/store/useLedgerStore";

export default function ExportModal() {
  const { exportDialog, closeExportDialog } = useLedgerStore();
  const [exportFormat, setExportFormat] = useState("journal_csv");

  const handleDownload = () => {
    const url = `/api/export?format=${exportFormat}`;
    window.open(url, "_blank");
    closeExportDialog();
  };

  return (
    <Dialog open={exportDialog.open} onClose={closeExportDialog} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 800 }}>Export General Ledger</DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Choose the export format compatible with standard accounting software, spreadsheets, and human review:
        </Typography>

        <RadioGroup value={exportFormat} onChange={(e) => setExportFormat(e.target.value)}>
          <Box sx={{ p: 1.5, border: "1px solid #E2E8F0", borderRadius: 2, mb: 1.5 }}>
            <FormControlLabel
              value="journal_csv"
              control={<Radio />}
              label={
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    Standard Double-Entry Journal (.CSV)
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Balanced Debits &amp; Credits with COA codes (1xxx-6xxx) for accountants.
                  </Typography>
                </Box>
              }
            />
          </Box>

          <Box sx={{ p: 1.5, border: "1px solid #E2E8F0", borderRadius: 2 }}>
            <FormControlLabel
              value="flat_csv"
              control={<Radio />}
              label={
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    Single-Row Flat Ledger (.CSV)
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Human-readable spreadsheet format matching your original Excel columns.
                  </Typography>
                </Box>
              }
            />
          </Box>
        </RadioGroup>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={closeExportDialog} color="inherit">
          Cancel
        </Button>
        <Button variant="contained" onClick={handleDownload} startIcon={<FileDownloadIcon />}>
          Download File
        </Button>
      </DialogActions>
    </Dialog>
  );
}

