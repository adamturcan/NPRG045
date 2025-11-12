import { createTimer, withTiming } from '@/shared/perf/timer';

describe('timer', () => {
  it('measures elapsed time using provided clock', () => {
    let current = 0;
    const clock = () => current;
    const timer = createTimer('test', { autoStart: false, clock });

    timer.start();
    current = 25;
    expect(timer.elapsed()).toBe(25);
    current = 50;
    expect(timer.stop()).toBe(50);
  });

  it('invokes logger when threshold is met', () => {
    const calls: Array<{ elapsedMs: number }> = [];
    let current = 0;
    const clock = () => current;
    const timer = createTimer('threshold', {
      autoStart: true,
      thresholdMs: 10,
      clock,
      logger: (event) => calls.push({ elapsedMs: event.elapsedMs }),
    });

    current = 5;
    timer.stop();
    expect(calls).toHaveLength(0);

    current = 0;
    timer.start();
    current = 25;
    timer.stop();
    expect(calls).toHaveLength(1);
    expect(calls[0].elapsedMs).toBe(25);
  });

  it('withTiming reports elapsed duration', async () => {
    let current = 0;
    const clock = () => current;
    const { result, elapsedMs } = await withTiming(
      'async',
      async () => {
        current = 42;
        return 'done';
      },
      { clock }
    );

    expect(result).toBe('done');
    expect(elapsedMs).toBe(42);
  });
});

