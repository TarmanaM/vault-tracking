// End-to-end HTTP integration verification for Vault Tracking v2.0+ (PostgreSQL, Multi-User, Auth, In-DB Media, Isolation)
// Spawns next start cleanly on an isolated local port, runs assertions, and removes test data on exit.

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const APP_DIR = fs.existsSync(path.resolve(process.cwd(), "package.json"))
  ? path.resolve(process.cwd())
  : path.resolve(process.cwd(), "application");

// Load .env from APP_DIR if present
const envFile = path.join(APP_DIR, ".env");
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx <= 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) {
      process.env[key] = val;
    }
  }
}

const { PrismaClient } = require(path.join(APP_DIR, "node_modules/@prisma/client"));
const prisma = new PrismaClient();
const PORT = 3199;
const BASE_URL = `http://127.0.0.1:${PORT}`;

class CookieClient {
  constructor(label) {
    this.label = label;
    this.cookie = "";
  }

  async request(urlPath, { method = "GET", body = null, headers = {}, redirect = "manual" } = {}) {
    const reqHeaders = { ...headers };
    if (this.cookie) reqHeaders.Cookie = this.cookie;

    let payload = body;
    if (body && typeof body === "object" && !(body instanceof Buffer)) {
      reqHeaders["Content-Type"] = "application/json";
      payload = JSON.stringify(body);
    }

    const res = await fetch(`${BASE_URL}${urlPath}`, {
      method,
      headers: reqHeaders,
      body: payload,
      redirect,
    });

    const setCookieHeader = res.headers.get("set-cookie");
    if (setCookieHeader) {
      const firstPair = setCookieHeader.split(";")[0];
      if (firstPair.startsWith("auth_token=")) {
        const val = firstPair.slice("auth_token=".length);
        this.cookie = val ? firstPair : "";
      }
    }

    let json = null;
    const text = await res.text();
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }

    return { status: res.status, headers: res.headers, text, json };
  }
}

async function waitForServerReady(timeoutMs = 25000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${BASE_URL}/login`, { redirect: "manual" });
      if (res.status >= 200 && res.status < 500) return;
    } catch {
      // Wait for socket listen
    }
    await new Promise((r) => setTimeout(r, 350));
  }
  throw new Error("Timed out waiting for Next.js server to start");
}

async function runTests() {
  const nextBin = path.join(APP_DIR, "node_modules/next/dist/bin/next");
  const serverProc = spawn(
    process.execPath,
    [nextBin, "start", "-H", "127.0.0.1", "-p", String(PORT)],
    {
      cwd: APP_DIR,
      env: {
        ...process.env,
        NODE_ENV: "production",
        JWT_SECRET:
          process.env.JWT_SECRET || "vault_tracking_secret_key_local_2026_dev_32chars",
      },
      stdio: ["ignore", "pipe", "pipe"],
    }
  );

  let serverLogs = "";
  serverProc.stdout.on("data", (d) => {
    serverLogs += d.toString();
  });
  serverProc.stderr.on("data", (d) => {
    serverLogs += d.toString();
  });

  const createdUserIds = [];

  try {
    await waitForServerReady();
    console.log("Server booted on", BASE_URL);

    // 1. Unauthenticated guards
    const anonClient = new CookieClient("anon");
    const anonHome = await anonClient.request("/");
    assert.equal(anonHome.status, 307, "Middleware should redirect unauthenticated /");
    assert.ok(
      anonHome.headers.get("location")?.includes("/login"),
      "Redirect location should point to /login"
    );

    for (const protectedApi of [
      "/api/auth/me",
      "/api/dashboard",
      "/api/vaults",
      "/api/categories",
      "/api/transactions",
      "/api/debts",
      "/api/export",
      "/api/admin/users",
    ]) {
      const res = await anonClient.request(protectedApi);
      assert.equal(res.status, 401, `Anonymous ${protectedApi} must return 401`);
    }
    console.log("PASS 1: Unauthenticated middleware + API guards enforced");

    // 2. Admin login & closed provisioning
    const adminClient = new CookieClient("admin");
    const badLogin = await adminClient.request("/api/auth/login", {
      method: "POST",
      body: { username: "isa", password: "wrong_password" },
    });
    assert.equal(badLogin.status, 401);

    const adminLogin = await adminClient.request("/api/auth/login", {
      method: "POST",
      body: { username: "isa", password: process.env.SEED_ADMIN_PASSWORD || "admin123" },
    });
    assert.equal(adminLogin.status, 200, "Admin login should succeed");
    assert.equal(adminLogin.json?.data?.user?.role, "ADMIN");

    const unameA = `__v2_test_a_${Date.now()}`;
    const unameB = `__v2_test_b_${Date.now()}`;
    const unameC = `__v2_test_c_${Date.now()}`;

    const createARes = await adminClient.request("/api/admin/users", {
      method: "POST",
      body: {
        username: unameA,
        fullName: "Test User A",
        role: "USER",
        temporaryPassword: "tempPasswordA1",
      },
    });
    assert.equal(createARes.status, 200, `Create User A failed: ${createARes.text}`);
    const userAId = createARes.json.data.id;
    createdUserIds.push(userAId);
    assert.equal(createARes.json.data.mustChangePassword, true);

    const createBRes = await adminClient.request("/api/admin/users", {
      method: "POST",
      body: {
        username: unameB,
        fullName: "Test User B",
        role: "USER",
        temporaryPassword: "tempPasswordB1",
      },
    });
    assert.equal(createBRes.status, 200);
    const userBId = createBRes.json.data.id;
    createdUserIds.push(userBId);

    const createCRes = await adminClient.request("/api/admin/users", {
      method: "POST",
      body: {
        username: unameC,
        fullName: "Test User C",
        role: "USER",
        temporaryPassword: "tempPasswordC1",
      },
    });
    assert.equal(createCRes.status, 200);
    const userCId = createCRes.json.data.id;
    createdUserIds.push(userCId);

    const adminUsersList = await adminClient.request("/api/admin/users");
    assert.equal(adminUsersList.status, 200);
    const listFields = Object.keys(adminUsersList.json.data[0]);
    for (const forbidden of ["vaults", "transactions", "passwordHash", "onboardingProfileJson"]) {
      assert.ok(!listFields.includes(forbidden), `Admin list must not leak ${forbidden}`);
    }
    console.log("PASS 2: Admin login, closed provisioning, and metadata-only user listing");

    // 3. Forced password change & USER admin route denial
    const clientA = new CookieClient("userA");
    const loginA = await clientA.request("/api/auth/login", {
      method: "POST",
      body: { username: unameA, password: "tempPasswordA1" },
    });
    assert.equal(loginA.status, 200);
    assert.equal(loginA.json.data.user.mustChangePassword, true);

    const blockedDashA = await clientA.request("/api/dashboard");
    assert.equal(blockedDashA.status, 403);
    assert.equal(blockedDashA.json?.code, "PASSWORD_CHANGE_REQUIRED");

    const samePassTry = await clientA.request("/api/auth/change-password", {
      method: "POST",
      body: { currentPassword: "tempPasswordA1", newPassword: "tempPasswordA1" },
    });
    assert.equal(samePassTry.status, 400);

    const changePassA = await clientA.request("/api/auth/change-password", {
      method: "POST",
      body: { currentPassword: "tempPasswordA1", newPassword: "personalPassA99" },
    });
    assert.equal(changePassA.status, 200);
    assert.equal(changePassA.json.data.user.mustChangePassword, false);

    const userHitAdmin = await clientA.request("/api/admin/users");
    assert.equal(userHitAdmin.status, 403, "Standard USER cannot access /api/admin/users");
    console.log("PASS 3: Forced password change & ADMIN role enforcement");

    // 4. Onboarding Interview (User A -> USD, User C -> IDR BCA 300k) vs Skip Default (User B -> IDR)
    const onboardA = await clientA.request("/api/onboarding", {
      method: "POST",
      body: {
        mode: "INTERVIEW",
        baseCurrency: "USD",
        modules: ["VEHICLE", "COFFEE_LIFESTYLE"],
        starterVaults: [
          { key: "CASH", enabled: true, customName: "Wallet A", openingBalance: 500 },
          { key: "BANK", enabled: true, customName: "Bank A", openingBalance: 1500 },
        ],
      },
    });
    assert.equal(onboardA.status, 200, `Onboard A failed: ${onboardA.text}`);

    const clientB = new CookieClient("userB");
    await clientB.request("/api/auth/login", {
      method: "POST",
      body: { username: unameB, password: "tempPasswordB1" },
    });
    await clientB.request("/api/auth/change-password", {
      method: "POST",
      body: { currentPassword: "tempPasswordB1", newPassword: "personalPassB99" },
    });
    const onboardB = await clientB.request("/api/onboarding", {
      method: "POST",
      body: { mode: "SKIP" },
    });
    assert.equal(onboardB.status, 200, `Onboard B skip failed: ${onboardB.text}`);

    const dashA = await clientA.request("/api/dashboard");
    const dashB = await clientB.request("/api/dashboard");
    assert.equal(dashA.status, 200);
    assert.equal(dashB.status, 200);
    assert.equal(dashA.json.data.appSettings.baseCurrency, "USD");
    assert.equal(dashB.json.data.appSettings.baseCurrency, "IDR");
    assert.equal(Number(dashA.json.data.summary.netTotalWealth), 2000);
    assert.equal(Number(dashB.json.data.summary.netTotalWealth), 0);

    const clientC = new CookieClient("userC");
    await clientC.request("/api/auth/login", {
      method: "POST",
      body: { username: unameC, password: "tempPasswordC1" },
    });
    await clientC.request("/api/auth/change-password", {
      method: "POST",
      body: { currentPassword: "tempPasswordC1", newPassword: "personalPassC99" },
    });
    const onboardC = await clientC.request("/api/onboarding", {
      method: "POST",
      body: {
        mode: "INTERVIEW",
        baseCurrency: "IDR",
        modules: ["VEHICLE", "HOUSING_BILLS", "COFFEE_LIFESTYLE", "CHARITY_SOCIAL"],
        starterVaults: [
          { key: "CASH", enabled: false, customName: "Cash Wallet", openingBalance: 0 },
          { key: "BANK", enabled: true, customName: "BCA", openingBalance: 300000 },
          { key: "EWALLET", enabled: false, customName: "E-Wallet", openingBalance: 0 },
        ],
      },
    });
    assert.equal(onboardC.status, 200, `Onboard C failed: ${onboardC.text}`);

    const dashC = await clientC.request("/api/dashboard");
    assert.equal(dashC.status, 200);
    const bcaVault = dashC.json.data.vaults.find((v) => v.name === "BCA");
    assert.ok(bcaVault, "BCA vault should be created for User C");
    assert.equal(Number(bcaVault.currentBalance), 300000);
    assert.equal(Number(dashC.json.data.summary.netTotalWealth), 300000);
    console.log("PASS 4: Onboarding Interview (incl. IDR BCA 300.000) & Skip Preset initialized independent ledgers");

    // 5. Custom Category CRUD & Full Cross-User Isolation + Admin Privacy + In-DB Media Isolation
    const customCatRes = await clientA.request("/api/categories", {
      method: "POST",
      body: {
        name: "Pet Supplies",
        defaultNature: "EXPENSE",
        commitmentType: "VARIABLE_ESSENTIAL",
      },
    });
    assert.equal(customCatRes.status, 200, `Custom category failed: ${customCatRes.text}`);
    const customCatId = customCatRes.json.data.id;
    assert.equal(customCatRes.json.data.priorityTier, "PRIMER");

    const walletA = dashA.json.data.vaults.find((v) => v.name === "Wallet A");
    const selfPartyA = dashA.json.data.parties.find((p) => p.partyType === "SELF");
    assert.ok(walletA, "Wallet A should exist for User A");
    assert.ok(selfPartyA, "SELF party should exist for User A");

    const txARes = await clientA.request("/api/transactions", {
      method: "POST",
      body: {
        title: "Dog Food Bag",
        nature: "EXPENSE",
        grossAmount: 45.25,
        sourceVaultId: walletA.id,
        partyId: selfPartyA.id,
        categoryId: customCatId,
      },
    });
    assert.equal(txARes.status, 200, `Create tx A failed: ${txARes.text}`);
    const txAId = txARes.json.data.id;
    assert.equal(Number(txARes.json.data.consumeAmount), -45.25);

    const bTxs = await clientB.request("/api/transactions");
    assert.equal(bTxs.json.data.total, 0, "User B must see 0 transactions from User A");

    const bTouchVaultA = await clientB.request(`/api/vaults/${walletA.id}`, {
      method: "PATCH",
      body: { name: "Hacked" },
    });
    assert.equal(bTouchVaultA.status, 404);

    const bDeleteTxA = await clientB.request(`/api/transactions/${txAId}`, {
      method: "DELETE",
    });
    assert.ok([400, 404].includes(bDeleteTxA.status));
    assert.equal(bDeleteTxA.json?.success, false);

    const bPatchCatA = await clientB.request(`/api/categories/${customCatId}`, {
      method: "PATCH",
      body: { name: "Hijacked" },
    });
    assert.equal(bPatchCatA.status, 404);

    const adminTouchTxA = await adminClient.request(`/api/transactions/${txAId}`);
    assert.equal(adminTouchTxA.status, 404, "ADMIN must not read User A transactions");

    // Verify User A PostgreSQL bytea media isolation (Upload -> User A OK, User B & Admin blocked)
    const pngBase64 =
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
    const uploadA = await clientA.request("/api/media/vaults", {
      method: "POST",
      body: {
        vaultSlug: "wallet-a",
        dataUrl: `data:image/png;base64,${pngBase64}`,
      },
    });
    assert.equal(uploadA.status, 200, `Upload media failed: ${uploadA.text}`);
    const mediaUrlA = uploadA.json.data.url;
    assert.ok(mediaUrlA.startsWith(`/api/media/vaults/${userAId}/`), "Media path must isolate userId");

    const aReadMedia = await clientA.request(mediaUrlA);
    assert.equal(aReadMedia.status, 200);
    const bReadMedia = await clientB.request(mediaUrlA);
    assert.ok([403, 404].includes(bReadMedia.status), "User B must be blocked from User A media");
    const adminReadMedia = await adminClient.request(mediaUrlA);
    assert.ok([403, 404].includes(adminReadMedia.status), "ADMIN must be blocked from User A media");

    const exportA = await clientA.request("/api/export?format=journal");
    assert.equal(exportA.status, 200);
    assert.ok(exportA.text.includes("Dog Food Bag"));
    console.log("PASS 5: Custom category, atomic ledger, CSV export, and cross-user/admin/media isolation");

    // 6. Live deactivation & password reset enforcement
    const deactivateB = await adminClient.request(`/api/admin/users/${userBId}`, {
      method: "PATCH",
      body: { isActive: false },
    });
    assert.equal(deactivateB.status, 200);

    const kickedB = await clientB.request("/api/auth/me");
    assert.equal(kickedB.status, 403);
    assert.equal(kickedB.json?.code, "ACCOUNT_DISABLED");

    const resetA = await adminClient.request(`/api/admin/users/${userAId}`, {
      method: "PATCH",
      body: { action: "RESET_PASSWORD", temporaryPassword: "resetTempPasswordA1" },
    });
    assert.equal(resetA.status, 200);
    assert.equal(resetA.json.data.mustChangePassword, true);

    const blockedAfterReset = await clientA.request("/api/dashboard");
    assert.equal(blockedAfterReset.status, 403);
    assert.equal(blockedAfterReset.json?.code, "PASSWORD_CHANGE_REQUIRED");
    console.log("PASS 6: Live user deactivation & admin password reset immediate session revocation");

    console.log("\nALL V2 MULTI-USER INTEGRATION ASSERTIONS PASSED CLEANLY.");
  } finally {
    serverProc.kill("SIGTERM");

    for (const uid of createdUserIds) {
      await prisma.mediaAsset.deleteMany({ where: { userId: uid } }).catch(() => {});
      await prisma.pendingReminder.deleteMany({ where: { userId: uid } }).catch(() => {});
      await prisma.debtLedgerEntry.deleteMany({ where: { userId: uid } }).catch(() => {});
      await prisma.transactionLeg.deleteMany({ where: { userId: uid } }).catch(() => {});
      await prisma.checkpointDenomination.deleteMany({ where: { checkpoint: { userId: uid } } }).catch(() => {});
      await prisma.vaultCheckpoint.deleteMany({ where: { userId: uid } }).catch(() => {});
      await prisma.cardHabitStats.deleteMany({ where: { card: { userId: uid } } }).catch(() => {});
      await prisma.transaction.deleteMany({ where: { userId: uid } }).catch(() => {});
      await prisma.actionCard.deleteMany({ where: { userId: uid } }).catch(() => {});
      await prisma.vaultSubContainer.deleteMany({ where: { vault: { userId: uid } } }).catch(() => {});
      await prisma.vault.deleteMany({ where: { userId: uid } }).catch(() => {});
      await prisma.category.deleteMany({ where: { userId: uid } }).catch(() => {});
      await prisma.party.deleteMany({ where: { userId: uid } }).catch(() => {});
      await prisma.appSetting.deleteMany({ where: { userId: uid } }).catch(() => {});
      await prisma.user.deleteMany({ where: { id: uid } }).catch(() => {});
    }
    await prisma.$disconnect();
    if (serverLogs && process.env.DEBUG_TEST_LOGS) {
      console.log(serverLogs);
    }
  }
}

runTests().catch((err) => {
  console.error("VERIFICATION FAILED:", err);
  process.exit(1);
});
