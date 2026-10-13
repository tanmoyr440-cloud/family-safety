/**
 * API error models and RFC 7807 Problem Details mapping.
 */

export interface FieldError {
  field: string;
  message: string;
}

export interface ProblemDetailResponse {
  type?: string;
  title?: string;
  status?: number;
  code?: string;
  detail?: string;
  errors?: FieldError[];
}

export class ApiError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly detail: string;
  public readonly fieldErrors?: FieldError[];

  constructor(status: number, code: string, detail?: string, fieldErrors?: FieldError[]) {
    const message = detail || codeToMessage(code) || `Request failed with status ${status}`;
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.detail = message;
    this.fieldErrors = fieldErrors;
  }
}

const ERROR_CODE_MESSAGES: Record<string, string> = {
  UNAUTHORIZED: "Your session has expired. Please log in again.",
  FORBIDDEN: "You do not have permission to perform this action.",
  NOT_FOUND: "The requested resource could not be found.",
  CONFLICT: "The action conflicts with current state.",
  VALIDATION_ERROR: "One or more inputs failed validation.",
  CONTACT_NOT_VERIFIED: "This contact has not verified their consent yet.",
  INSTALLMENT_NOT_FOUND: "Loan installment not found.",
  PAUSE_TOO_LONG: "Monitoring pause duration exceeds maximum limit.",
  RATE_LIMIT_EXCEEDED: "Too many attempts. Please wait a moment before trying again.",
  OTP_LOCKED_OUT: "Too many failed attempts. Link is temporarily locked for 15 minutes.",
  FEATURE_DISABLED: "This integration feature is currently disabled.",
  GROWW_AUTH_EXPIRED: "Groww authorization has expired. Please re-authenticate.",
  INTERNAL_SERVER_ERROR: "An unexpected server error occurred. Please try again later.",
};

export function codeToMessage(code: string, fallback?: string): string {
  if (code in ERROR_CODE_MESSAGES) {
    return ERROR_CODE_MESSAGES[code]!;
  }
  return fallback || "An unexpected error occurred.";
}

/**
 * Unwrap an openapi-fetch response, returning data or throwing an ApiError.
 */
export function unwrap<T>(result: {
  data?: T;
  error?: ProblemDetailResponse | unknown;
  response: Response;
}): T {
  if (result.error || !result.response.ok) {
    const res = result.response;
    const err = result.error as ProblemDetailResponse | undefined;

    const code =
      err?.code ||
      (res.status === 422
        ? "VALIDATION_ERROR"
        : res.status === 401
          ? "UNAUTHORIZED"
          : "HTTP_ERROR");
    let detail = "";
    let fieldErrors = err?.errors;

    if (Array.isArray(err?.detail)) {
      fieldErrors = (err.detail as Array<{ loc?: (string | number)[]; msg?: string }>).map((d) => ({
        field:
          Array.isArray(d.loc) && d.loc.length > 0 ? String(d.loc[d.loc.length - 1]) : "general",
        message: d.msg || "Invalid value",
      }));
      detail = fieldErrors.map((f) => `${f.field}: ${f.message}`).join(", ");
    } else if (typeof err?.detail === "string") {
      detail = err.detail;
    } else if (typeof (err as { message?: string })?.message === "string") {
      detail = (err as { message: string }).message;
    } else {
      detail = res.statusText || codeToMessage(code);
    }

    throw new ApiError(res.status, code, detail, fieldErrors);
  }

  if (result.data === undefined) {
    throw new ApiError(result.response.status, "EMPTY_RESPONSE", "Server returned no data");
  }

  return result.data;
}
