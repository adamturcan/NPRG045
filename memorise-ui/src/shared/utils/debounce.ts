/**
 * Creates a debounced function that returns a promise resolving to the result
 * of the original function. Useful for async operations that should be debounced.
 *
 * @param func - The async function to debounce
 * @param wait - The number of milliseconds to delay
 * @returns A debounced version of the function that returns a promise
 */
export function debounceAsync<T extends (...args: any[]) => Promise<any>>(
  func: T,
  wait: number
): (...args: Parameters<T>) => Promise<ReturnType<T>> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let resolvePromise: ((value: ReturnType<T>) => void) | null = null;
  let rejectPromise: ((error: any) => void) | null = null;

  return function debounced(...args: Parameters<T>): Promise<ReturnType<T>> {
    return new Promise<ReturnType<T>>((resolve, reject) => {
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
        // Cancel previous promise if it hasn't resolved yet
        if (rejectPromise) {
          rejectPromise(new Error('Debounced: cancelled by subsequent call'));
        }
      }

      resolvePromise = resolve;
      rejectPromise = reject;

      timeoutId = setTimeout(async () => {
        try {
          const result = await func(...args);
          if (resolvePromise) {
            resolvePromise(result);
          }
        } catch (error) {
          if (rejectPromise) {
            rejectPromise(error);
          }
        } finally {
          resolvePromise = null;
          rejectPromise = null;
        }
      }, wait);
    });
  };
}

