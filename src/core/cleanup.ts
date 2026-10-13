import {
  DEAD,
  ensureFrame,
  requireCurrent,
  type Cleanup,
  type Frame,
} from './frame.ts';
import { report } from './report.ts';

type HookEntry = Cleanup & { hook: () => void };

/** Shared no-op unregister for registrations on dead frames. */
export const noop = () => {};

function runHook(this: HookEntry) {
  this.hook();
}

/** Appends `entry` to the cleanup list of `frame`. */
export function addCleanup(frame: Frame, entry: Cleanup) {
  const last = frame.lastCleanup;
  entry.owner = frame;
  entry.prevCleanup = last;
  if (last) {
    last.nextCleanup = entry;
  } else {
    frame.cleanups = entry;
  }
  frame.lastCleanup = entry;
}

/** Unlinks `entry` from its owner's cleanup list in O(1). */
export function removeCleanup(entry: Cleanup) {
  const owner = entry.owner;
  if (owner) {
    const { prevCleanup, nextCleanup } = entry;
    if (prevCleanup) {
      prevCleanup.nextCleanup = nextCleanup;
    } else {
      owner.cleanups = nextCleanup;
    }
    if (nextCleanup) {
      nextCleanup.prevCleanup = prevCleanup;
    } else {
      owner.lastCleanup = prevCleanup;
    }
    entry.owner = undefined;
  }
}

/** Returns the function that removes `entry` before its frame dies. */
export const unregister = (entry: Cleanup) => () => {
  removeCleanup(entry);
  entry.dispose();
};

/** Registers `hook` to run when `frame` is destroyed and returns its cleanup entry. */
export function addHook(frame: Frame, hook: () => void) {
  const entry: HookEntry = {
    dispose: runHook,
    owner: undefined,
    prevCleanup: undefined,
    nextCleanup: undefined,
    hook,
  };
  addCleanup(frame, entry);

  return entry;
}

/** Runs the cleanups of `frame` in registration order, reporting errors, then empties its list. */
export function runCleanups(frame: Frame) {
  let entry = frame.cleanups;
  while (entry) {
    const next = entry.nextCleanup;
    if (entry.owner === frame) {
      entry.owner = undefined;
      try {
        entry.dispose();
      } catch (error) {
        report(error);
      }
    }
    entry = next;
  }
  frame.cleanups = frame.lastCleanup = undefined;
}

/** Registers cleanup for destruction and returns an unregister function. */
export function onDestroy(hook: () => void): () => void;
export function onDestroy(node: object, hook: () => void): () => void;
export function onDestroy(
  nodeOrHook: object | (() => void),
  maybeHook?: () => void,
) {
  const frame = maybeHook
    ? ensureFrame(nodeOrHook)
    : requireCurrent('onDestroy');
  const hook = maybeHook ?? (nodeOrHook as () => void);

  if (frame.state & DEAD) {
    hook();
    return noop;
  }

  const entry = addHook(frame, hook);

  return () => {
    removeCleanup(entry);
  };
}
