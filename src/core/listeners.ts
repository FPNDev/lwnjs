import { runIsolated } from './report.ts';
import { bindFrame, frameOf, getFrame } from './frame.ts';
import { onDestroy } from './tree.ts';

export type Listener<T> = (value: T) => void;
export type Unsubscribe = () => void;

/** Subscribes a listener and binds it to the active frame when present. */
export type Subscribe<T> = {
  (listener: Listener<T>): Unsubscribe;
  (frame: object, listener: Listener<T>): Unsubscribe;
};

type Link<T> = {
  listener: Listener<T>;
  id: number;
  next?: Link<T>;
  prev?: Link<T>;
  removed?: boolean;
};

/** Creates a listener list that supports subscription changes during dispatch. */
export function createListeners<T>() {
  let head: Link<T> | undefined;
  let tail: Link<T> | undefined;
  let nextId = 0;

  const add = (listener: Listener<T>) => {
    const link: Link<T> = { listener, id: nextId++, prev: tail };
    if (tail) {
      tail.next = link;
    } else {
      head = link;
    }
    tail = link;

    return link;
  };

  const remove = (link: Link<T>) => {
    if (link.removed) {
      return;
    }

    link.removed = true;

    if (link.prev) {
      link.prev.next = link.next;
    } else {
      head = link.next;
    }

    if (link.next) {
      link.next.prev = link.prev;
    } else {
      tail = link.prev;
    }
  };

  const call = (value: T) => {
    const endId = nextId;
    let link = head;
    while (link) {
      if (!link.removed && link.id < endId) {
        const { listener } = link;
        runIsolated(() => {
          listener(value);
        });
      }
      link = link.next;
    }
  };

  const subscribe = ((
    frameOrListener: object | Listener<T>,
    maybeListener?: Listener<T>,
  ) => {
    const frame =
      typeof frameOrListener === 'function'
        ? getFrame()
        : frameOf(frameOrListener);
    const listener =
      typeof frameOrListener === 'function'
        ? (frameOrListener as Listener<T>)
        : maybeListener!;

    const link = add(bindFrame(frame, listener));

    if (!frame) {
      return () => {
        remove(link);
      };
    }

    const unregister = onDestroy(frame, () => {
      remove(link);
    });

    return () => {
      unregister();
      remove(link);
    };
  }) as Subscribe<T>;

  return { call, subscribe };
}
