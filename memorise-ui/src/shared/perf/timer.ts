interface TimerEvent {
  label: string;
  elapsedMs: number;
  startTimeMs: number;
  endTimeMs: number;
}

type Logger = (event: TimerEvent) => void;

export interface TimerHandle {
  start(): void;
  stop(): number;
  elapsed(): number;
  reset(): void;
}

export interface TimerOptions {
  autoStart?: boolean;
  logger?: Logger | null;
  thresholdMs?: number;
  clock?: () => number;
}

const defaultClock = (): number => {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
};

const noopLogger: Logger = () => {
  // Intentionally empty – instrumentation hook for Phase 4.
};

export function createTimer(label: string, options: TimerOptions = {}): TimerHandle {
  const {
    autoStart = true,
    logger = null,
    thresholdMs = 0,
    clock = defaultClock,
  } = options;

  let startTime: number | null = null;
  let endTime: number | null = null;

  const resolvedLogger = logger ?? noopLogger;

  const maybeReport = (elapsed: number) => {
    if (elapsed < thresholdMs) return;
    resolvedLogger({
      label,
      elapsedMs: elapsed,
      startTimeMs: startTime ?? clock(),
      endTimeMs: endTime ?? clock(),
    });
  };

  const start = () => {
    startTime = clock();
    endTime = null;
  };

  const stop = () => {
    if (startTime === null) {
      start();
    }
    endTime = clock();
    const elapsed = endTime - (startTime ?? endTime);
    maybeReport(elapsed);
    return elapsed;
  };

  const elapsed = () => {
    if (startTime === null) return 0;
    const reference = endTime ?? clock();
    return reference - startTime;
  };

  const reset = () => {
    startTime = null;
    endTime = null;
  };

  if (autoStart) {
    start();
  }

  return {
    start,
    stop,
    elapsed,
    reset,
  };
}

export async function withTiming<T>(
  label: string,
  fn: () => Promise<T>,
  options?: TimerOptions
): Promise<{ result: T; elapsedMs: number }> {
  const timer = createTimer(label, { autoStart: true, ...options });
  try {
    const result = await fn();
    return { result, elapsedMs: timer.stop() };
  } catch (error) {
    timer.stop();
    throw error;
  }
}

