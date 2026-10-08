import { getFrame, runInFrame } from './frame.ts';
import {
  attach,
  bindComponentController,
  ensureLogicalRecord,
  destroy,
} from './tree.ts';

/** A controller exposes one or more renderer roots. */
export type ComponentController<T extends object = object> = (
  | { node: T; nodes?: never }
  | { nodes: T[]; node?: never }
) &
  Record<string, unknown>;

/** Creates component instances with independent frames. */
export function component<
  A extends unknown[],
  R extends ComponentController | void,
>(
  setup: (...args: A) => R,
): (...args: A) => R extends void ? ComponentController : R {
  return (...args: A) => {
    let parentFrame: object | undefined;
    try {
      parentFrame = getFrame();
    } catch {
      // parent has no frame - ok
    }

    return createFramedComponent(parentFrame, () => setup(...args));
  };
}

function createFramedComponent<T extends ComponentController | void>(
  parentFrame: object | undefined,
  setup: () => T,
): T extends void ? ComponentController : T {
  return createFrame(parentFrame, setup, (frame, result) => {
    if (result === undefined) {
      return frame as T extends void ? ComponentController : T;
    }

    bindComponentController(frame, result);

    return result as T extends void ? ComponentController : T;
  });
}

function createFrame<T, R>(
  parentFrame: object | undefined,
  setup: () => T,
  finish: (frame: object, result: T) => R,
): R {
  const frame = {};
  if (parentFrame) {
    attach(parentFrame, frame);
  } else {
    ensureLogicalRecord(frame);
  }

  try {
    const result = runInFrame(frame, setup);

    return finish(frame, result);
  } catch (error) {
    destroy(frame);
    throw error;
  }
}
