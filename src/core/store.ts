import { requireOwner } from './owner.ts';
import { getParent } from './tree.ts';

/** Identifies a value that a node provides to its logical descendants. */
export type Store<T> = {
  readonly init: () => T;
};

const provided = new WeakMap<object, Map<Store<unknown>, unknown>>();

/**
 * Describes a store.
 * @param init Creates a fresh value for each node that attaches the store.
 * @returns The store identifier.
 */
export function createStore<T>(init: () => T): Store<T> {
  return { init };
}

/**
 * Creates the store's value on `node` (default: the current owner), visible
 * to it and its logical descendants.
 * @returns The new value.
 */
export function attachStore<T>(store: Store<T>): T;
export function attachStore<T>(node: object, store: Store<T>): T;
export function attachStore<T>(nodeOrStore: object | Store<T>, maybeStore?: Store<T>): T {
  const node = maybeStore ? nodeOrStore : requireOwner('attachStore');
  const store = maybeStore ?? (nodeOrStore as Store<T>);
  let values = provided.get(node);
  if (!values) {
    values = new Map();
    provided.set(node, values);
  }

  const value = store.init();
  values.set(store, value);

  return value;
}

/**
 * Finds the nearest value of `store` on `node` or its logical ancestors. O(depth).
 * Resolve after the node is attached: right after `attach`, or inside `onAttach`
 * for components that move between parents.
 * Without `node`: from the current owner.
 * @returns The nearest value.
 * @throws When no ancestor provides the store.
 */
export function useStore<T>(store: Store<T>): T;
export function useStore<T>(node: object, store: Store<T>): T;
export function useStore<T>(nodeOrStore: object | Store<T>, maybeStore?: Store<T>): T {
  const store = maybeStore ?? (nodeOrStore as Store<T>);
  let current: object | undefined = maybeStore ? nodeOrStore : requireOwner('useStore');
  while (current) {
    const values = provided.get(current);
    if (values?.has(store)) {
      return values.get(store) as T;
    }
    current = getParent(current);
  }

  throw new Error(
    'useStore: no ancestor provides this store. Attach the node first, or resolve the store inside onAttach.',
  );
}
