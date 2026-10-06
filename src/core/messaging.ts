import { createListeners, type Subscribe } from './listeners.ts';

/** Fire-and-forget notifications, e.g. `delete`, `submit`, `abort`. */
export type Emitter<T> = {
  emit(value: T): void;
  subscribe: Subscribe<T>;
};

/** A current value that notifies on change. */
export type State<T> = {
  get(): T;
  /** Sets the value and notifies, always: setting the same (mutated) object is a valid way to announce a change. */
  set(value: T): void;
  /** Notifies with the current value, e.g. after mutating it in place. */
  notify(): void;
  subscribe: Subscribe<T>;
};

/**
 * Creates an emitter.
 * @returns The emitter.
 */
export function createEmitter<T = void>(): Emitter<T> {
  const { call, subscribe } = createListeners<T>();

  return { emit: call, subscribe };
}

/**
 * Creates a state.
 * @param initialValue Starting value.
 * @returns The state.
 */
export function createState<T>(initialValue: T): State<T> {
  const { call, subscribe } = createListeners<T>();
  let value = initialValue;

  return {
    get: () => value,
    set(nextValue) {
      value = nextValue;
      call(nextValue);
    },
    notify() {
      call(value);
    },
    subscribe,
  };
}
