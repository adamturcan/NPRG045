export interface AppError {
  message: string;
  code?: string;
  cause?: unknown;
  context?: Record<string, unknown>;
  severity?: "info" | "warn" | "error" | "critical";
}

export interface ErrorContext extends Record<string, unknown> {
  userMessage?: string;
  operation?: string;
}

type NormalisedOptions = {
  defaultSeverity?: AppError["severity"];
  defaultCode?: string;
  defaultMessage?: string;
  context?: ErrorContext;
  cause?: unknown;
};

const NETWORK_ERROR_PHRASES = ["Failed to fetch", "NetworkError"];
const APP_ERROR_FLAG = Symbol("AppError");

export class ErrorHandlingService {
  createAppError(options: {
    message: string;
    code: string;
    severity?: AppError["severity"];
    context?: ErrorContext;
    cause?: unknown;
  }): AppError {
    return this.markAppError({
      message: options.message,
      code: options.code,
      severity: options.severity,
      context: this.mergeContexts(options.context),
      cause: options.cause,
    });
  }

  handleApiError(error: unknown, context?: ErrorContext): AppError {
    if (this.isAppError(error)) {
      return this.mergeContext(error, context);
    }

    if (this.isFetchResponse(error)) {
      return this.normalise(error, {
        defaultSeverity: "error",
        defaultCode: `HTTP_${error.status}`,
        defaultMessage: this.responseMessage(error, context),
        context,
        cause: error,
      });
    }

    if (this.isAbortError(error)) {
      return this.normalise(error, {
        defaultSeverity: "warn",
        defaultCode: "REQUEST_ABORTED",
        defaultMessage: this.operationMessage(context, "Request was cancelled."),
        context,
      });
    }

    if (this.isNetworkError(error)) {
      return this.normalise(error, {
        defaultSeverity: "error",
        defaultCode: "NETWORK_ERROR",
        defaultMessage: this.operationMessage(
          context,
          "Network error. Check your connection and try again."
        ),
        context,
      });
    }

    return this.normalise(error, {
      defaultSeverity: "error",
      defaultCode: "API_ERROR",
      defaultMessage: this.operationMessage(
        context,
        "Something went wrong while communicating with the server."
      ),
      context,
    });
  }

  handleValidationError(error: unknown, context?: ErrorContext): AppError {
    if (this.isAppError(error)) {
      return this.mergeContext(
        {
          ...error,
          severity: error.severity ?? "warn",
          code: error.code ?? "VALIDATION_ERROR",
        },
        context
      );
    }

    return this.normalise(error, {
      defaultSeverity: "warn",
      defaultCode: "VALIDATION_ERROR",
      defaultMessage: this.operationMessage(
        context,
        "Please review the entered information."
      ),
      context,
    });
  }

  async withRepositoryError<T>(
    context: ErrorContext | undefined,
    fn: () => Promise<T> | T
  ): Promise<T> {
    try {
      return await Promise.resolve(fn());
    } catch (error) {
      const appError = this.wrapRepositoryError(error, context);
      throw appError;
    }
  }

  wrapRepositoryError(error: unknown, context?: ErrorContext): AppError {
    const repositoryContext = this.mergeContexts(context, { layer: 'repository' });

    if (this.isAppError(error)) {
      return this.mergeContext(
        {
          ...error,
          code: error.code ?? 'REPOSITORY_ERROR',
          severity: error.severity ?? 'error',
        },
        repositoryContext
      );
    }

    return this.normalise(error, {
      defaultSeverity: 'error',
      defaultCode: 'REPOSITORY_ERROR',
      defaultMessage: this.operationMessage(
        repositoryContext,
        'Unable to complete repository operation.'
      ),
      context: repositoryContext,
      cause: error,
    });
  }

  logError(error: unknown, context?: ErrorContext): void {
    const appError = this.isAppError(error)
      ? this.mergeContext(error, context)
      : this.normalise(error, {
          defaultSeverity: "error",
          defaultCode: "UNHANDLED_ERROR",
          defaultMessage: this.operationMessage(
            context,
            "An unexpected error occurred."
          ),
          context,
        });

    const { message, code, severity, context: ctx, cause } = appError;

    console.error("[ErrorHandlingService]", {
      message,
      code,
      severity,
      context: ctx,
      cause,
    });

    // TODO: Forward logs to remote telemetry service when available.
  }

  isAppError(value: unknown): value is AppError {
    return (
      typeof value === "object" &&
      value !== null &&
      (value as { [APP_ERROR_FLAG]?: unknown })[APP_ERROR_FLAG] === true
    );
  }

  private normalise(error: unknown, options: NormalisedOptions): AppError {
    if (this.isAppError(error)) {
      return this.mergeContext(
        {
          ...error,
          severity: error.severity ?? options.defaultSeverity,
          code: error.code ?? options.defaultCode,
        },
        options.context
      );
    }

    if (typeof error === "string") {
      return this.markAppError({
        message: options.defaultMessage ?? error,
        code: options.defaultCode,
        severity: options.defaultSeverity,
        context: this.mergeContexts(options.context),
      });
    }

    if (this.isErrorLike(error)) {
      const name = this.extractErrorName(error);
      return this.markAppError({
        message: options.defaultMessage ?? error.message,
        code: options.defaultCode ?? name,
        severity: options.defaultSeverity,
        context: this.mergeContexts(options.context),
        cause: options.cause ?? error,
      });
    }

    return this.markAppError({
      message: options.defaultMessage ?? "An unexpected error occurred.",
      code: options.defaultCode,
      severity: options.defaultSeverity,
      context: this.mergeContexts({
        ...options.context,
        receivedType: typeof error,
      }),
      cause: options.cause ?? error,
    });
  }

  private mergeContext(error: AppError, context?: ErrorContext): AppError {
    if (!context) {
      return error;
    }

    const mergedContext = this.mergeContexts(error.context, context);
    return this.markAppError({
      ...error,
      context: mergedContext,
    });
  }

  private mergeContexts(
    ...contexts: Array<Record<string, unknown> | undefined>
  ): Record<string, unknown> | undefined {
    const filtered = contexts.filter(
      (ctx): ctx is Record<string, unknown> => Boolean(ctx)
    );

    if (filtered.length === 0) {
      return undefined;
    }

    return filtered.reduce<Record<string, unknown>>(
      (acc, ctx) => ({ ...acc, ...ctx }),
      {}
    );
  }

  private responseMessage(response: Response, context?: ErrorContext): string {
    const fallback = `Server responded with ${response.status}${
      response.statusText ? ` (${response.statusText})` : ""
    }.`;
    return this.operationMessage(context, fallback);
  }

  private operationMessage(
    context: ErrorContext | undefined,
    fallback: string
  ): string {
    if (context?.userMessage && typeof context.userMessage === "string") {
      return context.userMessage;
    }

    const operation =
      typeof context?.operation === "string" ? context.operation : null;

    if (operation) {
      return `Unable to ${operation}. Please try again.`;
    }

    return fallback;
  }

  private isFetchResponse(value: unknown): value is Response {
    if (typeof Response !== "undefined" && value instanceof Response) {
      return true;
    }

    return (
      typeof value === "object" &&
      value !== null &&
      "ok" in value &&
      "status" in value &&
      typeof (value as { ok: unknown }).ok === "boolean" &&
      typeof (value as { status: unknown }).status === "number"
    );
  }

  private isAbortError(error: unknown): error is DOMException {
    return (
      typeof DOMException !== "undefined" &&
      error instanceof DOMException &&
      error.name === "AbortError"
    );
  }

  private isNetworkError(error: unknown): boolean {
    if (this.isErrorLike(error)) {
      const message = error.message ?? "";
      if (
        typeof message === "string" &&
        NETWORK_ERROR_PHRASES.some((phrase) => message.includes(phrase))
      ) {
        return true;
      }

      const name = this.extractErrorName(error);
      if (name && NETWORK_ERROR_PHRASES.includes(name)) {
        return true;
      }
    }

    if (typeof error === "string") {
      return NETWORK_ERROR_PHRASES.some((phrase) => error.includes(phrase));
    }

    return false;
  }

  private isErrorLike(value: unknown): value is { message: string; name?: unknown } {
    return (
      typeof value === "object" &&
      value !== null &&
      "message" in value &&
      typeof (value as { message?: unknown }).message === "string"
    );
  }

  private extractErrorName(value: { name?: unknown }): string | undefined {
    return typeof value.name === "string" ? value.name : undefined;
  }

  private markAppError(error: AppError): AppError {
    Object.defineProperty(error, APP_ERROR_FLAG, {
      value: true,
      enumerable: false,
      configurable: false,
      writable: false,
    });
    return error;
  }
}

export const errorHandlingService = new ErrorHandlingService();


