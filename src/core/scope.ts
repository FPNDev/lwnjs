/**
 * Render scopes give every synchronous render pass a deterministic key, so
 * the n-th view created in scope `r.0` on the server is the n-th view created
 * in scope `r.0` on the client, whatever order async page loads resolve in.
 */
export type RenderScope = {
  readonly key: string;
  /** Views created so far in this scope. */
  created: number;
  /** Child scopes (outlets) created so far in this scope. */
  children: number;
};

let current: RenderScope | undefined;

/**
 * Runs `render` inside a new scope with `key`.
 * @param key Scope key.
 * @param render Synchronous render pass.
 * @returns What `render` returns.
 */
export function withScope<T>(key: string, render: () => T): T {
  const previous = current;
  current = { key, created: 0, children: 0 };
  try {
    return render();
  } finally {
    current = previous;
  }
}

/** @returns The scope of the running render pass, if any. */
export function currentScope() {
  return current;
}

/** @returns A key for a child scope of the running one, or `undefined` outside any scope. */
export function nextScopeKey() {
  return current ? `${current.key}.${current.children++}` : undefined;
}

let pending = 0;
let waiters: (() => void)[] = [];

/**
 * Counts `promise` as pending work until it settles. O(1).
 * @param promise Work to track.
 * @returns The same promise.
 */
export function trackPending<T>(promise: Promise<T>) {
  pending++;
  const settle = () => {
    pending--;
    if (pending === 0) {
      const resolved = waiters;
      waiters = [];
      for (const resolve of resolved) {
        resolve();
      }
    }
  };
  promise.then(settle, settle);

  return promise;
}

const nextIdle = () =>
  new Promise<void>((resolve) => {
    waiters.push(resolve);
  });

const nextTask = () =>
  new Promise((resolve) => {
    setTimeout(resolve);
  });

/** Resolves once no tracked work is pending, including work started by work that just finished. */
export async function whenSettled() {
  while (pending > 0) {
    await nextIdle();
    await nextTask();
  }
}
