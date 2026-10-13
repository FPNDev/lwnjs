/** Rethrows `error` in a microtask so the current dispatch can continue. */
export function report(error: unknown) {
  queueMicrotask(() => {
    throw error;
  });
}
