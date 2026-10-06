import { runIsolated } from './report.ts';
import { getOwner } from './owner.ts';
import { onDestroy } from './tree.ts';

export type Listener<T> = (value: T) => void;
export type Unsubscribe = () => void;

/**
 * Subscribes `listener`. With an `owner`, the subscription ends when it is
 * destroyed. Without one: owned by the current owner during setup, unowned
 * elsewhere.
 */
export type Subscribe<T> = {
  (listener: Listener<T>): Unsubscribe;
  (owner: object, listener: Listener<T>): Unsubscribe;
};

type Link<T> = {
  listener: Listener<T>;
  id: number;
  next?: Link<T>;
  prev?: Link<T>;
  removed?: boolean;
};

/**
 * Creates a doubly linked listener list: O(1) subscribe and unsubscribe,
 * allocation-free calls. A call reaches exactly the listeners that were
 * subscribed when it started and are still subscribed when their turn comes.
 * @returns `call` to notify listeners and `subscribe` to add one.
 */
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
    ownerOrListener: object | Listener<T>,
    maybeListener?: Listener<T>,
  ) => {
    const owner =
      typeof ownerOrListener === 'function' ? getOwner() : ownerOrListener;
    const link = add(
      typeof ownerOrListener === 'function'
        ? (ownerOrListener as Listener<T>)
        : maybeListener!,
    );
    if (!owner) {
      return () => {
        remove(link);
      };
    }

    const unregister = onDestroy(owner, () => {
      remove(link);
    });

    return () => {
      unregister();
      remove(link);
    };
  }) as Subscribe<T>;

  return { call, subscribe };
}
