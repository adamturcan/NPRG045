export interface AppError {
  message: string;
  code?: string;
  cause?: unknown;
  context?: Record<string, unknown>;
  severity?: "info" | "warn" | "error" | "critical";
  __isAppError?: true; 
}

export interface ErrorContext extends Record<string, unknown> {
  userMessage?: string;
  operation?: string;
}

export class ErrorHandlingService {
  // Creates a new AppError from provided options with explicit error details
  createAppError(options: {
    message: string;
    code: string;
    severity?: AppError["severity"];
    context?: ErrorContext;
    cause?: unknown;
  }): AppError {
    return {
      message: options.message,
      code: options.code,
      severity: options.severity,
      context: options.context,
      cause: options.cause,
      __isAppError: true,
    };
  }

  // Normalizes unknown errors into AppError format, handling HTTP responses, network errors, and aborted requests
  handleApiError(error: unknown, context?: ErrorContext): AppError {
    // If already an AppError, merge context and return
    if (this.isAppError(error)) {
      return { ...error, context: { ...error.context, ...context } };
    }

    // Handle HTTP Response errors (non-ok responses)
    if (error instanceof Response) {
      return this.createAppError({
        message: this.getMessage(context, `Server responded with ${error.status}${error.statusText ? ` (${error.statusText})` : ""}`),
        code: `HTTP_${error.status}`,
        severity: "error",
        context,
        cause: error,
      });
    }

    // Handle aborted requests (user cancelled)
    if (error instanceof DOMException && error.name === "AbortError") {
      return this.createAppError({
        message: this.getMessage(context, "Request was cancelled."),
        code: "REQUEST_ABORTED",
        severity: "warn",
        context,
      });
    }

    // Detect network connectivity errors
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isNetworkError = 
      errorMessage.includes("Failed to fetch") || 
      errorMessage.includes("NetworkError") ||
      (error instanceof TypeError && errorMessage.includes("fetch"));

    // Handle network errors with user-friendly message
    if (isNetworkError) {
      return this.createAppError({
        message: this.getMessage(context, "Network error. Check your connection and try again."),
        code: "NETWORK_ERROR",
        severity: "error",
        context,
        cause: error,
      });
    }

    // Default case: generic API error with error message or fallback
    const fallbackMessage = error instanceof Error && error.message 
      ? error.message 
      : "Something went wrong while communicating with the server.";

    return this.createAppError({
      message: this.getMessage(context, fallbackMessage),
      code: "API_ERROR",
      severity: "error",
      context,
      cause: error,
    });
  }

  // Converts validation errors to AppError with warning severity
  handleValidationError(error: unknown, context?: ErrorContext): AppError {
    // If already an AppError, ensure validation defaults and merge context
    if (this.isAppError(error)) {
      return {
        ...error,
        severity: error.severity ?? "warn",
        code: error.code ?? "VALIDATION_ERROR",
        context: { ...error.context, ...context },
      };
    }

    // Extract message from error (Error.message, string, or default)
    const message = 
      error instanceof Error ? error.message : 
      typeof error === "string" ? error : 
      "Please review the entered information.";

    return this.createAppError({
      message: this.getMessage(context, message),
      code: "VALIDATION_ERROR",
      severity: "warn",
      context,
      cause: error,
    });
  }

  // Wraps repository errors with repository layer context
  wrapRepositoryError(error: unknown, context?: ErrorContext): AppError {
    // Add repository layer to context for error tracking
    const repositoryContext = { ...context, layer: 'repository' };

    // If already an AppError, preserve it but add repository context
    if (this.isAppError(error)) {
      return {
        ...error,
        code: error.code ?? 'REPOSITORY_ERROR',
        severity: error.severity ?? 'error',
        context: { ...error.context, ...repositoryContext },
      };
    }

    // Extract message from error for new AppError creation
    const message = error instanceof Error ? error.message : String(error);

    return this.createAppError({
      message: this.getMessage(repositoryContext, message || 'Unable to complete repository operation.'),
      code: 'REPOSITORY_ERROR',
      severity: 'error',
      context: repositoryContext,
      cause: error,
    });
  }

  // Wraps repository operations, catching and normalizing any errors
  async withRepositoryError<T>(
    context: ErrorContext | undefined,
    fn: () => Promise<T> | T
  ): Promise<T> {
    try {
      return await Promise.resolve(fn());
    } catch (error) {
      // Wrap any thrown error as a repository error
      throw this.wrapRepositoryError(error, context);
    }
  }

  // Logs errors to console, normalizing if needed
  logError(error: unknown, context?: ErrorContext): void {
    // Normalize to AppError if needed, then log structured error details
    const appError = this.isAppError(error)
      ? { ...error, context: { ...error.context, ...context } }
      : this.createAppError({
          message: this.getMessage(context, error instanceof Error ? error.message : "An unexpected error occurred."),
          code: "UNHANDLED_ERROR",
          severity: "error",
          context,
          cause: error,
        });

    // Output structured error to console
    console.error("[ErrorHandlingService]", {
      message: appError.message,
      code: appError.code,
      severity: appError.severity,
      context: appError.context,
      cause: appError.cause,
    });

    // TODO: Forward logs to remote telemetry service when available.
  }

  // Type guard to check if value is an AppError instance
  isAppError(value: unknown): value is AppError {
    return (
      typeof value === "object" &&
      value !== null &&
      "__isAppError" in value &&
      value.__isAppError === true
    );
  }

  // Generates user-friendly error message from context (userMessage > operation > fallback)
  private getMessage(context: ErrorContext | undefined, fallback: string): string {
    // Prefer explicit user message if provided
    if (context?.userMessage && typeof context.userMessage === "string") {
      return context.userMessage;
    }

    // Generate message from operation context if available
    const operation = typeof context?.operation === "string" ? context.operation : null;
    if (operation) {
      return `Unable to ${operation}. Please try again.`;
    }

    // Fall back to provided default message
    return fallback;
  }
}

export const errorHandlingService = new ErrorHandlingService();
