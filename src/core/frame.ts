import type { ComponentController } from './component.ts';
import type { Store } from './store.ts';
import type { AttachHook } from './lifecycle.ts';

/** Links a controller, or a frame itself, to its frame. */
export const FRAME = Symbol('lwn.frame');

/** Frame state: not held, not waiting, not dead. */
export const LIVE = 0;
/** Frame state bit: in setup, or a show frame before mount. */
export const HELD = 1;
/** Frame state bit: an ancestor was pending when this frame was linked. */
export const WAITING = 2;
/** Frame state bit: destroyed. */
export const DEAD = 4;
/** Either hold bit. */
export const PENDING = HELD | WAITING;

/** One destroy registration, linked into its owner's cleanup list. */
export type Cleanup = {
  /** Runs once when the owner dies. */
  dispose(): void;
  /** Owner while registered; undefined once run or unregistered. */
  owner: Frame | undefined;
  prevCleanup: Cleanup | undefined;
  nextCleanup: Cleanup | undefined;
};

/** Execution frame: a plain object that is its own logical-tree record. */
export type Frame = {
  state: number;
  parent: Frame | undefined;
  first: Frame | undefined;
  last: Frame | undefined;
  prev: Frame | undefined;
  next: Frame | undefined;
  attachHooks: AttachHook[] | undefined;
  attachFrame: Frame | undefined;
  cleanups: Cleanup | undefined;
  lastCleanup: Cleanup | undefined;
  controller: ComponentController | undefined;
  stores: Map<Store<unknown>, unknown> | undefined;
  /** Callbacks that run when the hold ends; see afterSetup(). */
  ready: (() => void)[] | undefined;
  /** The raw object this frame stands for; undefined for engine frames. */
  host: object | undefined;
  [FRAME]: Frame;
};

/** Creates a frame; every field is set here so all frames share one shape. */
export function createFrame(state: number, host?: object): Frame {
  const frame: Frame = {
    state,
    parent: undefined,
    first: undefined,
    last: undefined,
    prev: undefined,
    next: undefined,
    attachHooks: undefined,
    attachFrame: undefined,
    cleanups: undefined,
    lastCleanup: undefined,
    controller: undefined,
    stores: undefined,
    ready: undefined,
    host,
    [FRAME]: undefined as unknown as Frame,
  };
  frame[FRAME] = frame;
  return frame;
}

type Tagged = { [FRAME]?: Frame };

const frames = new WeakMap<object, Frame>();

/** Returns the frame of a controller, frame or raw object, if it has one. */
export function frameOf(node: object): Frame | undefined {
  return (node as Tagged)[FRAME] ?? frames.get(node);
}

/** Returns the frame of `node`, creating a raw frame for a plain object. */
export function ensureFrame(node: object): Frame {
  let frame = frameOf(node);
  if (!frame) {
    frame = createFrame(LIVE, node);
    frames.set(node, frame);
  }
  return frame;
}

/** Links a controller to its frame; throws if an earlier invocation bound it. */
export function tagController(controller: object, frame: Frame) {
  const extensible = Object.isExtensible(controller);
  const bound = extensible
    ? (controller as Tagged)[FRAME]
    : frames.get(controller);
  if (bound?.controller === controller) {
    throw new TypeError(
      'component(): each invocation must return a unique controller object.',
    );
  }
  if (extensible) {
    (controller as Tagged)[FRAME] = frame;
  } else {
    frames.set(controller, frame);
  }
}

let current: Frame | undefined;

/** Swaps the current frame and returns the previous one. */
export function setCurrent(frame: Frame | undefined) {
  const previous = current;
  current = frame;
  return previous;
}

/** Returns the current frame record, if any. */
export function currentFrame() {
  return current;
}

/** Runs setup with `frame` active for synchronous engine calls. */
export function runInFrame<T>(frame: Frame | undefined, setup: () => T): T {
  const previous = current;
  current = frame;
  try {
    return setup();
  } finally {
    current = previous;
  }
}

/** Returns the active frame, if any. */
export const getFrame: () => object | undefined = currentFrame;

/** Requires an active frame record and names `api` in the error if absent. */
export function requireCurrent(api?: string): Frame {
  if (!current) {
    throw new Error(
      `${api ? `${api}: ` : ''}no frame here. Call it during setup (inside component(), withFrame(), a page, a route action or onAttach), or pass the frame explicitly.`,
    );
  }

  return current;
}

/** Requires an active frame and names `api` in the error if absent. */
export const requireFrame: (api?: string) => object = requireCurrent;

/** Runs setup with `frame` active. */
export function withFrame<T>(frame: object, setup: () => T): T {
  return runInFrame(ensureFrame(frame), setup);
}
