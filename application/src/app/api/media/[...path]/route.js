// API Route: GET /api/media/[...path]
// Serves user-scoped media assets from PostgreSQL media_assets with immutable private cache headers

import { NextResponse } from "next/server";
import { withApiHandler } from "@/server/http/apiHandler";
import { NotFoundError } from "@/server/http/errors";
import { readUserMediaFileSafe } from "@/server/modules/media/media.service";

export const dynamic = "force-dynamic";

export const GET = withApiHandler(
  async ({ params, user }) => {
    const segments = params?.path || [];
    const file = await readUserMediaFileSafe(user.id, segments);

    if (!file) {
      throw new NotFoundError("Media file not found");
    }

    return new NextResponse(file.data, {
      status: 200,
      headers: {
        "Content-Type": file.contentType,
        "Cache-Control": "private, max-age=31536000, immutable",
      },
    });
  },
  { errorStatus: 500 }
);
