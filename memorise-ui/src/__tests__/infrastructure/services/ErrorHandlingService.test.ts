import { describe, it, expect, vi, afterEach } from "vitest";

import {
  errorHandlingService,
  type AppError,
} from '@/infrastructure/services/ErrorHandlingService';

describe("ErrorHandlingService", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("normalises failed HTTP responses", () => {
    const response = new Response(null, {
      status: 503,
      statusText: "Service Unavailable",
    });

    const appError = errorHandlingService.handleApiError(response, {
      operation: "fetch data",
      endpoint: "/api/resource",
    });

    expect(appError.message).toBe(
      "Unable to fetch data. Please try again."
    );
    expect(appError.code).toBe("HTTP_503");
    expect(appError.severity).toBe("error");
    expect(appError.cause).toBe(response);
    expect(appError.context).toMatchObject({
      operation: "fetch data",
      endpoint: "/api/resource",
    });
  });

  it("marks network failures with dedicated code", () => {
    const appError = errorHandlingService.handleApiError(
      new TypeError("Failed to fetch"),
      { operation: "load configuration" }
    );

    expect(appError.code).toBe("NETWORK_ERROR");
    expect(appError.message).toBe(
      "Unable to load configuration. Please try again."
    );
    expect(appError.severity).toBe("error");
  });

  it("handles validation errors with warning severity", () => {
    const appError = errorHandlingService.handleValidationError(
      "Invalid payload",
      { operation: "submit form", field: "name" }
    );

    expect(appError.code).toBe("VALIDATION_ERROR");
    expect(appError.severity).toBe("warn");
    expect(appError.message).toBe(
      "Unable to submit form. Please try again."
    );
    expect(appError.context).toMatchObject({
      operation: "submit form",
      field: "name",
    });
  });

  it("merges contexts when an AppError is re-handled", () => {
    const initial = errorHandlingService.handleApiError(
      new Error("Boom"),
      { operation: "initial operation" }
    );

    const merged = errorHandlingService.handleApiError(initial, {
      retry: true,
    });

    expect(merged.context).toMatchObject({
      operation: "initial operation",
      retry: true,
    });
    expect(merged.message).toBe(
      "Unable to initial operation. Please try again."
    );
  });

  it("logs errors to console", () => {
    const consoleSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    errorHandlingService.logError(new Error("Unexpected failure"), {
      operation: "perform task",
      component: "unit-test",
    });

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    const [label, payload] = consoleSpy.mock.calls[0] as [
      string,
      AppError
    ];

    expect(label).toBe("[ErrorHandlingService]");
    expect(payload).toMatchObject({
      code: "UNHANDLED_ERROR",
      severity: "error",
      context: {
        operation: "perform task",
        component: "unit-test",
      },
    });
    expect(typeof payload.message).toBe("string");
  });

  it("creates custom AppError instances with explicit codes", () => {
    const appError = errorHandlingService.createAppError({
      message: "Custom failure",
      code: "CUSTOM_ERROR",
      severity: "warn",
      context: { source: "test" },
    });

    expect(errorHandlingService.isAppError(appError)).toBe(true);
    expect(appError).toMatchObject({
      message: "Custom failure",
      code: "CUSTOM_ERROR",
      severity: "warn",
      context: { source: "test" },
    });
  });

  it("wraps repository errors with default metadata", () => {
    const appError = errorHandlingService.wrapRepositoryError(new Error("storage failed"), {
      operation: "save workspace",
      repository: "TestRepository",
    });

    expect(appError).toMatchObject({
      code: "REPOSITORY_ERROR",
      severity: "error",
      context: {
        operation: "save workspace",
        repository: "TestRepository",
        layer: "repository",
      },
    });
    expect(appError.message).toBe(
      "Unable to save workspace. Please try again."
    );
  });

  it("reuses repository AppErrors without losing context", async () => {
    const existing = errorHandlingService.createAppError({
      message: "Custom storage failure",
      code: "CUSTOM_REPO_ERROR",
      severity: "warn",
    });

    await expect(
      errorHandlingService.withRepositoryError(
        { operation: "persist data" },
        () => {
          throw existing;
        }
      )
    ).rejects.toMatchObject({
      code: "CUSTOM_REPO_ERROR",
      severity: "warn",
      context: {
        operation: "persist data",
        layer: "repository",
      },
    });
  });
});

