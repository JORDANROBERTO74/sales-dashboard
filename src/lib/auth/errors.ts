/**
 * Authentication error types
 */
export enum AuthErrorType {
  UNAUTHENTICATED = "UNAUTHENTICATED",
  UNAUTHORIZED = "UNAUTHORIZED",
  INVALID_SESSION = "INVALID_SESSION",
  PROFILE_NOT_FOUND = "PROFILE_NOT_FOUND",
  DATABASE_ERROR = "DATABASE_ERROR",
  CONFIGURATION_ERROR = "CONFIGURATION_ERROR",
}

/**
 * Custom authentication error class
 */
export class AuthError extends Error {
  constructor(
    public type: AuthErrorType,
    message: string,
    public statusCode: number = 401,
    public cause?: unknown
  ) {
    super(message);
    this.name = "AuthError";
  }
}

/**
 * Error factory functions for common auth errors
 */
export const AuthErrors = {
  unauthenticated: (message = "User is not authenticated") =>
    new AuthError(AuthErrorType.UNAUTHENTICATED, message, 401),

  unauthorized: (message = "User does not have permission") =>
    new AuthError(AuthErrorType.UNAUTHORIZED, message, 403),

  invalidSession: (message = "Invalid or expired session") =>
    new AuthError(AuthErrorType.INVALID_SESSION, message, 401),

  profileNotFound: (message = "User profile not found") =>
    new AuthError(AuthErrorType.PROFILE_NOT_FOUND, message, 404),

  databaseError: (message = "Database error occurred", cause?: unknown) =>
    new AuthError(AuthErrorType.DATABASE_ERROR, message, 500, cause),

  configurationError: (message = "Server configuration error") =>
    new AuthError(AuthErrorType.CONFIGURATION_ERROR, message, 500),
};

/**
 * Maps Supabase AuthApiError messages to user-friendly Spanish messages
 */
function getSupabaseErrorMessage(error: Error): string {
  const errorMessage = error.message.toLowerCase();

  // Invalid login credentials
  if (
    errorMessage.includes("invalid login credentials") ||
    errorMessage.includes("invalid_credentials") ||
    errorMessage.includes("email not confirmed")
  ) {
    return "Email o contraseña incorrectos";
  }

  // Email already exists
  if (
    errorMessage.includes("user already registered") ||
    errorMessage.includes("email already exists")
  ) {
    return "Este email ya está registrado";
  }

  // Email not confirmed
  if (
    errorMessage.includes("email not confirmed") ||
    errorMessage.includes("signup_disabled")
  ) {
    return "Por favor confirma tu email antes de iniciar sesión";
  }

  // Weak password
  if (
    errorMessage.includes("password") &&
    (errorMessage.includes("weak") || errorMessage.includes("too short"))
  ) {
    return "La contraseña es demasiado débil";
  }

  // Rate limiting
  if (
    errorMessage.includes("too many requests") ||
    errorMessage.includes("rate limit")
  ) {
    return "Demasiados intentos. Por favor intenta más tarde";
  }

  // Network errors
  if (
    errorMessage.includes("network") ||
    errorMessage.includes("fetch") ||
    errorMessage.includes("connection")
  ) {
    return "Error de conexión. Verifica tu internet";
  }

  // Session errors
  if (
    errorMessage.includes("session") ||
    errorMessage.includes("jwt") ||
    errorMessage.includes("token")
  ) {
    return "Tu sesión ha expirado. Por favor inicia sesión nuevamente";
  }

  // Default: return original message or generic error
  return error.message || "Ocurrió un error inesperado";
}

/**
 * Safely extracts error message from unknown error type
 * Translates Supabase errors to user-friendly Spanish messages
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof AuthError) {
    return error.message;
  }
  if (error instanceof Error) {
    // Check if it's a Supabase AuthApiError
    if (
      error.name === "AuthApiError" ||
      error.constructor.name === "AuthApiError"
    ) {
      return getSupabaseErrorMessage(error);
    }
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return "Ocurrió un error inesperado";
}

/**
 * Checks if error is an authentication error
 */
export function isAuthError(error: unknown): error is AuthError {
  return error instanceof AuthError;
}

/**
 * Checks if an error is expected (user-facing, non-critical)
 * These errors don't need to be logged in production as they're expected user behavior
 */
function isExpectedError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const errorMessage = error.message.toLowerCase();
  const errorName = error.name.toLowerCase();

  // Expected user-facing errors (don't log in production)
  const expectedErrors = [
    "invalid login credentials",
    "invalid_credentials",
    "authsessionmissingerror",
    "user already registered",
    "email already exists",
    "passwords do not match",
    "las contraseñas no coinciden",
    "email not confirmed",
    "weak password",
    "too short",
  ];

  return (
    expectedErrors.some(
      (expected) =>
        errorMessage.includes(expected) || errorName.includes(expected)
    ) ||
    // Supabase AuthApiError with common expected statuses
    (errorName.includes("authapierror") &&
      (errorMessage.includes("invalid") || errorMessage.includes("already")))
  );
}

/**
 * Logs authentication errors with appropriate detail level.
 * - In development: logs all errors for debugging
 * - In production: only logs unexpected/critical errors (not user-facing errors)
 *
 * This prevents console noise from expected errors (like wrong password)
 * while still capturing important errors for debugging.
 */
export function logAuthError(error: unknown, context?: string): void {
  const prefix = context ? `[Auth:${context}]` : "[Auth]";
  const isDev = process.env.NODE_ENV === "development";

  // In development, log everything for debugging
  if (isDev) {
    if (error instanceof AuthError) {
      console.error(`${prefix} ${error.type}: ${error.message}`, {
        statusCode: error.statusCode,
        cause: error.cause,
      });
    } else if (error instanceof Error) {
      console.error(`${prefix} Error: ${error.message}`, {
        stack: error.stack,
      });
    } else {
      console.error(`${prefix} Unknown error:`, error);
    }
    return;
  }

  // In production, only log unexpected/critical errors
  if (isExpectedError(error)) {
    // Don't log expected user-facing errors (like wrong password)
    // These are normal user behavior and would create console noise
    return;
  }

  // Log critical or unexpected errors in production
  if (error instanceof AuthError) {
    console.error(`${prefix} ${error.type}: ${error.message}`, {
      statusCode: error.statusCode,
      cause: error.cause,
    });
  } else if (error instanceof Error) {
    console.error(`${prefix} Error: ${error.message}`);
    // In production, don't expose stack traces in console
    // But you might want to send them to a logging service like Sentry
  } else {
    console.error(`${prefix} Unknown error:`, error);
  }
}
