// API Route: GET & POST /api/transactions
// Handles double-entry transaction creation and date-filtered ledger retrieval

import { NextResponse } from "next/server";
import { withApiHandler } from "@/server/http/apiHandler";
import {
  listUserTransactions,
  createUserTransactionWithSuggestion,
} from "@/server/modules/transactions/transactions.service";

export const dynamic = "force-dynamic";

export const GET = withApiHandler(
  async ({ request, user }) => {
    const { searchParams } = new URL(request.url);
    return listUserTransactions(user.id, searchParams);
  },
  { auth: "USER" }
);

export const POST = withApiHandler(
  async ({ request, user, requestId }) => {
    const body = await request.json();
    const { result, cardSuggestion } = await createUserTransactionWithSuggestion(
      user.id,
      body,
      requestId
    );
    return NextResponse.json({
      success: true,
      data: result,
      cardSuggestion,
    });
  },
  { auth: "USER" }
);
