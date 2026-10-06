/**
 * Setup frames give owner-taking APIs an implicit owner. A frame is opened by
 * `component()`, by outlets around page factories, by the router around route
 * actions and by `onAttach` around its hooks. The first node attached inside a
 * frame becomes its owner, unless the frame was opened with one.
 */
type Frame = { owner?: object };

let frame: Frame | undefined;

/**
 * Runs `setup` in a new frame.
 * @param owner Owner of the frame, or `undefined` to take the first attached node.
 * @param setup Synchronous setup.
 * @returns What `setup` returns.
 */
export function runInFrame<T>(owner: object | undefined, setup: () => T): T {
  const previous = frame;
  frame = { owner };
  try {
    return setup();
  } finally {
    frame = previous;
  }
}

/**
 * Wraps a component so it gets its own frame: inside it, the first
 * `attach(parent, node)` makes `node` the owner of every owner-less call
 * (`listen(target, …)`, `x.subscribe(fn)`, `router.route(Route, …)`,
 * `useStore(Store)`, `onDestroy(fn)` …). Pages shown by outlets, route actions
 * and `onAttach` hooks get a frame without it.
 * @param setup The component function.
 * @returns The same function, running in its own frame.
 */
export function component<A extends unknown[], R>(
  setup: (...args: A) => R,
): (...args: A) => R {
  return (...args) => runInFrame(undefined, () => setup(...args));
}

/** Called by `attach`: the first attached node becomes the frame's owner. */
export function claimOwner(node: object) {
  if (frame && !frame.owner) {
    frame.owner = node;
  }
}

/**
 * The owner of the running setup, if any. Capture it to use the owner after an `await`.
 * @returns The current owner.
 */
export function getOwner() {
  return frame?.owner;
}

/**
 * @param api Name of the calling API, for the error.
 * @returns The current owner.
 * @throws Outside any frame, or before anything was attached in it.
 */
export function requireOwner(api: string) {
  const owner = frame?.owner;
  if (!owner) {
    throw new Error(
      `${api}: no owner here. Call it during setup (inside component(), a page, a route action or onAttach, after attach(parent, node)), or pass the owner explicitly.`,
    );
  }

  return owner;
}
