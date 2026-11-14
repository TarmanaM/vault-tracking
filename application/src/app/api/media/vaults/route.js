// API Route: POST /api/media/vaults
// Uploads cropped vault profile images to centralized data-server/media/vaults/

import { NextResponse } from "next/server";
import { saveVaultProfileImage } from "@/lib/mediaStorage";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const contentType = request.headers.get("content-type") || "";
    let buffer = null;
    let mimeType = "image/png";
    let vaultSlug = "vault";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file");
      vaultSlug = String(formData.get("vaultSlug") || "vault");

      if (!file || typeof file.arrayBuffer !== "function") {
        return NextResponse.json(
          { success: false, error: "Image file is required" },
          { status: 400 }
        );
      }

      const arr = await file.arrayBuffer();
      buffer = Buffer.from(arr);
      mimeType = file.type || "image/png";
    } else {
      const body = await request.json();
      vaultSlug = String(body.vaultSlug || "vault");
      const dataUrl = String(body.dataUrl || "");
      const match = dataUrl.match(/^data:(image\/(?:png|jpeg|jpg|webp));base64,(.+)$/i);
      if (!match) {
        return NextResponse.json(
          { success: false, error: "Invalid image payload" },
          { status: 400 }
        );
      }
      mimeType = match[1].toLowerCase();
      buffer = Buffer.from(match[2], "base64");
    }

    const url = await saveVaultProfileImage({ buffer, mimeType, vaultSlug });

    return NextResponse.json({
      success: true,
      data: { url },
    });
  } catch (error) {
    console.error("Error in POST /api/media/vaults:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to save vault image" },
      { status: 400 }
    );
  }
}
