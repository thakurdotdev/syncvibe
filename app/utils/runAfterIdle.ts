type IdleApi = {
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
  cancelIdleCallback?: (handle: number) => void;
};

type CancellableTask = {
  cancel: () => void;
};

/** Schedule non-critical work without using deprecated InteractionManager. */
export function runAfterIdle(callback: () => void): CancellableTask {
  const idleApi = globalThis as typeof globalThis & IdleApi;
  let cancelled = false;

  if (idleApi.requestIdleCallback) {
    const handle = idleApi.requestIdleCallback(
      () => {
        if (!cancelled) callback();
      },
      { timeout: 1000 }
    );

    return {
      cancel: () => {
        cancelled = true;
        idleApi.cancelIdleCallback?.(handle);
      },
    };
  }

  const handle = setTimeout(() => {
    if (!cancelled) callback();
  }, 0);

  return {
    cancel: () => {
      cancelled = true;
      clearTimeout(handle);
    },
  };
}
