// API Route: GET /api/media/[...path]
// Serves uploaded media files safely from data-server/media/

import { NextResponse } from "next/server";
import { readMediaFileSafe } from "@/lib/mediaStorage";

export const dynamic = "force-dynamic";

export async function GET(_request, { params }) {
  try {
    const resolved = await params;
    const segments = resolved?.path || [];
    const file = await readMediaFileSafe(segments);

    if (!file) {
      return NextResponse.json({ success: false, error: "Media file not found" }, { status: 404 });
    }

    return new NextResponse(file.data, {
      status: 200,
      headers: {
        "Content-Type": file.contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error("Error in GET /api/media:", error);
    return NextResponse.json(
      { success: false, error: "Failed to read media file" },
      { status: 500 }
    );
  }
}
