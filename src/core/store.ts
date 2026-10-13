import { ensureFrame, frameOf, requireCurrent } from './frame.ts';

/** Identifies a value provided to logical descendants. */
export type Store<T> = {
  readonly init: () => T;
};

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
  const frame = maybeStore
    ? ensureFrame(nodeOrStore)
    : requireCurrent('attachStore');

  const store = maybeStore ?? (nodeOrStore as Store<T>);
  const value = store.init();
  (frame.stores ??= new Map()).set(store, value);

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
  for (
    let frame = maybeStore ? frameOf(nodeOrStore) : requireCurrent('useStore');
    frame;
    frame = frame.parent
  ) {
    const values = frame.stores;
    if (values?.has(store)) {
      return values.get(store) as T;
    }
  }

  throw new Error(
    'useStore: no ancestor provides this store. Attach the node first, or resolve the store inside onAttach.',
  );
}
