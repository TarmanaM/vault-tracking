import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLedgerStore } from "@/store/useLedgerStore";

export function useAdminLogic() {
  const queryClient = useQueryClient();
  const enqueueToast = useLedgerStore((s) => s.enqueueToast);

  const [infoAnchor, setInfoAnchor] = useState(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newFullName, setNewFullName] = useState("");
  const [newRole, setNewRole] = useState("USER");
  const [newTempPassword, setNewTempPassword] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const [resetTarget, setResetTarget] = useState(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState("");

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteConfirmUsername, setDeleteConfirmUsername] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const { data: authData } = useQuery({
    queryKey: ["auth-me"],
    queryFn: async () => {
      const res = await fetch("/api/auth/me");
      if (!res.ok) throw new Error("Failed to verify session");
      const json = await res.json();
      return json.data;
    },
  });

  const currentUser = authData?.user;
  const isAdmin = currentUser?.role === "ADMIN";

  const {
    data: users = [],
    isLoading,
    error: fetchError,
  } = useQuery({
    queryKey: ["admin-users"],
    enabled: Boolean(isAdmin),
    queryFn: async () => {
      const res = await fetch("/api/admin/users");
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to load accounts");
      }
      return json.data || [];
    },
  });

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setCreateError("");
    setCreating(true);

    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: newUsername.trim().toLowerCase(),
          fullName: newFullName.trim(),
          role: newRole,
          temporaryPassword: newTempPassword,
        }),
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        setCreateError(json.error || "Failed to create account");
        return;
      }

      setCreateOpen(false);
      setNewUsername("");
      setNewFullName("");
      setNewRole("USER");
      setNewTempPassword("");
      await queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      enqueueToast(`Created account "@${json.data?.username}"`, { severity: "success" });
    } catch {
      setCreateError("Server error while creating account");
    } finally {
      setCreating(false);
    }
  };

  const handleToggleActive = async (targetUser) => {
    try {
      const res = await fetch(`/api/admin/users/${targetUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !targetUser.isActive }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        enqueueToast(json.error || "Failed to update account status", { severity: "error" });
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      enqueueToast(
        json.data?.isActive
          ? `Activated @${targetUser.username}`
          : `Deactivated @${targetUser.username}`,
        { severity: "success" }
      );
    } catch {
      enqueueToast("Failed to update user status", { severity: "error" });
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!resetTarget) return;
    setResetError("");
    setResetting(true);

    try {
      const res = await fetch(`/api/admin/users/${resetTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "RESET_PASSWORD",
          temporaryPassword: resetPassword,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setResetError(json.error || "Failed to reset password");
        return;
      }

      setResetTarget(null);
      setResetPassword("");
      await queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      enqueueToast(
        `Temporary password set for @${resetTarget.username}. User must change it at next login.`,
        { severity: "success" }
      );
    } catch {
      setResetError("Failed to reset password");
    } finally {
      setResetting(false);
    }
  };

  const handleDeleteUser = async (e) => {
    e.preventDefault();
    if (!deleteTarget) return;
    setDeleteError("");
    setDeleting(true);

    try {
      const res = await fetch(`/api/admin/users/${deleteTarget.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirmUsername: deleteConfirmUsername.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setDeleteError(json.error || "Failed to delete user account");
        return;
      }

      const deletedUsername = deleteTarget.username;
      setDeleteTarget(null);
      setDeleteConfirmUsername("");
      await queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      enqueueToast(`Permanently deleted account "@${deletedUsername}"`, {
        severity: "info",
      });
    } catch {
      setDeleteError("Failed to delete user account");
    } finally {
      setDeleting(false);
    }
  };

  return {
    currentUser,
    isAdmin,
    users,
    isLoading,
    fetchError,
    infoAnchor,
    setInfoAnchor,
    createOpen,
    setCreateOpen,
    newUsername,
    setNewUsername,
    newFullName,
    setNewFullName,
    newRole,
    setNewRole,
    newTempPassword,
    setNewTempPassword,
    creating,
    createError,
    setCreateError,
    resetTarget,
    setResetTarget,
    resetPassword,
    setResetPassword,
    resetting,
    resetError,
    setResetError,
    deleteTarget,
    setDeleteTarget,
    deleteConfirmUsername,
    setDeleteConfirmUsername,
    deleting,
    deleteError,
    setDeleteError,
    handleCreateUser,
    handleToggleActive,
    handleResetPassword,
    handleDeleteUser,
  };
}
