// Shared Zod validation schemas for both server API routes and client forms
import { z } from "zod";

export const loginSchema = z.object({
  username: z.string().trim().min(1, "Username and password are required."),
  password: z.string().min(1, "Username and password are required."),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password and new password are required."),
  newPassword: z
    .string()
    .min(6, "New password must be at least 6 characters long."),
});

export const adminCreateUserSchema = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(
      /^[a-z0-9._-]{3,32}$/,
      "Username must be 3-32 characters using lowercase letters, numbers, dots, underscores, or hyphens."
    ),
  fullName: z.string().trim().min(1, "Full name is required."),
  role: z.enum(["USER", "ADMIN"]).optional().default("USER"),
  temporaryPassword: z
    .string()
    .min(6, "Temporary password must be at least 6 characters."),
});

export const adminPatchUserSchema = z.object({
  action: z.string().optional(),
  temporaryPassword: z.string().optional(),
  isActive: z.boolean().optional(),
  fullName: z.string().optional(),
  role: z.enum(["USER", "ADMIN"]).optional(),
});

export const onboardingSubmitSchema = z.object({
  mode: z.enum(["SKIP", "INTERVIEW"]).optional().default("INTERVIEW"),
  baseCurrency: z.string().trim().min(3).max(5).optional().default("IDR"),
  modules: z.array(z.string()).optional().default([]),
  starterVaults: z
    .array(
      z.object({
        key: z.string(),
        enabled: z.boolean().optional().default(true),
        customName: z.string().optional().default(""),
        openingBalance: z.union([z.number(), z.string()]).optional().default(0),
      })
    )
    .optional()
    .default([]),
});

export const categoryCreateSchema = z.object({
  templateCode: z.string().trim().optional(),
  name: z.string().trim().optional(),
  defaultNature: z.enum(["EXPENSE", "INCOME"]).optional().default("EXPENSE"),
  commitmentType: z
    .enum([
      "FIXED_MANDATORY",
      "VARIABLE_ESSENTIAL",
      "DISCRETIONARY_JAJAN",
      "SOCIAL_CHARITY",
      "NONE",
    ])
    .optional()
    .default("VARIABLE_ESSENTIAL"),
  iconName: z.string().nullable().optional(),
  colorHex: z.string().nullable().optional(),
});

export const categoryPatchSchema = z.object({
  name: z.string().trim().min(1, "Category name cannot be empty").optional(),
  commitmentType: z
    .enum([
      "FIXED_MANDATORY",
      "VARIABLE_ESSENTIAL",
      "DISCRETIONARY_JAJAN",
      "SOCIAL_CHARITY",
      "NONE",
    ])
    .optional(),
  isActive: z.boolean().optional(),
  iconName: z.string().nullable().optional(),
  colorHex: z.string().nullable().optional(),
});

export const partyCreateSchema = z.object({
  name: z.string().trim().min(1, "Party name is required"),
  partyType: z
    .enum(["SELF", "FAMILY", "FRIEND", "EMPLOYER", "INSTITUTION", "LENDER"])
    .optional()
    .default("FRIEND"),
  aliases: z.array(z.string()).optional().default([]),
  isDebtContact: z.boolean().optional().default(false),
});

export const fxSettingsPatchSchema = z.object({
  baseCurrency: z.string().trim().min(3).max(5).optional(),
  fxSyncIntervalDays: z.union([z.number(), z.string()]).optional(),
  manualRates: z
    .array(
      z.object({
        baseCurrency: z.string().trim().min(3).max(5),
        quoteCurrency: z.string().trim().min(3).max(5).optional(),
        rate: z.union([z.number(), z.string()]),
      })
    )
    .optional(),
});

export const dismissSuggestionSchema = z.object({
  nature: z.string().trim().optional().default("EXPENSE"),
  title: z.string().trim().min(1, "Transaction title is required"),
});
