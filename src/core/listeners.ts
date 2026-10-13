import { report } from './report.ts';
import {
  currentFrame,
  ensureFrame,
  setCurrent,
  DEAD,
  type Cleanup,
} from './frame.ts';
import { addCleanup, noop, unregister } from './cleanup.ts';

export type Listener<T> = (value: T) => void;
export type Unsubscribe = () => void;

/** Subscribes a listener and binds it to the active frame when present. */
export type Subscribe<T> = {
  (listener: Listener<T>): Unsubscribe;
  (frame: object, listener: Listener<T>): Unsubscribe;
};

type Link<T> = Cleanup & {
  listener: Listener<T> | undefined;
  id: number;
  next: Link<T> | undefined;
  prev: Link<T> | undefined;
};

/** Creates a listener list that supports subscription changes during dispatch. */
export function createListeners<T>() {
  let head: Link<T> | undefined;
  let tail: Link<T> | undefined;
  let nextId = 0;

  const remove = function (this: Link<T>) {
    if (!this.listener) {
      return;
    }

    this.listener = undefined;

    const { prev, next } = this;
    if (prev) {
      prev.next = next;
    } else {
      head = next;
    }

    if (next) {
      next.prev = prev;
    } else {
      tail = prev;
    }
  };

  const call = (value: T) => {
    const endId = nextId;
    const previous = currentFrame();
    for (let link = head; link; link = link.next) {
      const listener = link.listener;
      if (listener && link.id < endId) {
        setCurrent(link.owner ?? previous);
        try {
          listener(value);
        } catch (error) {
          report(error);
        }
      }
    }
    setCurrent(previous);
  };

  const subscribe = ((
    frameOrListener: object | Listener<T>,
    maybeListener?: Listener<T>,
  ) => {
    const implicit = typeof frameOrListener === 'function';
    const frame = implicit ? currentFrame() : ensureFrame(frameOrListener);

    if (frame && frame.state & DEAD) {
      return noop;
    }

    const link: Link<T> = {
      dispose: remove,
      owner: undefined,
      prevCleanup: undefined,
      nextCleanup: undefined,
      listener: implicit ? (frameOrListener as Listener<T>) : maybeListener!,
      id: nextId++,
      next: undefined,
      prev: tail,
    };
    if (tail) {
      tail.next = link;
    } else {
      head = link;
    }
    tail = link;

    if (frame) {
      addCleanup(frame, link);
    }

    return unregister(link);
  }) as Subscribe<T>;

  return { call, subscribe };
}
