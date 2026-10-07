/** Tracks view creation so server and client renders can claim matching views. */
export type HydrationContext = {
  readonly key: string;
  /** Views created under this key. */
  created: number;
  /** Outlet contexts created under this key. */
  children: number;
};

let current: HydrationContext | undefined;

/** Runs a render pass in a new hydration context. */
export function withHydration<T>(key: string, render: () => T): T {
  const previous = current;
  current = { key, created: 0, children: 0 };
  try {
    return render();
  } finally {
    current = previous;
  }
}

/** Returns the active hydration context, if any. */
export function hydrationContext() {
  return current;
}

/** Returns the next outlet key, or `undefined` outside hydration. */
export function nextHydrationKey() {
  return current ? `${current.key}.${current.children++}` : undefined;
}

let pending = 0;
let waiters: (() => void)[] = [];

/** Tracks pending work until the promise settles. */
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

/** Resolves after all tracked work, including nested work, settles. */
export async function whenSettledHydration() {
  while (pending > 0) {
    await nextIdle();
    await nextTask();
  }
}
