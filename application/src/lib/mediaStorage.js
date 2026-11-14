// Local disk media storage helper for vault profile pictures and receipts
// Persists files in data-server/media/ outside Next.js build artifacts so runtime uploads work in npm run start

import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

const ALLOWED_MIME_EXT = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
};

const EXT_TO_MIME = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

/**
 * Resolve centralized data-server/media root cleanly regardless of cwd (repo root vs application/)
 */
export async function resolveMediaRoot() {
  const candidates = [
    path.resolve(process.cwd(), "..", "data-server", "media"),
    path.resolve(process.cwd(), "data-server", "media"),
  ];

  for (const dir of candidates) {
    const parent = path.dirname(dir);
    try {
      await fs.access(parent);
      await fs.mkdir(dir, { recursive: true });
      return dir;
    } catch {
      // Try next candidate
    }
  }

  const fallback = candidates[0];
  await fs.mkdir(fallback, { recursive: true });
  return fallback;
}

/**
 * Persist an uploaded or canvas-cropped vault image into data-server/media/vaults/
 */
export async function saveVaultProfileImage({ buffer, mimeType, vaultSlug = "vault" }) {
  if (!buffer || buffer.length === 0) {
    throw new Error("Image payload is empty");
  }
  if (buffer.length > 3 * 1024 * 1024) {
    throw new Error("Image exceeds 3MB limit");
  }

  const normalizedMime = String(mimeType || "").toLowerCase();
  const ext = ALLOWED_MIME_EXT[normalizedMime];
  if (!ext) {
    throw new Error("Unsupported image format. Please use PNG, JPEG, or WebP.");
  }

  const mediaRoot = await resolveMediaRoot();
  const vaultsDir = path.join(mediaRoot, "vaults");
  await fs.mkdir(vaultsDir, { recursive: true });

  const safeSlug = String(vaultSlug || "vault")
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32) || "vault";

  const uniqueToken = crypto.randomBytes(6).toString("hex");
  const filename = `${safeSlug}-${Date.now()}-${uniqueToken}.${ext}`;
  const fullPath = path.join(vaultsDir, filename);

  await fs.writeFile(fullPath, buffer);

  return `/api/media/vaults/${filename}`;
}

/**
 * Read a stored media file safely with strict path-traversal containment
 */
export async function readMediaFileSafe(pathSegments = []) {
  if (!Array.isArray(pathSegments) || pathSegments.length === 0) {
    return null;
  }

  const cleanSegments = pathSegments
    .map((s) => String(s || "").trim())
    .filter((s) => s && s !== "." && s !== "..");

  if (cleanSegments.length === 0) return null;

  const mediaRoot = await resolveMediaRoot();
  const targetPath = path.resolve(mediaRoot, ...cleanSegments);

  if (!targetPath.startsWith(mediaRoot + path.sep)) {
    return null;
  }

  try {
    const data = await fs.readFile(targetPath);
    const ext = path.extname(targetPath).toLowerCase();
    const contentType = EXT_TO_MIME[ext] || "application/octet-stream";
    return { data, contentType };
  } catch {
    return null;
  }
}
