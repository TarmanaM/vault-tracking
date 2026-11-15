"use client";

import React from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Stack,
  Button,
  TextField,
  MenuItem,
  Grid,
  Chip,
  IconButton,
  Popover,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Divider,
} from "@mui/material";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import ArchiveOutlinedIcon from "@mui/icons-material/ArchiveOutlined";
import RestoreFromTrashOutlinedIcon from "@mui/icons-material/RestoreFromTrashOutlined";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";

export default function PersonalCategoriesPanel({
  layerInfoAnchor,
  setLayerInfoAnchor,
  handleCreateCustomCategory,
  newName,
  setNewName,
  newNature,
  setNewNature,
  newLayer,
  setNewLayer,
  creatingCategory,
  spendingLayers,
  catsLoading,
  expenseCategories,
  incomeCategories,
  availableTemplates,
  handleEnableTemplate,
  openEditDialog,
  handleToggleArchive,
  handleDeleteCategory,
  editTarget,
  setEditTarget,
  editName,
  setEditName,
  editLayer,
  setEditLayer,
  savingEdit,
  handleSaveEdit,
}) {
  return (
    <>
      <Card elevation={0} sx={{ borderRadius: 3, border: "1px solid #E2E8F0" }}>
        <CardContent sx={{ p: { xs: 2.5, sm: 3 } }}>
          <Stack spacing={2.5}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="subtitle1" sx={{ fontWeight: 800, color: "#0F172A" }}>
                  Categories &amp; Spending Layers
                </Typography>
                <IconButton
                  size="small"
                  onClick={(e) => setLayerInfoAnchor(e.currentTarget)}
                  aria-label="Spending layer explanation"
                >
                  <InfoOutlinedIcon fontSize="small" />
                </IconButton>
              </Stack>
              <Typography variant="caption" sx={{ color: "#64748B", fontWeight: 600 }}>
                Select &ldquo;Type → Category&rdquo; when logging transactions
              </Typography>
            </Stack>

            <Box
              component="form"
              onSubmit={handleCreateCustomCategory}
              sx={{
                p: 2,
                borderRadius: 2.5,
                bgcolor: "#F8FAFC",
                border: "1px solid #E2E8F0",
              }}
            >
              <Typography variant="caption" sx={{ fontWeight: 800, color: "#475569", display: "block", mb: 1.25 }}>
                CREATE CUSTOM CATEGORY
              </Typography>
              <Grid container spacing={1.5} alignItems="center">
                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextField
                    size="small"
                    label="Category Name"
                    placeholder="e.g., Pet Care, Music Lessons"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    fullWidth
                    disabled={creatingCategory}
                  />
                </Grid>
                <Grid size={{ xs: 6, sm: 2.5 }}>
                  <TextField
                    select
                    size="small"
                    label="Type"
                    value={newNature}
                    onChange={(e) => setNewNature(e.target.value)}
                    fullWidth
                    disabled={creatingCategory}
                  >
                    <MenuItem value="EXPENSE">Expense</MenuItem>
                    <MenuItem value="INCOME">Income</MenuItem>
                  </TextField>
                </Grid>
                <Grid size={{ xs: 6, sm: 3.5 }}>
                  {newNature === "EXPENSE" ? (
                    <TextField
                      select
                      size="small"
                      label="Spending Layer"
                      value={newLayer}
                      onChange={(e) => setNewLayer(e.target.value)}
                      fullWidth
                      disabled={creatingCategory}
                    >
                      {spendingLayers.map((layer) => (
                        <MenuItem key={layer.key} value={layer.key}>
                          {layer.label}
                        </MenuItem>
                      ))}
                    </TextField>
                  ) : (
                    <TextField
                      size="small"
                      label="Spending Layer"
                      value="Income (Non-Consumption)"
                      fullWidth
                      disabled
                    />
                  )}
                </Grid>
                <Grid size={{ xs: 12, sm: 2 }}>
                  <Button
                    type="submit"
                    variant="contained"
                    fullWidth
                    disabled={creatingCategory}
                    startIcon={<AddCircleOutlineIcon />}
                    sx={{ textTransform: "none", fontWeight: 700, borderRadius: 2, height: 40 }}
                  >
                    Add
                  </Button>
                </Grid>
              </Grid>
            </Box>

            {catsLoading ? (
              <Box sx={{ py: 4, display: "flex", justifyContent: "center" }}>
                <CircularProgress size={28} />
              </Box>
            ) : (
              <Stack spacing={2.5}>
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, color: "#0F172A", mb: 1.25 }}>
                    Expense Categories ({expenseCategories.length})
                  </Typography>
                  <Grid container spacing={1.25}>
                    {expenseCategories.map((cat) => {
                      const layerMeta = cat.spendingLayerMeta;
                      const usageCount =
                        (cat._count?.transactions || 0) + (cat._count?.actionCards || 0);

                      return (
                        <Grid key={cat.id} size={{ xs: 12, sm: 6, md: 4 }}>
                          <Box
                            sx={{
                              p: 1.5,
                              borderRadius: 2,
                              border: "1px solid #E2E8F0",
                              bgcolor: cat.isActive ? "#FFFFFF" : "#F8FAFC",
                              opacity: cat.isActive ? 1 : 0.68,
                            }}
                          >
                            <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                              <Box sx={{ minWidth: 0 }}>
                                <Typography variant="body2" sx={{ fontWeight: 700, color: "#0F172A" }} noWrap>
                                  {cat.name}
                                </Typography>
                                <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.75 }} flexWrap="wrap" useFlexGap>
                                  <Chip
                                    size="small"
                                    label={layerMeta?.label || "Unassigned"}
                                    sx={{
                                      height: 20,
                                      fontSize: "0.68rem",
                                      fontWeight: 700,
                                      bgcolor: `${layerMeta?.colorHex || "#64748B"}18`,
                                      color: layerMeta?.colorHex || "#475569",
                                    }}
                                  />
                                  {cat.isSystemLocked && (
                                    <Chip
                                      size="small"
                                      label="System"
                                      sx={{ height: 20, fontSize: "0.66rem", fontWeight: 600 }}
                                    />
                                  )}
                                  {!cat.isActive && (
                                    <Chip
                                      size="small"
                                      label="Archived"
                                      color="default"
                                      sx={{ height: 20, fontSize: "0.66rem" }}
                                    />
                                  )}
                                </Stack>
                              </Box>

                              {!cat.isSystemLocked && (
                                <Stack direction="row" spacing={0.25}>
                                  <IconButton
                                    size="small"
                                    onClick={() => openEditDialog(cat)}
                                    title="Edit category"
                                  >
                                    <EditOutlinedIcon fontSize="small" />
                                  </IconButton>
                                  <IconButton
                                    size="small"
                                    onClick={() => handleToggleArchive(cat)}
                                    title={cat.isActive ? "Archive category" : "Restore category"}
                                  >
                                    {cat.isActive ? (
                                      <ArchiveOutlinedIcon fontSize="small" />
                                    ) : (
                                      <RestoreFromTrashOutlinedIcon fontSize="small" />
                                    )}
                                  </IconButton>
                                  {usageCount === 0 && (
                                    <IconButton
                                      size="small"
                                      color="error"
                                      onClick={() => handleDeleteCategory(cat)}
                                      title="Delete unused category"
                                    >
                                      <DeleteOutlineIcon fontSize="small" />
                                    </IconButton>
                                  )}
                                </Stack>
                              )}
                            </Stack>
                          </Box>
                        </Grid>
                      );
                    })}
                  </Grid>
                </Box>

                <Divider />

                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, color: "#0F172A", mb: 1.25 }}>
                    Income Categories ({incomeCategories.length})
                  </Typography>
                  <Grid container spacing={1.25}>
                    {incomeCategories.map((cat) => {
                      const usageCount =
                        (cat._count?.transactions || 0) + (cat._count?.actionCards || 0);
                      return (
                        <Grid key={cat.id} size={{ xs: 12, sm: 6, md: 4 }}>
                          <Box
                            sx={{
                              p: 1.5,
                              borderRadius: 2,
                              border: "1px solid #E2E8F0",
                              bgcolor: cat.isActive ? "#FFFFFF" : "#F8FAFC",
                              opacity: cat.isActive ? 1 : 0.68,
                            }}
                          >
                            <Stack direction="row" justifyContent="space-between" alignItems="center">
                              <Box>
                                <Typography variant="body2" sx={{ fontWeight: 700, color: "#0F172A" }}>
                                  {cat.name}
                                </Typography>
                                <Chip
                                  size="small"
                                  label="Income"
                                  sx={{
                                    mt: 0.5,
                                    height: 20,
                                    fontSize: "0.68rem",
                                    fontWeight: 700,
                                    bgcolor: "#DCFCE7",
                                    color: "#15803D",
                                  }}
                                />
                              </Box>
                              {!cat.isSystemLocked && (
                                <Stack direction="row" spacing={0.25}>
                                  <IconButton size="small" onClick={() => openEditDialog(cat)}>
                                    <EditOutlinedIcon fontSize="small" />
                                  </IconButton>
                                  <IconButton size="small" onClick={() => handleToggleArchive(cat)}>
                                    {cat.isActive ? (
                                      <ArchiveOutlinedIcon fontSize="small" />
                                    ) : (
                                      <RestoreFromTrashOutlinedIcon fontSize="small" />
                                    )}
                                  </IconButton>
                                  {usageCount === 0 && (
                                    <IconButton
                                      size="small"
                                      color="error"
                                      onClick={() => handleDeleteCategory(cat)}
                                    >
                                      <DeleteOutlineIcon fontSize="small" />
                                    </IconButton>
                                  )}
                                </Stack>
                              )}
                            </Stack>
                          </Box>
                        </Grid>
                      );
                    })}
                  </Grid>
                </Box>

                {availableTemplates.length > 0 && (
                  <>
                    <Divider />
                    <Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 800, color: "#0F172A", mb: 0.5 }}>
                        Optional Category Templates ({availableTemplates.length})
                      </Typography>
                      <Typography variant="caption" sx={{ color: "#64748B", display: "block", mb: 1.25 }}>
                        Tap any template below to add it to your active categories with pre-configured
                        accounting rules.
                      </Typography>
                      <Stack direction="row" flexWrap="wrap" gap={1}>
                        {availableTemplates.map((tpl) => (
                          <Chip
                            key={tpl.code}
                            label={`+ ${tpl.name}`}
                            clickable
                            onClick={() => handleEnableTemplate(tpl)}
                            variant="outlined"
                            sx={{ fontWeight: 600, bgcolor: "#F8FAFC" }}
                          />
                        ))}
                      </Stack>
                    </Box>
                  </>
                )}
              </Stack>
            )}
          </Stack>
        </CardContent>
      </Card>

      <Dialog open={Boolean(editTarget)} onClose={() => setEditTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Edit Category</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label="Category Name"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              fullWidth
            />
            {editTarget?.defaultNature === "EXPENSE" && (
              <TextField
                select
                label="Spending Layer"
                value={editLayer}
                onChange={(e) => setEditLayer(e.target.value)}
                fullWidth
              >
                {spendingLayers.map((layer) => (
                  <MenuItem key={layer.key} value={layer.key}>
                    {layer.label}
                  </MenuItem>
                ))}
              </TextField>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setEditTarget(null)} color="inherit" sx={{ textTransform: "none" }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveEdit}
            disabled={savingEdit || !editName.trim()}
            sx={{ textTransform: "none", fontWeight: 700 }}
          >
            {savingEdit ? "Saving..." : "Save Changes"}
          </Button>
        </DialogActions>
      </Dialog>

      <Popover
        open={Boolean(layerInfoAnchor)}
        anchorEl={layerInfoAnchor}
        onClose={() => setLayerInfoAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
      >
        <Box sx={{ p: 2, maxWidth: 360 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>
            How Categories &amp; Spending Layers Work
          </Typography>
          <Stack spacing={1}>
            {spendingLayers.map((layer) => (
              <Box key={layer.key}>
                <Typography variant="caption" sx={{ fontWeight: 800, color: layer.colorHex }}>
                  {layer.label}
                </Typography>
                <Typography variant="caption" sx={{ color: "#475569", display: "block" }}>
                  {layer.description}
                </Typography>
              </Box>
            ))}
            <Typography variant="caption" sx={{ color: "#64748B", pt: 0.5 }}>
              When recording a transaction, simply pick Type → Category. Priority tiers and
              double-entry Chart of Accounts codes are derived automatically for journal exports.
            </Typography>
          </Stack>
        </Box>
      </Popover>
    </>
  );
}
