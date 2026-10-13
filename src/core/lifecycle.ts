import { addHook } from './cleanup.ts';
import {
  createFrame,
  DEAD,
  ensureFrame,
  HELD,
  LIVE,
  PENDING,
  requireCurrent,
  setCurrent,
  WAITING,
  type Frame,
} from './frame.ts';
import { report } from './report.ts';

/** Runs after attachment and may return cleanup for detachment. */
export type AttachHook = (frame: object) => (() => void) | void;

const isLive = (frame: Frame) => (frame.state & (PENDING | DEAD)) === 0;

/** Clears `flag` on `frame` and wakes the frame when nothing else holds it. */
export function lift(frame: Frame, flag: number) {
  if (frame.state & flag) {
    frame.state ^= flag;
    if (isLive(frame)) {
      wake(frame);
    }
  }
}

function wake(frame: Frame) {
  if (frame.parent) {
    runAttachHooks(frame);
  }
  let child = frame.first;
  while (child) {
    const next = child.next;
    lift(child, WAITING);
    child = child.parent === frame && child.next === next ? next : frame.first;
  }
}

function attachFrameOf(frame: Frame) {
  let attachFrame = frame.attachFrame;
  if (!attachFrame) {
    attachFrame = frame.attachFrame = createFrame(LIVE);
    attachFrame.parent = frame;
  }

  return attachFrame;
}

/** Runs the attach hooks of `frame` in its attach frame. */
export function runAttachHooks(frame: Frame) {
  const hooks = frame.attachHooks;
  if (hooks) {
    const attachFrame = attachFrameOf(frame);
    const count = hooks.length;
    for (let index = 0; index < count; index++) {
      runAttachHook(hooks[index], attachFrame);
    }
  }
}

function runAttachHook(hook: AttachHook, attachFrame: Frame) {
  const previous = setCurrent(attachFrame);
  try {
    const cleanup = hook(attachFrame);
    if (cleanup) {
      if (attachFrame.state & DEAD) {
        cleanup();
      } else {
        addHook(attachFrame, cleanup);
      }
    }
  } catch (error) {
    report(error);
  } finally {
    setCurrent(previous);
  }
}

/** Runs `fn` when the hold on `frame` ends, before its attach hooks; now if it is not held. */
export function afterSetup(frame: Frame, fn: () => void) {
  if (frame.state & HELD) {
    (frame.ready ??= []).push(fn);
  } else {
    fn();
  }
}

/** Ends a hold: runs afterSetup callbacks, then the attach hooks it delayed, parent first. */
export function release(frame: Frame) {
  if (frame.state & HELD) {
    try {
      let ready = frame.ready;
      while (ready) {
        frame.ready = undefined;
        for (const fn of ready) {
          fn();
        }
        ready = frame.ready;
      }
    } finally {
      frame.ready = undefined;
      frame.state &= ~HELD;
    }
    if (isLive(frame)) {
      wake(frame);
    }
  }
}

/** Runs a hook for each attachment and destroys its frame on detachment. */
export function onAttach(hook: AttachHook): void;
export function onAttach(node: object, hook: AttachHook): void;
export function onAttach(
  nodeOrHook: object | AttachHook,
  maybeHook?: AttachHook,
) {
  const frame = maybeHook
    ? ensureFrame(nodeOrHook)
    : requireCurrent('onAttach');
  const hook = maybeHook ?? (nodeOrHook as AttachHook);

  (frame.attachHooks ??= []).push(hook);

  if (frame.parent && isLive(frame)) {
    runAttachHook(hook, attachFrameOf(frame));
  }
}
