// Unified DRY API Route Handler wrapper with auth guard, Zod validation, requestId, and structured logging
import "server-only";
import crypto from "node:crypto";
import { NextResponse } from "next/server";
import logger from "@/server/logger";
import { AppError } from "@/server/http/errors";
import { requireUser, requireAdmin } from "@/server/modules/auth/auth.service";

function formatZodError(zodError) {
  const issues = zodError?.issues || zodError?.errors || [];
  if (issues.length > 0 && issues[0]?.message) {
    return issues[0].message;
  }
  return "Invalid request payload.";
}

/**
 * Wrap a Next.js App Router route handler with standard auth, validation, error mapping, and logging.
 *
 * @param {(ctx: { request: Request, params: any, user: any, body: any, requestId: string }) => Promise<any>} handler
 * @param {{
 *   auth?: "USER" | "ADMIN" | "ALLOW_MUST_CHANGE_PASSWORD" | false,
 *   bodySchema?: import("zod").ZodSchema,
 *   errorStatus?: number
 * }} options
 */
export function withApiHandler(handler, options = {}) {
  const { auth = "USER", bodySchema = null, errorStatus = 400 } = options;

  return async function wrappedRouteHandler(request, routeContext = {}) {
    const requestId = crypto.randomUUID();
    const method = request?.method || "GET";
    const path = request?.nextUrl?.pathname || request?.url || "unknown";

    try {
      let user = null;

      if (auth === "ADMIN") {
        const { user: adminUser, errorResponse } = await requireAdmin(request);
        if (errorResponse) {
          errorResponse.headers.set("x-request-id", requestId);
          return errorResponse;
        }
        user = adminUser;
      } else if (auth === "ALLOW_MUST_CHANGE_PASSWORD") {
        const { user: sessionUser, errorResponse } = await requireUser(request, {
          allowMustChangePassword: true,
        });
        if (errorResponse) {
          errorResponse.headers.set("x-request-id", requestId);
          return errorResponse;
        }
        user = sessionUser;
      } else if (auth === "USER") {
        const { user: sessionUser, errorResponse } = await requireUser(request);
        if (errorResponse) {
          errorResponse.headers.set("x-request-id", requestId);
          return errorResponse;
        }
        user = sessionUser;
      }

      const params = routeContext?.params ? await routeContext.params : {};

      let body = null;
      if (bodySchema) {
        let rawBody = {};
        try {
          rawBody = await request.json();
        } catch {
          rawBody = {};
        }
        const parsed = bodySchema.safeParse(rawBody);
        if (!parsed.success) {
          const message = formatZodError(parsed.error);
          logger.warn("API request validation failed", {
            requestId,
            method,
            path,
            userId: user?.id,
            reason: message,
          });
          return NextResponse.json(
            { success: false, code: "VALIDATION_ERROR", error: message },
            { status: 400, headers: { "x-request-id": requestId } }
          );
        }
        body = parsed.data;
      }

      const result = await handler({ request, params, user, body, requestId });

      if (result instanceof Response || result instanceof NextResponse) {
        result.headers.set("x-request-id", requestId);
        return result;
      }

      return NextResponse.json(
        { success: true, data: result },
        { status: 200, headers: { "x-request-id": requestId } }
      );
    } catch (error) {
      if (error instanceof AppError) {
        logger.warn("API domain error", {
          requestId,
          method,
          path,
          status: error.status,
          code: error.code,
          error: error.message,
        });
        return NextResponse.json(
          {
            success: false,
            code: error.code,
            error: error.message,
            ...(error.details ? { details: error.details } : {}),
          },
          { status: error.status, headers: { "x-request-id": requestId } }
        );
      }

      const message = error?.message || "Unexpected server error";
      const isNotFound = /not found/i.test(message);
      const status = isNotFound ? 404 : errorStatus;

      logger.error("Unhandled route error", {
        requestId,
        method,
        path,
        status,
        error,
      });

      return NextResponse.json(
        { success: false, error: message },
        { status, headers: { "x-request-id": requestId } }
      );
    }
  };
}
