import { ensureLogicalRecord } from './tree.ts';

export const componentFrames = new WeakMap<object, object>();

/** Returns a controller's frame, or the logical node itself. */
export function frameOf(logicalNode: object) {
  return componentFrames.get(logicalNode) ?? logicalNode;
}

let current: { value: object } | undefined;

/** Runs setup with `frame` active for synchronous engine calls. */
export function runInFrame<T>(frame: object | undefined, setup: () => T): T {
  const previous = current;
  current = frame === undefined ? frame : { value: frame };
  try {
    return setup();
  } finally {
    current = previous;
  }
}

/** Binds a callback to `frame`. */
export function bindFrame<TThis, TArgs extends unknown[], TResult>(
  frame: object | undefined,
  callback: (this: TThis, ...args: TArgs) => TResult,
): (this: TThis, ...args: TArgs) => TResult {
  if (!frame) {
    return callback;
  }

  return function (this: TThis, ...args: TArgs) {
    return runInFrame(frame, () => callback.apply(this, args));
  };
}
/** Returns the active frame, if any. */
export function getFrame() {
  return current?.value;
}

/** Requires an active frame and names `api` in the error if absent. */
export function requireFrame(api?: string) {
  const frame = current?.value;
  if (frame === undefined) {
    throw new Error(
      `${api ? `${api}: ` : ''}no frame here. Call it during setup (inside component(), withFrame(), a page, a route action or onAttach), or pass the frame explicitly.`,
    );
  }

  return frame;
}

/** Ensures a record for the active frame, then runs setup there. */
export function withFrame<T>(setup: () => T): T;
/** Ensures a record for `frame`, then runs setup there. */
export function withFrame<T>(frame: object, setup: () => T): T;
export function withFrame<T>(
  frameOrSetup: object | (() => T),
  maybeSetup?: () => T,
): T {
  const setup = maybeSetup ?? (frameOrSetup as () => T);
  const frame = maybeSetup
    ? frameOf(frameOrSetup as object)
    : requireFrame('withFrame');

  ensureLogicalRecord(frame);

  return runInFrame(frame, setup);
}
