/** Reports callback errors asynchronously so dispatch can continue. */
export function runIsolated(callback: () => void) {
  try {
    callback();
  } catch (error) {
    queueMicrotask(() => {
      throw error;
    });
  }
}
