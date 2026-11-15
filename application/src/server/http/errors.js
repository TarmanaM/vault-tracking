// Domain & HTTP error hierarchy for deterministic API status mapping
import "server-only";

export class AppError extends Error {
  constructor(message, { status = 400, code = "BAD_REQUEST", details = null } = {}) {
    super(message);
    this.name = this.constructor.name;
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export class BadRequestError extends AppError {
  constructor(message = "Invalid request", details = null) {
    super(message, { status: 400, code: "BAD_REQUEST", details });
  }
}

export class ValidationError extends AppError {
  constructor(message = "Validation failed", details = null) {
    super(message, { status: 400, code: "VALIDATION_ERROR", details });
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Authentication required", code = "UNAUTHENTICATED") {
    super(message, { status: 401, code });
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Access denied", code = "FORBIDDEN") {
    super(message, { status: 403, code });
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found", code = "NOT_FOUND") {
    super(message, { status: 404, code });
  }
}

export class ConflictError extends AppError {
  constructor(message = "Resource conflict", code = "CONFLICT") {
    super(message, { status: 409, code });
  }
}
