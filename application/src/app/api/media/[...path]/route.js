// API Route: GET /api/media/[...path]
// Serves uploaded user-scoped media files safely from data-server/media/vaults/<userId>/

import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { readUserMediaFileSafe } from "@/lib/mediaStorage";

export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  const { user, errorResponse } = await requireUser(request);
  if (errorResponse) return errorResponse;

  try {
    const resolved = await params;
    const segments = resolved?.path || [];
    const file = await readUserMediaFileSafe(user.id, segments);

    if (!file) {
      return NextResponse.json({ success: false, error: "Media file not found" }, { status: 404 });
    }

    return new NextResponse(file.data, {
      status: 200,
      headers: {
        "Content-Type": file.contentType,
        "Cache-Control": "private, max-age=31536000",
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
