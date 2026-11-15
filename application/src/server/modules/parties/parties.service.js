// Party service: lists and creates user-owned contacts and debt counterparties
import "server-only";
import { BadRequestError } from "@/server/http/errors";
import {
  findActiveUserParties,
  findUserPartyByCode,
  createUserParty,
} from "./parties.repository.js";

export { findActiveUserParties };

export async function createNewUserParty(userId, body = {}) {
  const {
    name,
    partyType = "FRIEND",
    alias = "",
    externalAccount = "",
    isDebtContact = false,
  } = body;

  if (!name || !String(name).trim()) {
    throw new BadRequestError("Contact name is required");
  }

  const cleanName = String(name).trim();
  const baseCode = cleanName
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 20);

  let code = baseCode || `PARTY_${Date.now()}`;
  const existing = await findUserPartyByCode(userId, code);
  if (existing) {
    code = `${baseCode}_${Date.now().toString().slice(-4)}`;
  }

  const aliases = alias && String(alias).trim() ? [String(alias).trim()] : [];
  const externalAccounts =
    externalAccount && String(externalAccount).trim() ? [String(externalAccount).trim()] : [];

  return await createUserParty({
    userId: Number(userId),
    code,
    name: cleanName,
    partyType,
    isDebtContact: Boolean(isDebtContact),
    aliasesJson: aliases.length > 0 ? JSON.stringify(aliases) : null,
    externalAccountsJson:
      externalAccounts.length > 0 ? JSON.stringify(externalAccounts) : null,
  });
}
