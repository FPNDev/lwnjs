import { currentFrame, setCurrent } from './frame.ts';
import { getRenderer } from './renderer.ts';
import {
  bindController,
  createChildFrame,
  destroyFrame,
  release,
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
>(setup: (...args: A) => R): (...args: A) => R extends void ? object : R {
  return (...args: A) => {
    const frame = createChildFrame(currentFrame());
    const previous = setCurrent(frame);
    try {
      const result = setup(...args);
      setCurrent(previous);
      if (result !== undefined) {
        bindController(frame, result as ComponentController);
      }

      release(frame);

      return (result ?? frame) as R extends void ? object : R;
    } catch (error) {
      setCurrent(previous);
      destroyFrame(frame, getRenderer());
      throw error;
    }
  };
}
