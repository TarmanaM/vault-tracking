// API Route: GET /api/export
// Generates Standard Double-Entry Accounting Journal and Flat Ledger exports in CSV

import { NextResponse } from "next/server";
import { withApiHandler } from "@/server/http/apiHandler";
import { buildAccountingCsvExport } from "@/server/modules/transactions/transactions.service";

export const dynamic = "force-dynamic";

export const GET = withApiHandler(
  async ({ request, user }) => {
    const { searchParams } = new URL(request.url);
    const { csv, fileName } = await buildAccountingCsvExport(user.id, searchParams);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  },
  { auth: "USER" }
);
