/**
 * Runs a callback, rethrowing any error asynchronously so one failing
 * callback never stops the ones after it.
 * @param callback Callback to run.
 */
export function runIsolated(callback: () => void) {
  try {
    callback();
  } catch (error) {
    queueMicrotask(() => {
      throw error;
    });
  }
}
