/**
 * Standardized application error taxonomy.
 *
 * Services and repositories should throw one of these instead of a bare
 * `Error`, so callers (server function handlers, UI error boundaries) can
 * branch on `error.code` instead of parsing messages.
 */

export type AppErrorCode =
  | "VALIDATION_ERROR"
  | "PERMISSION_ERROR"
  | "BUSINESS_RULE_ERROR"
  | "DATABASE_ERROR"
  | "EXTERNAL_INTEGRATION_ERROR"
  | "UNKNOWN_APPLICATION_ERROR";

export abstract class AppError extends Error {
  abstract readonly code: AppErrorCode;

  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

/** Input failed schema/shape validation before it reached business logic. */
export class ValidationError extends AppError {
  readonly code = "VALIDATION_ERROR" as const;
}

/** Caller is authenticated but not authorized for this action/resource. */
export class PermissionError extends AppError {
  readonly code = "PERMISSION_ERROR" as const;
}

/** Input is well-formed but violates a domain rule (e.g. duplicate, invalid state transition). */
export class BusinessRuleError extends AppError {
  readonly code = "BUSINESS_RULE_ERROR" as const;
}

/** A repository call to Supabase/Postgres failed. */
export class DatabaseError extends AppError {
  readonly code = "DATABASE_ERROR" as const;
}

/** A call to an external system (M-Pesa, SMS, WhatsApp, email, AI provider) failed. */
export class ExternalIntegrationError extends AppError {
  readonly code = "EXTERNAL_INTEGRATION_ERROR" as const;
}

/** Fallback for anything that doesn't fit the above — should be rare. */
export class UnknownApplicationError extends AppError {
  readonly code = "UNKNOWN_APPLICATION_ERROR" as const;
}
