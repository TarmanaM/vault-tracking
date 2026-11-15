// API Route: POST /api/media/vaults
// Stores cropped vault profile images in PostgreSQL media_assets (bytea)

import { withApiHandler } from "@/server/http/apiHandler";
import { BadRequestError } from "@/server/http/errors";
import { saveVaultProfileImage } from "@/server/modules/media/media.service";

export const dynamic = "force-dynamic";

export const POST = withApiHandler(async ({ request, user }) => {
  const contentType = request.headers.get("content-type") || "";
  let buffer = null;
  let mimeType = "image/webp";
  let vaultSlug = "vault";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const file = formData.get("file");
    vaultSlug = String(formData.get("vaultSlug") || "vault");

    if (!file || typeof file.arrayBuffer !== "function") {
      throw new BadRequestError("Image file is required");
    }

    const arr = await file.arrayBuffer();
    buffer = Buffer.from(arr);
    mimeType = file.type || "image/webp";
  } else {
    const body = await request.json().catch(() => ({}));
    vaultSlug = String(body.vaultSlug || "vault");
    const dataUrl = String(body.dataUrl || "");
    const match = dataUrl.match(/^data:(image\/(?:png|jpeg|jpg|webp));base64,(.+)$/i);
    if (!match) {
      throw new BadRequestError("Invalid image payload");
    }
    mimeType = match[1].toLowerCase();
    buffer = Buffer.from(match[2], "base64");
  }

  const url = await saveVaultProfileImage({
    userId: user.id,
    buffer,
    mimeType,
    vaultSlug,
  });

  return { url };
});
