// Admin user provisioning, activation, and password reset service (Strictly metadata-scoped)
import "server-only";
import { hashPassword } from "@/server/modules/auth/auth.service";
import { deleteUserAccountCascadeInTx } from "@/server/modules/auth/auth.repository";
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from "@/server/http/errors";
import {
  listAllUserAccountsMetadata,
  findUserAccountByUsername,
  findUserAccountById,
  countOtherActiveAdmins,
  createProvisionedUserWithAppSettings,
  updateUserAccountById,
} from "./admin.repository.js";

export { listAllUserAccountsMetadata };

export async function provisionNewUserAccount(payload) {
  const username = String(payload?.username || "")
    .trim()
    .toLowerCase();
  const fullName = String(payload?.fullName || "").trim();
  const role = String(payload?.role || "USER").toUpperCase() === "ADMIN" ? "ADMIN" : "USER";
  const temporaryPassword = String(payload?.temporaryPassword || "");

  if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
    throw new BadRequestError(
      "Username must be 3-32 characters (letters, numbers, dot, underscore, hyphen)"
    );
  }
  if (!fullName || fullName.length < 2) {
    throw new BadRequestError("Full name is required (min 2 characters)");
  }
  if (temporaryPassword.length < 6) {
    throw new BadRequestError("Temporary password must be at least 6 characters");
  }

  const existing = await findUserAccountByUsername(username);
  if (existing) {
    throw new ConflictError(`Username "${username}" is already taken`);
  }

  const passwordHash = await hashPassword(temporaryPassword);
  return await createProvisionedUserWithAppSettings({
    username,
    fullName,
    role,
    passwordHash,
  });
}

export async function updateManagedUserAccount({ adminUser, targetUserId, payload }) {
  const targetId = parseInt(targetUserId, 10);
  if (!targetId || Number.isNaN(targetId)) {
    throw new BadRequestError("Invalid user ID");
  }

  const target = await findUserAccountById(targetId);
  if (!target) {
    throw new NotFoundError("User account not found");
  }

  const action = String(payload?.action || "UPDATE").toUpperCase();
  if (action === "RESET_PASSWORD") {
    if (target.id === adminUser.id) {
      throw new BadRequestError(
        "Use Settings > Account Security to change your own password."
      );
    }

    const temporaryPassword = String(payload?.temporaryPassword || "");
    if (temporaryPassword.length < 6) {
      throw new BadRequestError("Temporary password must be at least 6 characters");
    }

    const passwordHash = await hashPassword(temporaryPassword);
    return await updateUserAccountById(targetId, {
      passwordHash,
      mustChangePassword: true,
    });
  }

  const updateData = {};

  if (payload?.isActive !== undefined) {
    const nextActive = Boolean(payload.isActive);
    if (target.id === adminUser.id && !nextActive) {
      throw new BadRequestError("You cannot deactivate your own active Admin account");
    }
    if (!nextActive && target.role === "ADMIN") {
      const otherActiveAdmins = await countOtherActiveAdmins(targetId);
      if (otherActiveAdmins === 0) {
        throw new BadRequestError("At least one active ADMIN account must remain active");
      }
    }
    updateData.isActive = nextActive;
  }

  if (payload?.role !== undefined) {
    const nextRole = String(payload.role).toUpperCase() === "ADMIN" ? "ADMIN" : "USER";
    if (target.id === adminUser.id && nextRole !== "ADMIN") {
      throw new BadRequestError("You cannot remove ADMIN role from your own account");
    }
    if (target.role === "ADMIN" && nextRole !== "ADMIN") {
      const otherActiveAdmins = await countOtherActiveAdmins(targetId);
      if (otherActiveAdmins === 0) {
        throw new BadRequestError("Cannot demote the last active ADMIN account");
      }
    }
    updateData.role = nextRole;
  }

  if (payload?.fullName !== undefined) {
    const fullName = String(payload.fullName || "").trim();
    if (fullName.length < 2) {
      throw new BadRequestError("Full name must be at least 2 characters");
    }
    updateData.fullName = fullName;
  }

  if (Object.keys(updateData).length === 0) {
    throw new BadRequestError("No valid account fields supplied");
  }

  return await updateUserAccountById(targetId, updateData);
}

export async function deleteManagedUserAccount({ targetUserId, confirmUsername }) {
  const targetId = parseInt(targetUserId, 10);
  if (!targetId || Number.isNaN(targetId)) {
    throw new BadRequestError("Invalid user ID");
  }

  const target = await findUserAccountById(targetId);
  if (!target) {
    throw new NotFoundError("User account not found");
  }

  const normalizedConfirm = String(confirmUsername || "")
    .trim()
    .replace(/^@/, "")
    .toLowerCase();
  if (!normalizedConfirm || normalizedConfirm !== target.username.toLowerCase()) {
    throw new BadRequestError(
      `Please type "${target.username}" accurately to confirm permanent account deletion.`
    );
  }

  return await deleteUserAccountCascadeInTx(targetId);
}
