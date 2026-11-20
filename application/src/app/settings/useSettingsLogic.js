import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useLedgerStore } from "@/store/useLedgerStore";

export function useSettingsLogic() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const enqueueToast = useLedgerStore((s) => s.enqueueToast);
  const openFxSettingsDialog = useLedgerStore((s) => s.openFxSettingsDialog);

  const [layerInfoAnchor, setLayerInfoAnchor] = useState(null);

  const [newName, setNewName] = useState("");
  const [newNature, setNewNature] = useState("EXPENSE");
  const [newLayer, setNewLayer] = useState("VARIABLE_ESSENTIAL");
  const [creatingCategory, setCreatingCategory] = useState(false);

  const [editTarget, setEditTarget] = useState(null);
  const [editName, setEditName] = useState("");
  const [editLayer, setEditLayer] = useState("VARIABLE_ESSENTIAL");
  const [savingEdit, setSavingEdit] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);

  const { data: authData } = useQuery({
    queryKey: ["auth-me"],
    queryFn: async () => {
      const res = await fetch("/api/auth/me");
      if (!res.ok) throw new Error("Session check failed");
      const json = await res.json();
      return json.data;
    },
  });

  const { data: catData, isLoading: catsLoading } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const res = await fetch("/api/categories");
      if (!res.ok) throw new Error("Failed to fetch categories");
      const json = await res.json();
      return json.data;
    },
  });

  const user = authData?.user;
  const baseCurrency = authData?.baseCurrency || "IDR";
  const categories = catData?.categories || [];
  const availableTemplates = catData?.availableTemplates || [];
  const spendingLayers = catData?.spendingLayers || [];

  const expenseCategories = categories.filter((c) => c.defaultNature === "EXPENSE");
  const incomeCategories = categories.filter((c) => c.defaultNature === "INCOME");

  const refreshCategoryConsumers = async () => {
    await queryClient.invalidateQueries({ queryKey: ["categories"] });
    await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const handleCreateCustomCategory = async (e) => {
    e.preventDefault();
    if (!newName.trim()) {
      enqueueToast("Category name is required", { severity: "warning" });
      return;
    }

    setCreatingCategory(true);
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          defaultNature: newNature,
          commitmentType: newNature === "EXPENSE" ? newLayer : "NONE",
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        enqueueToast(json.error || "Failed to add category", { severity: "error" });
        return;
      }

      setNewName("");
      await refreshCategoryConsumers();
      enqueueToast(`Category "${json.data?.name}" created`, { severity: "success" });
    } catch {
      enqueueToast("Failed to create category", { severity: "error" });
    } finally {
      setCreatingCategory(false);
    }
  };

  const handleEnableTemplate = async (tpl) => {
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateCode: tpl.code }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        enqueueToast(json.error || "Failed to enable template", { severity: "error" });
        return;
      }
      await refreshCategoryConsumers();
      enqueueToast(`Added "${tpl.name}" to your categories`, { severity: "success" });
    } catch {
      enqueueToast("Failed to enable category template", { severity: "error" });
    }
  };

  const openEditDialog = (cat) => {
    setEditTarget(cat);
    setEditName(cat.name);
    setEditLayer(cat.commitmentType || "VARIABLE_ESSENTIAL");
  };

  const handleSaveEdit = async () => {
    if (!editTarget) return;
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/categories/${editTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          ...(editTarget.defaultNature === "EXPENSE" && !editTarget.isSystemLocked
            ? { commitmentType: editLayer }
            : {}),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        enqueueToast(json.error || "Failed to update category", { severity: "error" });
        return;
      }
      setEditTarget(null);
      await refreshCategoryConsumers();
      enqueueToast("Category updated", { severity: "success" });
    } catch {
      enqueueToast("Failed to save category changes", { severity: "error" });
    } finally {
      setSavingEdit(false);
    }
  };

  const handleToggleArchive = async (cat) => {
    try {
      const res = await fetch(`/api/categories/${cat.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !cat.isActive }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        enqueueToast(json.error || "Failed to update category status", { severity: "error" });
        return;
      }
      await refreshCategoryConsumers();
      enqueueToast(
        json.data?.isActive ? `Restored "${cat.name}"` : `Archived "${cat.name}"`,
        { severity: "success" }
      );
    } catch {
      enqueueToast("Failed to update category status", { severity: "error" });
    }
  };

  const handleDeleteCategory = async (cat) => {
    try {
      const res = await fetch(`/api/categories/${cat.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok || !json.success) {
        enqueueToast(json.error || "Cannot delete category", { severity: "error" });
        return;
      }
      await refreshCategoryConsumers();
      enqueueToast(
        json.data?.action === "ARCHIVED"
          ? `Archived "${cat.name}" because it has existing history`
          : `Deleted "${cat.name}"`,
        { severity: "success" }
      );
    } catch {
      enqueueToast("Failed to delete category", { severity: "error" });
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPasswordError("");

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError("All password fields are required.");
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError("New password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New password and confirmation do not match.");
      return;
    }

    setChangingPassword(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setPasswordError(json.error || "Failed to update password.");
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      enqueueToast("Password updated successfully", { severity: "success" });
    } catch {
      setPasswordError("Failed to contact server.");
    } finally {
      setChangingPassword(false);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    await queryClient.clear();
    router.replace("/login");
  };

  const handleDeleteOwnAccount = async (e) => {
    e.preventDefault();
    setDeleteError("");
    if (!deletePassword) {
      setDeleteError("Please enter your current password to confirm account deletion.");
      return;
    }

    setDeletingAccount(true);
    try {
      const res = await fetch("/api/auth/me", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: deletePassword }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setDeleteError(json.error || "Failed to delete account.");
        return;
      }

      setDeleteDialogOpen(false);
      await queryClient.clear();
      router.replace("/login");
    } catch {
      setDeleteError("Failed to contact server while deleting account.");
    } finally {
      setDeletingAccount(false);
    }
  };

  return {
    user,
    baseCurrency,
    openFxSettingsDialog,
    handleLogout,
    deleteDialogOpen,
    setDeleteDialogOpen,
    deletePassword,
    setDeletePassword,
    deleteError,
    setDeleteError,
    deletingAccount,
    handleDeleteOwnAccount,
    passwordError,
    handlePasswordChange,
    currentPassword,
    setCurrentPassword,
    newPassword,
    setNewPassword,
    confirmPassword,
    setConfirmPassword,
    changingPassword,
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
  };
}
