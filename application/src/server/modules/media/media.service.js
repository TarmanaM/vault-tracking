// In-database PostgreSQL (bytea) media storage service for per-user vault avatars
// Eliminates local disk dependencies for stateless serverless / Vercel / Docker deployments
import "server-only";
import { BadRequestError } from "@/server/http/errors";
import {
  createMediaAssetRecord,
  findMediaAssetByIdForUser,
} from "./media.repository.js";

const ALLOWED_MIME_EXT = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
};

/**
 * Persist an uploaded or canvas-cropped vault image into PostgreSQL media_assets (bytea)
 */
export async function saveVaultProfileImage({ userId, buffer, mimeType, vaultSlug = "vault" }) {
  const uid = parseInt(userId, 10);
  if (!uid || Number.isNaN(uid)) {
    throw new BadRequestError("Authenticated userId is required for vault media upload");
  }
  if (!buffer || buffer.length === 0) {
    throw new BadRequestError("Image payload is empty");
  }
  if (buffer.length > 3 * 1024 * 1024) {
    throw new BadRequestError("Image exceeds 3MB limit");
  }

  const normalizedMime = String(mimeType || "").toLowerCase().trim();
  const ext = ALLOWED_MIME_EXT[normalizedMime];
  if (!ext) {
    throw new BadRequestError("Unsupported image format. Please use PNG, JPEG, or WebP.");
  }

  const canonicalMime = normalizedMime === "image/jpg" ? "image/jpeg" : normalizedMime;
  const safeSlug =
    String(vaultSlug || "vault")
      .toLowerCase()
      .replace(/[^a-z0-9-_]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 32) || "vault";

  const fileName = `${safeSlug}.${ext}`;
  const asset = await createMediaAssetRecord({
    userId: uid,
    fileName,
    mimeType: canonicalMime,
    byteSize: buffer.length,
    data: Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer),
  });

  return `/api/media/vaults/${uid}/${asset.id}-${fileName}`;
}

/**
 * Read a stored media asset from PostgreSQL with strict userId ownership verification
 */
export async function readUserMediaFileSafe(userId, pathSegments = []) {
  const uid = parseInt(userId, 10);
  if (!uid || Number.isNaN(uid)) return null;
  if (!Array.isArray(pathSegments) || pathSegments.length === 0) {
    return null;
  }

  const cleanSegments = pathSegments
    .map((s) => String(s || "").trim())
    .filter((s) => s && s !== "." && s !== "..");

  let assetToken = null;
  if (cleanSegments.length === 1) {
    assetToken = cleanSegments[0];
  } else if (
    cleanSegments.length === 3 &&
    cleanSegments[0] === "vaults" &&
    cleanSegments[1] === String(uid)
  ) {
    assetToken = cleanSegments[2];
  } else {
    return null;
  }

  const idMatch = String(assetToken).match(/^(\d+)/);
  if (!idMatch) return null;

  const assetId = parseInt(idMatch[1], 10);
  if (!assetId || Number.isNaN(assetId)) return null;

  const asset = await findMediaAssetByIdForUser(assetId, uid);
  if (!asset || !asset.data) return null;

  return {
    data: Buffer.from(asset.data),
    contentType: asset.mimeType || "image/webp",
  };
}
