import { frameOf, requireFrame } from './frame.ts';
import { getParent } from './tree.ts';

/** Identifies a value provided to logical descendants. */
export type Store<T> = {
  readonly init: () => T;
};

const provided = new WeakMap<object, Map<Store<unknown>, unknown>>();

/** Creates a store identifier and its value initializer. */
export function createStore<T>(init: () => T): Store<T> {
  return { init };
}

/** Creates and provides a store value on a node. */
export function attachStore<T>(store: Store<T>): T;
export function attachStore<T>(node: object, store: Store<T>): T;
export function attachStore<T>(
  nodeOrStore: object | Store<T>,
  maybeStore?: Store<T>,
): T {
  const frame = maybeStore ? frameOf(nodeOrStore) : requireFrame('attachStore');

  const store = maybeStore ?? (nodeOrStore as Store<T>);
  let values = provided.get(frame);
  if (!values) {
    values = new Map();
    provided.set(frame, values);
  }

  const value = store.init();
  values.set(store, value);

  return value;
}

/** Finds the nearest provider; resolve after attachment if the node can move. */
export function useStore<T>(store: Store<T>): T;
export function useStore<T>(node: object, store: Store<T>): T;
export function useStore<T>(
  nodeOrStore: object | Store<T>,
  maybeStore?: Store<T>,
): T {
  const store = maybeStore ?? (nodeOrStore as Store<T>);
  let current: object | undefined = maybeStore
    ? frameOf(nodeOrStore)
    : requireFrame('useStore');
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
