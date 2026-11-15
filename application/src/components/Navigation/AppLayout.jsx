"use client";

import React, { useEffect, useState } from "react";
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  BottomNavigation,
  BottomNavigationAction,
  Paper,
  Stack,
  Chip,
  CircularProgress,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import FlashOnIcon from "@mui/icons-material/FlashOn";
import ShowChartIcon from "@mui/icons-material/ShowChart";
import AccountBalanceIcon from "@mui/icons-material/AccountBalance";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import PeopleAltOutlinedIcon from "@mui/icons-material/PeopleAltOutlined";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import AdminPanelSettingsOutlinedIcon from "@mui/icons-material/AdminPanelSettingsOutlined";
import LogoutOutlinedIcon from "@mui/icons-material/LogoutOutlined";
import SyncAltIcon from "@mui/icons-material/SyncAlt";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import VisibilityOffOutlinedIcon from "@mui/icons-material/VisibilityOffOutlined";
import CurrencyExchangeIcon from "@mui/icons-material/CurrencyExchange";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import CloseIcon from "@mui/icons-material/Close";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Tooltip } from "@mui/material";
import { useLedgerStore } from "@/store/useLedgerStore";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import MoneyValue from "@/components/MoneyValue";
import ToastProvider from "@/components/ToastProvider";
import ReconcileModal from "@/components/ReconcileModal";
import ExportModal from "@/components/ExportModal";
import AddPartyModal from "@/components/AddPartyModal";
import ManageCardsModal from "@/components/ManageCardsModal";
import PromoteToCardModal from "@/components/PromoteToCardModal";
import CardSuggestionModal from "@/components/CardSuggestionModal";
import CustomTransactionModal from "@/components/CustomTransactionModal";
import AutoChartDrawer from "@/components/AutoChartDrawer";
import VaultProfileModal from "@/components/VaultProfileModal";
import SubVaultSyncModal from "@/components/SubVaultSyncModal";
import FxSettingsModal from "@/components/FxSettingsModal";

const DRAWER_WIDTH = 260;

const baseNavItems = [
  { label: "Quick Actions", path: "/", icon: <FlashOnIcon /> },
  { label: "Wealth Journey", path: "/analytics", icon: <ShowChartIcon /> },
  { label: "Vaults & Checkpoint", path: "/checkpoints", icon: <AccountBalanceIcon /> },
  { label: "Ledger History", path: "/ledger", icon: <ReceiptLongIcon /> },
  { label: "Debt & PayLater", path: "/debts", icon: <PeopleAltOutlinedIcon /> },
  { label: "Settings & Personalize", path: "/settings", icon: <SettingsOutlinedIcon /> },
];

export default function AppLayout({ children }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();

  const isPublicAuthRoute = pathname === "/login";
  const isAuthFlowRoute =
    pathname === "/login" || pathname === "/force-password-change" || pathname === "/onboarding";

  // Desktop sidebar collapse state
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [desktopDrawerOpen, setDesktopDrawerOpen] = useState(true);

  const openReconcileDialog = useLedgerStore((s) => s.openReconcileDialog);
  const openExportDialog = useLedgerStore((s) => s.openExportDialog);
  const openFxSettingsDialog = useLedgerStore((s) => s.openFxSettingsDialog);
  const openVaultProfileDialog = useLedgerStore((s) => s.openVaultProfileDialog);
  const isCompactNumbers = useLedgerStore((s) => s.isCompactNumbers);
  const toggleCompactNumbers = useLedgerStore((s) => s.toggleCompactNumbers);
  const isPrivacyHidden = useLedgerStore((s) => s.isPrivacyHidden);
  const togglePrivacyHidden = useLedgerStore((s) => s.togglePrivacyHidden);

  const {
    data: authData,
    isLoading: authLoading,
    isError: authError,
  } = useQuery({
    queryKey: ["auth-me"],
    enabled: !isPublicAuthRoute,
    retry: false,
    staleTime: 10000,
    queryFn: async () => {
      const res = await fetch("/api/auth/me");
      if (!res.ok) {
        const err = new Error("Unauthorized");
        err.status = res.status;
        throw err;
      }
      const json = await res.json();
      return json.data;
    },
  });

  const authUser = authData?.user || null;

  useEffect(() => {
    if (isPublicAuthRoute || authLoading) return;

    if (authError || !authUser) {
      router.replace("/login");
      return;
    }

    if (authUser.mustChangePassword) {
      if (pathname !== "/force-password-change") {
        router.replace("/force-password-change");
      }
      return;
    }

    if (pathname === "/force-password-change") {
      router.replace(
        authUser.onboardingCompleted || authUser.onboardingSkipped ? "/" : "/onboarding"
      );
      return;
    }

    if (!authUser.onboardingCompleted && !authUser.onboardingSkipped) {
      if (pathname !== "/onboarding") {
        router.replace("/onboarding");
      }
    }
  }, [isPublicAuthRoute, authLoading, authError, authUser, pathname, router]);

  const canLoadDashboard = Boolean(
    authUser &&
      !authUser.mustChangePassword &&
      !isAuthFlowRoute &&
      (authUser.onboardingCompleted || authUser.onboardingSkipped)
  );

  // Fetch quick net wealth & app settings for top header badge and global modals
  const { data } = useQuery({
    queryKey: ["dashboard"],
    enabled: canLoadDashboard,
    queryFn: async () => {
      const res = await fetch("/api/dashboard");
      const json = await res.json();
      return json.data;
    },
    staleTime: 1000 * 60,
  });

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    await queryClient.clear();
    router.replace("/login");
  };

  if (isAuthFlowRoute) {
    if (
      !isPublicAuthRoute &&
      (authLoading ||
        authError ||
        !authUser ||
        (authUser.mustChangePassword && pathname !== "/force-password-change") ||
        (!authUser.mustChangePassword && pathname === "/force-password-change"))
    ) {
      return (
        <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <CircularProgress />
        </Box>
      );
    }

    return (
      <>
        <ToastProvider />
        {children}
      </>
    );
  }

  if (!canLoadDashboard) {
    return (
      <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <CircularProgress />
      </Box>
    );
  }

  const navItems =
    authUser?.role === "ADMIN"
      ? [
          ...baseNavItems,
          { label: "Admin Users", path: "/admin", icon: <AdminPanelSettingsOutlinedIcon /> },
        ]
      : baseNavItems;

  const netWealth = data?.summary?.netTotalWealth;
  const baseCurrency = data?.appSettings?.baseCurrency || authData?.baseCurrency || "IDR";

  const drawerContent = (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {/* Drawer Brand + Active Account Metadata */}
      <Box sx={{ p: 2, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: 2,
              bgcolor: "#2563EB",
              color: "#FFFFFF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 800,
              fontSize: "1.1rem",
            }}
          >
            V
          </Box>
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, lineHeight: 1.1 }}>
              Vault Tracking
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {authUser.fullName} • {authUser.role === "ADMIN" ? "Admin" : "Personal"} ({baseCurrency})
            </Typography>
          </Box>
        </Stack>

        {isMobile ? (
          <IconButton size="small" onClick={() => setMobileDrawerOpen(false)} aria-label="Close sidebar">
            <CloseIcon fontSize="small" />
          </IconButton>
        ) : (
          <IconButton size="small" onClick={() => setDesktopDrawerOpen(false)}>
            <ChevronLeftIcon />
          </IconButton>
        )}
      </Box>

      <Divider />

      {/* Main Navigation Links */}
      <List sx={{ px: 1.5, py: 2, flexGrow: 1 }}>
        {navItems.map((item) => {
          const isActive =
            item.path === "/"
              ? pathname === "/"
              : pathname === item.path || pathname.startsWith(`${item.path}/`);
          return (
            <ListItem key={item.path} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                component={Link}
                href={item.path}
                onClick={() => isMobile && setMobileDrawerOpen(false)}
                sx={{
                  borderRadius: 2,
                  bgcolor: isActive ? "#EFF6FF" : "transparent",
                  color: isActive ? "#2563EB" : "#334155",
                  fontWeight: isActive ? 700 : 500,
                  "&:hover": { bgcolor: isActive ? "#DBEAFE" : "#F1F5F9" },
                }}
              >
                <ListItemIcon sx={{ minWidth: 38, color: isActive ? "#2563EB" : "#64748B" }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.label}
                  primaryTypographyProps={{ fontSize: "0.9rem", fontWeight: isActive ? 700 : 600 }}
                />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>

      <Divider />

      {/* Quick Action Tools */}
      <Box sx={{ p: 2 }}>
        <Typography variant="caption" sx={{ color: "#94A3B8", fontWeight: 700, letterSpacing: 0.5, px: 1, mb: 1, display: "block" }}>
          QUICK TOOLS
        </Typography>
        <Stack spacing={1}>
          <ListItemButton
            onClick={() => {
              if (isMobile) setMobileDrawerOpen(false);
              openVaultProfileDialog(null);
            }}
            sx={{ borderRadius: 2, bgcolor: "#F8FAFC", border: "1px solid #E2E8F0" }}
          >
            <ListItemIcon sx={{ minWidth: 32, color: "#059669" }}>
              <AddCircleOutlineIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Add New Vault" primaryTypographyProps={{ fontSize: "0.85rem", fontWeight: 600 }} />
          </ListItemButton>

          <ListItemButton
            onClick={() => {
              if (isMobile) setMobileDrawerOpen(false);
              openFxSettingsDialog();
            }}
            sx={{ borderRadius: 2, bgcolor: "#F8FAFC", border: "1px solid #E2E8F0" }}
          >
            <ListItemIcon sx={{ minWidth: 32, color: "#7C3AED" }}>
              <CurrencyExchangeIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Currency & FX" primaryTypographyProps={{ fontSize: "0.85rem", fontWeight: 600 }} />
          </ListItemButton>

          <ListItemButton
            onClick={() => {
              if (isMobile) setMobileDrawerOpen(false);
              openReconcileDialog(null);
            }}
            sx={{ borderRadius: 2, bgcolor: "#F8FAFC", border: "1px solid #E2E8F0" }}
          >
            <ListItemIcon sx={{ minWidth: 32, color: "#2563EB" }}>
              <SyncAltIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Reconcile Vault" primaryTypographyProps={{ fontSize: "0.85rem", fontWeight: 600 }} />
          </ListItemButton>

          <ListItemButton
            onClick={() => {
              if (isMobile) setMobileDrawerOpen(false);
              openExportDialog();
            }}
            sx={{ borderRadius: 2, bgcolor: "#F8FAFC", border: "1px solid #E2E8F0" }}
          >
            <ListItemIcon sx={{ minWidth: 32, color: "#475569" }}>
              <FileDownloadOutlinedIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Export Journal" primaryTypographyProps={{ fontSize: "0.85rem", fontWeight: 600 }} />
          </ListItemButton>

          <ListItemButton
            onClick={() => {
              if (isMobile) setMobileDrawerOpen(false);
              handleLogout();
            }}
            sx={{ borderRadius: 2, bgcolor: "#FEF2F2", border: "1px solid #FECACA", color: "#B91C1C" }}
          >
            <ListItemIcon sx={{ minWidth: 32, color: "#DC2626" }}>
              <LogoutOutlinedIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Sign Out" primaryTypographyProps={{ fontSize: "0.85rem", fontWeight: 700 }} />
          </ListItemButton>
        </Stack>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "#F8FAFC" }}>
      {/* Top Header Bar */}
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          bgcolor: "#FFFFFF",
          color: "#0F172A",
          borderBottom: "1px solid #E2E8F0",
          zIndex: (t) => t.zIndex.drawer + 1,
        }}
      >
        <Toolbar sx={{ justifyContent: "space-between", px: { xs: 2, sm: 3 } }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <IconButton
              edge="start"
              color="inherit"
              onClick={() => (isMobile ? setMobileDrawerOpen(true) : setDesktopDrawerOpen(!desktopDrawerOpen))}
            >
              <MenuIcon />
            </IconButton>

            <Typography variant="h6" sx={{ fontWeight: 800, fontSize: { xs: "1rem", sm: "1.2rem" } }}>
              {navItems.find((n) =>
                n.path === "/"
                  ? pathname === "/"
                  : pathname === n.path || pathname.startsWith(`${n.path}/`)
              )?.label || "Vault Tracking"}
            </Typography>
          </Stack>

          {/* Header Controls: Compact Format Toggle (#7), Privacy Eye (#8), Net Wealth Badge */}
          <Stack direction="row" spacing={0.75} alignItems="center">
            <Tooltip title={isCompactNumbers ? "Compact mode (1M / 59.5k). Tap for full precision" : "Full precision mode. Tap for compact"} arrow>
              <Chip
                label={isCompactNumbers ? "Compact" : "Exact"}
                size="small"
                clickable
                onClick={toggleCompactNumbers}
                variant="outlined"
                sx={{
                  fontWeight: 700,
                  fontSize: "0.72rem",
                  height: 26,
                  borderColor: "#CBD5E1",
                  color: "#475569",
                  bgcolor: "#F8FAFC",
                }}
              />
            </Tooltip>

            <Tooltip title={isPrivacyHidden ? "Show balances (Privacy Mode ON)" : "Hide balances (Privacy Mode)"} arrow>
              <IconButton
                size="small"
                onClick={togglePrivacyHidden}
                color={isPrivacyHidden ? "warning" : "default"}
                aria-label="Toggle privacy mode"
              >
                {isPrivacyHidden ? <VisibilityOffOutlinedIcon fontSize="small" /> : <VisibilityOutlinedIcon fontSize="small" />}
              </IconButton>
            </Tooltip>

            {netWealth !== undefined && (
              <Chip
                label={<MoneyValue value={netWealth} currency={baseCurrency} />}
                component={Link}
                href="/analytics"
                clickable
                color="primary"
                variant="outlined"
                sx={{ fontWeight: 800, fontSize: "0.78rem", height: 28, borderColor: "#BFDBFE", bgcolor: "#EFF6FF" }}
              />
            )}
          </Stack>
        </Toolbar>
      </AppBar>

      {/* Desktop Persistent Drawer */}
      {!isMobile && (
        <Drawer
          variant="persistent"
          open={desktopDrawerOpen}
          sx={{
            width: desktopDrawerOpen ? DRAWER_WIDTH : 0,
            flexShrink: 0,
            "& .MuiDrawer-paper": {
              width: DRAWER_WIDTH,
              boxSizing: "border-box",
              borderRight: "1px solid #E2E8F0",
              mt: "64px",
              height: "calc(100vh - 64px)",
            },
          }}
        >
          {drawerContent}
        </Drawer>
      )}

      {/* Mobile / Android Temporary Drawer — elevated above AppBar so brand/profile stays visible (#2) */}
      {isMobile && (
        <Drawer
          variant="temporary"
          open={mobileDrawerOpen}
          onClose={() => setMobileDrawerOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            zIndex: (t) => t.zIndex.drawer + 2,
            "& .MuiDrawer-paper": {
              width: DRAWER_WIDTH,
              boxSizing: "border-box",
            },
          }}
        >
          {drawerContent}
        </Drawer>
      )}

      {/* Main Content Area */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          minWidth: 0,
          pt: "72px",
          pb: isMobile ? "96px" : "32px",
          px: { xs: 1.5, sm: 3 },
          width: "100%",
          maxWidth: "100vw",
          overflowX: "hidden",
        }}
      >
        {children}
      </Box>

      {/* Mobile / Android Bottom Navigation Bar (Thumb Access) */}
      {isMobile && (
        <Paper
          sx={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 1000,
            borderTop: "1px solid #E2E8F0",
          }}
          elevation={3}
        >
          <BottomNavigation
            value={
              navItems.find((n) =>
                n.path === "/"
                  ? pathname === "/"
                  : pathname === n.path || pathname.startsWith(`${n.path}/`)
              )?.path || "/"
            }
            showLabels
            sx={{
              height: 60,
              "& .Mui-selected": { color: "#2563EB", fontWeight: 700 },
              "& .MuiBottomNavigationAction-root": { minWidth: 0, px: 0.5 },
              "& .MuiBottomNavigationAction-label": { fontSize: "0.68rem" },
            }}
          >
            <BottomNavigationAction component={Link} href="/" label="Actions" value="/" icon={<FlashOnIcon />} />
            <BottomNavigationAction component={Link} href="/analytics" label="Journey" value="/analytics" icon={<ShowChartIcon />} />
            <BottomNavigationAction component={Link} href="/checkpoints" label="Vaults" value="/checkpoints" icon={<AccountBalanceIcon />} />
            <BottomNavigationAction component={Link} href="/debts" label="Debts" value="/debts" icon={<PeopleAltOutlinedIcon />} />
            <BottomNavigationAction component={Link} href="/ledger" label="Ledger" value="/ledger" icon={<ReceiptLongIcon />} />
          </BottomNavigation>
        </Paper>
      )}

      {/* Global Toast Queue, Confirm Dialog, & Shared Action Modals */}
      <ToastProvider />
      <ReconcileModal vaults={data?.vaults || []} />
      <ExportModal />
      <AddPartyModal />
      <ManageCardsModal
        vaults={data?.vaults || []}
        categories={data?.categories || []}
        parties={data?.parties || []}
      />
      <PromoteToCardModal
        vaults={data?.vaults || []}
        categories={data?.categories || []}
        parties={data?.parties || []}
        baseCurrency={baseCurrency}
      />
      <CardSuggestionModal />
      <CustomTransactionModal
        vaults={data?.vaults || []}
        categories={data?.categories || []}
        parties={data?.parties || []}
        latestCheckpointsByVault={data?.latestCheckpointsByVault || {}}
        defaultMonthlyVaultId={data?.defaultMonthlyVaultId || null}
        defaultCashVaultId={data?.defaultCashVaultId || null}
        baseCurrency={baseCurrency}
        exchangeRates={data?.exchangeRates || {}}
      />
      <VaultProfileModal baseCurrency={baseCurrency} />
      <SubVaultSyncModal
        vaults={data?.vaults || []}
        baseCurrency={baseCurrency}
        exchangeRates={data?.exchangeRates || {}}
      />
      <FxSettingsModal />
      <AutoChartDrawer />
    </Box>
  );
}

