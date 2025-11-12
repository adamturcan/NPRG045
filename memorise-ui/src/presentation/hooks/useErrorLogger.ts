import { useCallback } from 'react';
import type { ErrorContext, AppError } from '../../infrastructure/services/ErrorHandlingService';
import { errorHandlingService } from '../../infrastructure/services/ErrorHandlingService';

export function useErrorLogger(baseContext?: ErrorContext) {
  return useCallback(
    (error: unknown, context?: ErrorContext): AppError => {
      const mergedContext = {
        ...baseContext,
        ...context,
      };
      const appError = errorHandlingService.handleApiError(error, mergedContext);
      errorHandlingService.logError(appError, mergedContext);
      return appError;
    },
    [baseContext]
  );
}


